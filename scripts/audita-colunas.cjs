/**
 * AUDITORIA DAS COLUNAS DE RESPOSTA — read-only.
 *
 *   node scripts/audita-colunas.cjs [slug]
 *
 * Roda a mesma lógica de `src/lib/quiz/colunas.ts` sobre os funis do banco e
 * mostra que colunas a tela e o CSV vão exibir. Responde três perguntas antes
 * de mexer na aba Leads:
 *
 *   1. as chaves ficam LEGÍVEIS? (ou ainda saem ids opacos tipo "lyr_a1b2")
 *   2. existe lâmina com 2+ blocos de opções? — se não existir, a migração de
 *      `quiz_answers.layer_id` não precisa acontecer, e o caminho quente dos
 *      funis pagos não é tocado
 *   3. existe chave duplicada? (dois campos "telefone" viram headers iguais)
 *
 * Só SELECT em `funnels`. Não lê resposta, lead nem sessão.
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const linha of raw.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const semTags = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// espelha keyOf() de src/lib/quiz/colunas.ts
const keyOf = (l, step, idx) => String(
  l?.webhookKey
  || (l?.type === "field" ? (l?.content?.name || "") : "")
  || step?.webhookKey
  || l?.id
  || idx,
);

function colunasDoFunil(steps) {
  const cols = [];
  const alertas = [];
  const usadas = new Map();
  const ativos = (steps || []).filter((s) => !s?.disabled);

  ativos.forEach((step, idx) => {
    const stepTitle = semTags(step?.title) || `Lamina ${idx + 1}`;
    const layers = Array.isArray(step?.layers) ? step.layers : [];
    const push = (kind, bruta) => {
      const n = (usadas.get(bruta) ?? 0) + 1;
      usadas.set(bruta, n);
      cols.push({ kind, key: n > 1 ? `${bruta}#${n}` : bruta, stepTitle, repetida: n > 1 });
    };

    if (!layers.length) {
      if (["question", "slider", "measure"].includes(step?.type)) push("options", String(step?.webhookKey || step?.id || idx));
      return;
    }
    let nOpt = 0;
    for (const l of layers) {
      if (l?.design?.hidden) continue;
      if (l?.type === "options") { push("options", keyOf(l, step, idx)); nOpt++; }
      else if (l?.type === "button") push("button", keyOf(l, step, idx));
      else if (l?.type === "field") push("field", keyOf(l, step, idx));
    }
    // 2+ blocos de opcoes na MESMA lamina: quiz_answers so tem step_id, entao
    // as duas colunas recebem a mesma resposta. E o gatilho da migracao.
    if (nOpt >= 2) alertas.push(`lamina "${stepTitle}" tem ${nOpt} blocos de opcoes`);
  });
  return { cols, alertas };
}

/** id opaco = gerado pelo sistema, ilegivel pra quem le a planilha */
const opaca = (k) => /^[a-z0-9_-]{6,12}$/i.test(k) && !/^(nome|name|telefone|phone|email|whatsapp|cidade|estado)$/i.test(k);

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const filtro = process.argv[2];

  let q = sb.from("funnels").select("slug,steps").order("slug");
  if (filtro) q = q.eq("slug", filtro);
  const { data, error } = await q;
  if (error) { console.error("erro:", error.message); process.exit(1); }

  let totalCols = 0, totalOpacas = 0, totalAlertas = 0, totalRepetidas = 0;
  for (const f of data) {
    const { cols, alertas } = colunasDoFunil(f.steps);
    if (!cols.length && !alertas.length) continue;
    const op = cols.filter((c) => opaca(c.key));
    const rep = cols.filter((c) => c.repetida);
    totalCols += cols.length; totalOpacas += op.length; totalAlertas += alertas.length; totalRepetidas += rep.length;

    console.log(`\n${f.slug}  -  ${cols.length} colunas`);
    if (filtro) for (const c of cols) console.log(`   ${c.kind.padEnd(8)} ${c.key.padEnd(24)} (${c.stepTitle})`);
    if (op.length) console.log(`   ${op.length} com id opaco: ${op.slice(0, 6).map((c) => c.key).join(", ")}${op.length > 6 ? "..." : ""}`);
    for (const a of alertas) console.log(`   ALERTA: ${a}`);
    for (const c of rep) console.log(`   chave repetida (desambiguada): ${c.key}`);
  }

  console.log(`\n${"=".repeat(62)}`);
  console.log(`colunas ................ ${totalCols}`);
  console.log(`com id opaco ........... ${totalOpacas}  (ficam legiveis quando o ID/Name for preenchido)`);
  console.log(`chaves repetidas ....... ${totalRepetidas}`);
  console.log(`laminas com 2+ opcoes .. ${totalAlertas}  ${totalAlertas === 0 ? "-> migracao de layer_id NAO e necessaria" : "-> migracao de layer_id necessaria"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
