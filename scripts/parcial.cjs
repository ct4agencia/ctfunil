/** PARCIAL de um funil desde 12h BRT de hoje (visitantes/respostas/leads/conclusões). */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
const LAYER_Q = ["options", "slider", "roulette", "measure"];
function stageIdx(steps) {
  const enabled = (steps || []).filter((s) => !s?.disabled);
  const arr = enabled.length ? enabled : (steps || []);
  const hasLayer = (s, types) => Array.isArray(s?.layers) && s.layers.some((l) => types.includes(l?.type));
  let firstQ = arr.findIndex((s) => hasLayer(s, LAYER_Q)); if (firstQ < 0) firstQ = 1;
  const lastI = arr.length - 1;
  return { firstQ, lastI, total: arr.length };
}
async function main() {
  const slug = process.argv[2] || "cdb-hero04-2";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // 12h BRT de hoje → UTC (offset explícito -03:00)
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const startUtc = new Date(`${hoje}T12:00:00-03:00`).toISOString();
  const agoraBrt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date());
  console.log(`Janela: 12:00 BRT (${startUtc}) → agora (${agoraBrt} BRT)`);

  // quais funis tiveram sessão desde 12h?
  const allSess = await sb.from("funnel_sessions").select("funnel_slug").gte("created_at", startUtc).limit(100000);
  const cnt = {}; for (const s of allSess.data || []) cnt[s.funnel_slug] = (cnt[s.funnel_slug] || 0) + 1;
  console.log(`Sessões desde 12h BRT (${startUtc}) por funil:`, JSON.stringify(cnt), "\n");

  const { data: f } = await sb.from("funnels").select("steps,settings").eq("slug", slug).maybeSingle();
  const idx = stageIdx(f.steps);
  const sess = await sb.from("funnel_sessions").select("max_step_reached").eq("funnel_slug", slug).gte("created_at", startUtc).limit(100000);
  const lead = await sb.from("funnel_leads").select("id", { count: "exact", head: true }).eq("funnel_slug", slug).gte("created_at", startUtc);
  const ms = (sess.data || []).map((s) => s.max_step_reached ?? 0);
  const visitantes = ms.length;
  const respostas = ms.filter((x) => x >= idx.firstQ).length;
  const conclusoes = ms.filter((x) => x >= idx.lastI).length;
  const leads = lead.count ?? 0;
  console.log(`── ${slug} (firstQ=${idx.firstQ}, lastI=${idx.lastI}) ──`);
  console.log(`VISITANTES: ${visitantes}`);
  console.log(`RESPOSTAS:  ${respostas}`);
  console.log(`LEADS:      ${leads}`);
  console.log(`CONCLUSÕES: ${conclusoes}`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
