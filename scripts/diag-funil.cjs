/** Diagnóstico: distribuição de max_step das sessões de hoje + reconcilia respostas. */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
async function main() {
  const slug = process.argv[2] || "cdb-hero04-2";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${hoje}T00:00:00-03:00`).toISOString();

  const { data: sess } = await sb.from("funnel_sessions").select("session_id,max_step_reached,created_at,last_seen_at,utm_campaign").eq("funnel_slug", slug).gte("created_at", start).order("created_at", { ascending: true });
  const dist = {};
  let semUtm = 0, comUtm = 0, soCreated = 0;
  for (const s of sess) {
    const ms = s.max_step_reached ?? 0;
    dist[ms] = (dist[ms] || 0) + 1;
    if (s.utm_campaign) comUtm++; else semUtm++;
    // sessão que nunca teve last_seen atualizado (beacon puro, sem trackStep do cliente)?
    if (!s.last_seen_at || s.last_seen_at === s.created_at) soCreated++;
  }
  console.log(`── ${slug} · HOJE (${sess.length} sessões) ──`);
  console.log(`Distribuição max_step_reached:`);
  for (const k of Object.keys(dist).map(Number).sort((a, b) => a - b)) console.log(`   step ${String(k).padStart(2)}: ${dist[k]} sessões`);
  console.log(`\n  max_step=0 (não passou do hero): ${dist[0] || 0}`);
  console.log(`  com utm_campaign: ${comUtm}  |  sem utm (direto/bot?): ${semUtm}`);
  console.log(`  last_seen == created (beacon puro, sem avanço do cliente): ${soCreated}`);

  // quantas sessões distintas responderam ao menos 1 pergunta (quiz_answers)?
  const { data: ans } = await sb.from("quiz_answers").select("session_id").eq("funnel_slug", slug).gte("created_at", start);
  const respSessions = new Set((ans || []).map((a) => a.session_id));
  console.log(`\n  sessões DISTINTAS com quiz_answers (responderam de fato): ${respSessions.size}`);
  const { count: leadsCount } = await sb.from("funnel_leads").select("id", { count: "exact", head: true }).eq("funnel_slug", slug).gte("created_at", start);
  console.log(`  leads (funnel_leads) hoje: ${leadsCount}`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
