/** Confere se o beacon criou a sessão de teste (utm_source=BEACON_DIAG) e depois limpa. */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.from("funnel_sessions").select("session_id,funnel_slug,utm_source,utm_campaign,max_step_reached,created_at").eq("utm_source", "BEACON_DIAG").order("created_at", { ascending: false });
  if (!data || !data.length) { console.log("❌ Nenhuma sessão BEACON_DIAG encontrada — beacon NÃO gravou."); return; }
  console.log(`✅ Beacon gravou ${data.length} sessão(ões):`);
  for (const r of data) console.log(`   ${r.session_id} | slug=${r.funnel_slug} | utm=${r.utm_source}/${r.utm_campaign} | max_step=${r.max_step_reached} | ${r.created_at}`);
  const clean = process.argv[2] === "clean";
  if (clean) {
    const ids = data.map((r) => r.session_id);
    await sb.from("step_events").delete().in("session_id", ids);
    await sb.from("funnel_sessions").delete().in("session_id", ids);
    console.log(`🧹 Limpei ${ids.length} sessão(ões) de teste.`);
  } else {
    console.log("   (rode com 'clean' pra apagar essas sessões de teste)");
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
