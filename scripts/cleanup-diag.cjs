/** Limpa sessões de teste de diagnóstico (utm_source contém DIAG). */
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
  const { data } = await sb.from("funnel_sessions").select("session_id,utm_source").like("utm_source", "%DIAG%");
  if (!data || !data.length) { console.log("Nenhuma sessão DIAG pra limpar."); return; }
  const ids = data.map((r) => r.session_id);
  await sb.from("step_events").delete().in("session_id", ids);
  await sb.from("quiz_answers").delete().in("session_id", ids);
  await sb.from("funnel_sessions").delete().in("session_id", ids);
  console.log(`🧹 Limpei ${ids.length} sessão(ões) DIAG:`, data.map((r) => r.utm_source).join(", "));
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
