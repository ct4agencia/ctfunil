/**
 * GATE DE REGRESSÃO do CTFUNNEL.
 *
 * O projeto não tem suíte de testes: `npm run build` só pega erro de tipo/compilação,
 * não pega "quebrei uma lâmina". Este script é o gate de comportamento do loop-squad.
 *
 *   node scripts/regressao.cjs snapshot   → grava o baseline (rodar ANTES da onda)
 *   node scripts/regressao.cjs check      → compara com o baseline (rodar DEPOIS)
 *
 * O que compara (coisas que NÃO podem mudar sem eu mandar):
 *   - todo funil publicado responde HTTP 200 e continua servindo conteúdo
 *   - o número de lâminas (totais e ativas) de cada funil
 *   - as rotas do painel continuam exigindo login (redirect p/ /admin/login)
 *   - as colunas que as métricas leem continuam existindo
 *
 * O que NÃO compara: valor de métrica (sobe com tráfego real — comparar daria
 * falso positivo todo dia). Regressão de NÚMERO se valida contra a fonte externa
 * (VTurb / Datacrazy / Hotmart), não contra snapshot.
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const BASELINE = join(__dirname, ".regressao-baseline.json");
const BASE_URL = process.env.REGRESSAO_BASE_URL || "https://viverdebolsas.com.br";

/** Mesmo loadEnv dos outros scripts do repo. */
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

/** Rotas do painel que TÊM que continuar protegidas por login. */
const ROTAS_PROTEGIDAS = ["/dashboard", "/analytics", "/builder/cdb-01"];

/** Colunas que as métricas leem — se sumirem, o painel zera em silêncio. */
const COLUNAS_CRITICAS = {
  funnel_sessions: ["session_id", "funnel_slug", "max_step_reached", "last_seen_at", "utm_source"],
  funnel_leads: ["funnel_slug", "session_id", "phone"],
  quiz_answers: ["session_id", "funnel_slug", "step_id", "question", "answer"],
  step_events: ["session_id", "funnel_slug", "step_index", "step_id"],
};

async function coletar(sb) {
  const { data: funnels, error } = await sb.from("funnels").select("slug, status, steps").limit(200);
  if (error) throw new Error("nao consegui ler funnels: " + error.message);

  const funis = [];
  for (const f of funnels || []) {
    const steps = Array.isArray(f.steps) ? f.steps : [];
    const row = {
      slug: f.slug,
      status: f.status,
      laminas: steps.length,
      laminasAtivas: steps.filter((s) => !(s && s.disabled)).length,
    };
    if (f.status === "published") {
      try {
        const r = await fetch(`${BASE_URL}/${f.slug}`, { redirect: "manual" });
        const html = await r.text();
        row.http = r.status;
        row.bytes = html.length;
        row.temConteudo = html.length > 5000; // SSR real; tela branca despenca
      } catch (e) {
        row.http = 0;
        row.erro = String(e.message).slice(0, 80);
      }
    }
    funis.push(row);
  }
  funis.sort((a, b) => a.slug.localeCompare(b.slug));

  const protegidas = [];
  for (const p of ROTAS_PROTEGIDAS) {
    try {
      const r = await fetch(`${BASE_URL}${p}`, { redirect: "manual" });
      protegidas.push({
        rota: p,
        http: r.status,
        redirecionaLogin: String(r.headers.get("location") || "").includes("/admin/login"),
      });
    } catch {
      protegidas.push({ rota: p, http: 0, redirecionaLogin: false });
    }
  }

  const colunas = {};
  for (const [tabela, cols] of Object.entries(COLUNAS_CRITICAS)) {
    const { error: e } = await sb.from(tabela).select(cols.join(",")).limit(1);
    colunas[tabela] = e ? `ERRO: ${e.message}` : "ok";
  }

  const permissoes = await checarPermissoes(sb);

  return { gerado: new Date().toISOString(), baseUrl: BASE_URL, funis, protegidas, colunas, permissoes };
}

/**
 * Testa as PERMISSÕES do banco com a chave pública (a que vai no HTML da lead).
 * Existe porque em 30/07 uma migration de segurança derrubou junto a permissão
 * de atualizar o progresso: o tracking parou em produção e o gate não viu nada,
 * porque só testava as páginas por HTTP. Aqui cobrimos os dois lados:
 *   - o tracking legítimo AINDA grava?
 *   - as brechas continuam fechadas?
 * Usa uma linha de teste própria (session_id "regressao-<ts>"), apagada no fim.
 */
async function checarPermissoes(svc) {
  const env = loadEnv();
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const SID = `regressao-${Date.now()}`;
  const r = {};
  try {
    await svc.from("funnel_sessions").insert({ session_id: SID, funnel_slug: "cdb-01", max_step_reached: 5 });
    const valor = async () => (await svc.from("funnel_sessions").select("max_step_reached,funnel_slug").eq("session_id", SID).maybeSingle()).data;

    // --- tracking legítimo (tem que FUNCIONAR) ---
    // O progresso passou a ser gravado pelo SERVIDOR (/api/step). Testamos o
    // caminho REAL, não o antigo (escrita direta pelo browser, removida na 0018).
    try {
      const res = await fetch(`${BASE_URL}/api/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SID, funnel_slug: "cdb-01", step_index: 9, step_id: "gate", step_type: "options" }),
      });
      r.trackingProgresso = res.ok && (await valor())?.max_step_reached === 9 ? "ok" : "QUEBRADO";
    } catch (e) {
      r.trackingProgresso = `QUEBRADO (${String(e.message).slice(0, 40)})`;
    }
    r.trackingEvento = (await anon.from("step_events").insert({ session_id: SID, funnel_slug: "cdb-01", step_index: 9, step_id: "x", step_type: "t" })).error ? "QUEBRADO" : "ok";
    r.trackingResposta = (await anon.from("quiz_answers").insert({ session_id: SID, funnel_slug: "cdb-01", step_id: "x", question: "t", answer: "t" })).error ? "QUEBRADO" : "ok";
    r.trackingLead = (await anon.from("funnel_leads").insert({ funnel_slug: "cdb-01", session_id: SID, phone: "11999999999", name: "t" })).error ? "QUEBRADO" : "ok";

    // --- brechas (têm que continuar FECHADAS) ---
    // Escrita anônima em funnel_sessions foi removida na 0018: o browser não
    // grava mais direto. Se voltar a funcionar, é regressão de segurança.
    const antes = (await valor())?.max_step_reached;
    await anon.from("funnel_sessions").update({ max_step_reached: 99 }).eq("session_id", SID);
    r.brechaEscritaAnonima = (await valor())?.max_step_reached === antes ? "fechada" : "ABERTA";
    await anon.from("funnel_sessions").update({ funnel_slug: "hack" }).eq("session_id", SID);
    r.brechaTrocarFunil = (await valor())?.funnel_slug === "cdb-01" ? "fechada" : "ABERTA";
    const rs = await anon.from("funnel_sessions").select("session_id").limit(1);
    r.brechaLerSessoes = rs.error || !(rs.data || []).length ? "fechada" : "ABERTA";
    const del = await anon.from("funnel_leads").delete().eq("session_id", SID).select();
    r.brechaApagarLeads = del.error || !(del.data || []).length ? "fechada" : "ABERTA";
    const rl = await anon.from("funnel_leads").select("name,phone").limit(1);
    r.brechaLerLeads = rl.error || !(rl.data || []).length ? "fechada" : "ABERTA";
    const rq = await anon.from("quiz_answers").select("answer").limit(1);
    r.brechaLerRespostas = rq.error || !(rq.data || []).length ? "fechada" : "ABERTA";
    const rw = await anon.from("funnels").select("webhooks").limit(1);
    r.brechaLerWebhooks = rw.error || !(rw.data || []).length ? "fechada" : "ABERTA";
  } catch (e) {
    r.erro = String(e.message).slice(0, 80);
  } finally {
    for (const t of ["step_events", "quiz_answers", "funnel_leads", "funnel_sessions"]) {
      try { await svc.from(t).delete().eq("session_id", SID); } catch { /* noop */ }
    }
  }
  return r;
}

function comparar(base, novo) {
  const probs = [];
  const avisos = [];
  const byslug = new Map(base.funis.map((f) => [f.slug, f]));

  for (const n of novo.funis) {
    const b = byslug.get(n.slug);
    if (!b) {
      // Funil NOVO não é regressão — criar funil é o uso normal do app. Vira
      // aviso. Só reprova se já nascer fora do ar, o que aí sim indica que
      // alguma coisa quebrou no caminho de publicação.
      if (n.status === "published" && n.http !== undefined && n.http !== 200) {
        probs.push(`funil novo "${n.slug}" nasceu FORA DO AR — HTTP ${n.http}${n.erro ? " (" + n.erro + ")" : ""}`);
      } else {
        avisos.push(`funil novo: "${n.slug}" (${n.laminasAtivas} laminas ativas)`);
      }
      continue;
    }
    byslug.delete(n.slug);
    if (b.status !== n.status) probs.push(`${n.slug}: status ${b.status} -> ${n.status}`);
    if (b.laminasAtivas !== n.laminasAtivas) probs.push(`${n.slug}: laminas ATIVAS ${b.laminasAtivas} -> ${n.laminasAtivas}`);
    if (b.laminas !== n.laminas) probs.push(`${n.slug}: total de laminas ${b.laminas} -> ${n.laminas}`);
    if (b.http !== undefined) {
      if (b.http === 200 && n.http !== 200) probs.push(`${n.slug}: FUNIL FORA DO AR — HTTP ${b.http} -> ${n.http}${n.erro ? " (" + n.erro + ")" : ""}`);
      if (b.temConteudo && !n.temConteudo) probs.push(`${n.slug}: pagina ficou VAZIA (${b.bytes} -> ${n.bytes} bytes)`);
      if (b.bytes && n.bytes && n.bytes < b.bytes * 0.5) probs.push(`${n.slug}: HTML encolheu >50% (${b.bytes} -> ${n.bytes} bytes)`);
    }
  }
  for (const sumiu of byslug.keys()) probs.push(`funil "${sumiu}" SUMIU do banco`);

  const pbase = new Map(base.protegidas.map((p) => [p.rota, p]));
  for (const n of novo.protegidas) {
    const b = pbase.get(n.rota);
    if (b && b.redirecionaLogin && !n.redirecionaLogin) {
      probs.push(`SEGURANCA: ${n.rota} parou de exigir login (HTTP ${n.http})`);
    }
  }

  for (const [tabela, estado] of Object.entries(novo.colunas)) {
    if (estado !== "ok") probs.push(`BANCO: ${tabela} -> ${estado}`);
  }

  // Permissões: independem do baseline — o esperado é sempre o mesmo.
  // "tracking* = ok" e "brecha* = fechada". Foi o buraco que deixou o tracking
  // cair em produção sem o gate perceber (30/07).
  for (const [k, v] of Object.entries(novo.permissoes || {})) {
    if (k === "erro") { probs.push(`PERMISSOES: erro ao checar -> ${v}`); continue; }
    if (k.startsWith("tracking") && v !== "ok") probs.push(`TRACKING QUEBRADO: ${k} -> ${v}`);
    if (k.startsWith("brecha") && v !== "fechada") probs.push(`SEGURANCA: ${k} -> ${v}`);
  }
  return { probs, avisos };
}

async function main() {
  const modo = process.argv[2];
  if (modo !== "snapshot" && modo !== "check") {
    console.error("uso: node scripts/regressao.cjs snapshot|check");
    process.exit(2);
  }
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const dados = await coletar(sb);

  if (modo === "snapshot") {
    writeFileSync(BASELINE, JSON.stringify(dados, null, 2), "utf8");
    const pub = dados.funis.filter((f) => f.status === "published");
    console.log(`baseline gravado: ${dados.funis.length} funis (${pub.length} publicados), ${dados.protegidas.length} rotas protegidas`);
    const fora = pub.filter((f) => f.http !== 200);
    if (fora.length) console.log("AVISO — ja estavam fora do ar no baseline: " + fora.map((f) => `${f.slug}(${f.http})`).join(", "));
    for (const [t, e] of Object.entries(dados.colunas)) if (e !== "ok") console.log(`AVISO — ${t}: ${e}`);
    return;
  }

  if (!existsSync(BASELINE)) {
    console.error("sem baseline. rode: node scripts/regressao.cjs snapshot");
    process.exit(2);
  }
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  const { probs, avisos } = comparar(base, dados);
  // Avisos NÃO reprovam: são novidades esperadas (funil criado pelo Luca).
  // Aparecem sempre, pra ninguém confundir "novo" com "quebrado".
  if (avisos.length) {
    console.log(`avisos (${avisos.length}) — nao reprovam o gate:`);
    for (const a of avisos) console.log("  · " + a);
    console.log("  rode `snapshot` pra incorporar ao baseline.\n");
  }
  if (!probs.length) {
    console.log(`OK — nenhuma regressao. ${dados.funis.length} funis conferidos (baseline de ${base.gerado}).`);
    return;
  }
  console.error(`REGRESSAO DETECTADA (${probs.length}):`);
  for (const p of probs) console.error("  - " + p);
  process.exit(1);
}

main().catch((e) => { console.error("erro:", e.message || e); process.exit(1); });
