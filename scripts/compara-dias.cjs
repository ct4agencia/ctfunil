/** Compara a conversão do funil entre dois dias BRT (visitantes/respostas/conclusões). */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
const FIRST_Q = 2, LAST_I = 19; // cdb-hero04-2 (calculado antes)
async function janela(sb, slug, fromUtc, toUtc) {
  let q = sb.from("funnel_sessions").select("max_step_reached").eq("funnel_slug", slug).gte("created_at", fromUtc);
  if (toUtc) q = q.lt("created_at", toUtc);
  const { data: sess } = await q.limit(100000);
  const ms = (sess || []).map((s) => s.max_step_reached ?? 0);
  const vis = ms.length, resp = ms.filter((x) => x >= FIRST_Q).length, conc = ms.filter((x) => x >= LAST_I).length;
  let lq = sb.from("funnel_leads").select("id", { count: "exact", head: true }).eq("funnel_slug", slug).gte("created_at", fromUtc);
  if (toUtc) lq = lq.lt("created_at", toUtc);
  const { count: leads } = await lq;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return { vis, resp, leads: leads ?? 0, conc, pRespVis: pct(resp, vis), pConcVis: pct(conc, vis) };
}
async function main() {
  const slug = process.argv[2] || "cdb-hero04-2";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const ontem = await janela(sb, slug, "2026-06-30T03:00:00Z", "2026-07-01T03:00:00Z");
  const hoje = await janela(sb, slug, "2026-07-01T03:00:00Z", null);
  const show = (t, d) => console.log(`${t.padEnd(8)} vis=${String(d.vis).padStart(4)}  resp=${String(d.resp).padStart(3)} (${d.pRespVis}%)  leads=${String(d.leads).padStart(3)}  conc=${String(d.conc).padStart(3)} (${d.pConcVis}%)`);
  console.log(`── ${slug} (firstQ=${FIRST_Q}, lastI=${LAST_I}) ──`);
  show("30/06", ontem);
  show("01/07", hoje);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
