/**
 * Check do gráfico de tráfego da aba Performance.
 *
 * O QUE ESTE SCRIPT PROVA
 * Até 07/08/2026 a série era montada no JS com `if (now - t > 24h) continue`,
 * então o gráfico ignorava o período: escolher "Ontem" ou "30 dias" descartava
 * tudo e a caixa aparecia vazia — sem erro, sem aviso. Agora vem da RPC
 * `funnel_traffic_series` (migration 0019, ligada em metrics.ts).
 *
 * Três invariantes, cada uma falha com exit 1:
 *   1. SOMA      — a série tem que somar o mesmo que `funnel_metrics_agg`.
 *                  Se divergir, a tela mostra um total e um gráfico que se
 *                  contradizem, que é o defeito histórico deste painel.
 *   2. PERÍODO   — uma janela inteiramente no passado tem que devolver linhas.
 *                  É o teste do bug em si: com o código antigo, zero.
 *   3. CONTÍGUO  — `group by` não devolve bucket vazio (medido: 01,02,06,07,11
 *                  no cdb-01 em 24/07). Sem preencher, dois picos separados por
 *                  4 h aparecem colados e a linha mente sobre o tempo.
 *
 * ponytail: a invariante 3 replica o passo de preenchimento de metrics.ts em
 * vez de importar (o módulo é TS e este script é .cjs, como todos os outros da
 * pasta). Mudar o passo lá sem mudar aqui não é detectado — as invariantes 1 e
 * 2, que dependem de dado real, continuam valendo.
 *
 * Uso:  node scripts/check-trafego.cjs [slug]
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}

/** Mesmo preenchimento de metrics.ts: entre o primeiro e o último ponto REAL. */
function preencher(pontos, passo) {
  const cheio = [];
  for (let i = 0; i < pontos.length; i++) {
    cheio.push(pontos[i]);
    const prox = pontos[i + 1];
    if (!prox) break;
    for (let t = pontos[i].t + passo; t < prox.t && cheio.length < 400; t += passo) {
      cheio.push({ t, visitantes: 0 });
    }
  }
  return cheio;
}

async function main() {
  const slug = process.argv[2] || "cdb-01";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Índices reais do funil: `p_last_i = 0` faria `max_step_reached >= 0`, que é
  // sempre verdade, e "conclusões" sairia igual a visitantes.
  const { data: f } = await sb.from("funnels").select("steps").eq("slug", slug).maybeSingle();
  if (!f) { console.error(`funil "${slug}" não existe`); process.exit(1); }
  const ativas = (f.steps || []).filter((s) => !s?.disabled);
  const firstQ = 1, lastI = Math.max(0, ativas.length - 1);

  // Janela ampla o bastante para conter todo o histórico do funil.
  const from = "2026-01-01T00:00:00-03:00", to = "2026-12-31T23:59:59-03:00";
  let falhas = 0;
  const ok = (cond, msg) => { console.log(`   ${cond ? "OK  " : "FALHA"} ${msg}`); if (!cond) falhas++; };

  console.log(`── ${slug} · ${ativas.length} lâminas ativas (firstQ=${firstQ}, lastI=${lastI}) ──\n`);

  const { data: aggRows, error: e1 } = await sb.rpc("funnel_metrics_agg", {
    p_slug: slug, p_from: from, p_to: to, p_first_q: firstQ, p_second_q: 2, p_last_i: lastI,
  });
  if (e1) { console.error("funnel_metrics_agg falhou:", e1.message); process.exit(1); }
  const agg = aggRows?.[0] || {};

  const { data: serie, error: e2 } = await sb.rpc("funnel_traffic_series", {
    p_slug: slug, p_from: from, p_to: to, p_bucket: "day", p_first_q: firstQ, p_last_i: lastI,
  });
  if (e2) { console.error("funnel_traffic_series falhou:", e2.message); process.exit(1); }

  const soma = (k) => (serie || []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  console.log("1) SOMA da série == agregado");
  ok(soma("visitantes") === Number(agg.visitantes), `visitantes: série ${soma("visitantes")} · agregado ${agg.visitantes}`);
  ok(soma("respostas") === Number(agg.respostas), `respostas:  série ${soma("respostas")} · agregado ${agg.respostas}`);
  ok(soma("leads") === Number(agg.leads), `leads:      série ${soma("leads")} · agregado ${agg.leads}`);
  ok(soma("conclusoes") === Number(agg.conclusoes), `conclusões: série ${soma("conclusoes")} · agregado ${agg.conclusoes}`);

  // 2) O bug: janela fechada no passado. O cálculo antigo devolvia zero linhas
  //    aqui SEMPRE, porque descartava tudo com mais de 24 h.
  console.log("\n2) PERÍODO passado devolve dados (o bug corrigido)");
  const dia = (serie || [])[0]?.bucket;
  if (!dia) {
    console.log("   AVISO  funil sem tráfego no ano — invariante não exercitada");
  } else {
    const d0 = new Date(dia); // já vem em horário de SP, rotulado UTC
    const ini = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()));
    const fim = new Date(ini.getTime() + 86400000);
    const iso = (d) => new Date(d.getTime() + 3 * 3600000).toISOString(); // SP -> UTC
    const { data: umDia } = await sb.rpc("funnel_traffic_series", {
      p_slug: slug, p_from: iso(ini), p_to: iso(fim), p_bucket: "hour", p_first_q: firstQ, p_last_i: lastI,
    });
    const dias = Math.round((Date.now() - ini.getTime()) / 86400000);
    ok((umDia || []).length > 0, `${ini.toISOString().slice(0, 10)} (${dias} dias atrás): ${(umDia || []).length} buckets horários`);

    console.log("\n3) Série CONTÍGUA após preenchimento");
    const pontos = (umDia || []).map((r) => ({ t: new Date(r.bucket).getTime(), visitantes: Number(r.visitantes ?? 0) }));
    const cheio = preencher(pontos, 3600000);
    let buracos = 0;
    for (let i = 1; i < cheio.length; i++) if (cheio[i].t - cheio[i - 1].t !== 3600000) buracos++;
    ok(buracos === 0, `${pontos.length} buckets com dado -> ${cheio.length} contíguos, ${buracos} saltos`);
    const somaAntes = pontos.reduce((a, p) => a + p.visitantes, 0);
    const somaDepois = cheio.reduce((a, p) => a + p.visitantes, 0);
    ok(somaAntes === somaDepois, `preencher não inventa visita: ${somaAntes} -> ${somaDepois}`);
  }

  console.log(falhas === 0 ? "\nOK — nenhuma falha." : `\n${falhas} FALHA(S).`);
  process.exit(falhas === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
