/** Relatório de leads que chegaram HOJE (BRT) em todos os funis. */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
function brt(iso) { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }); }
async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // meia-noite de hoje em BRT (UTC-3) → 03:00Z
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const midnightBrt = new Date(brtNow.getFullYear(), brtNow.getMonth(), brtNow.getDate(), 0, 0, 0);
  const startUtc = new Date(midnightBrt.getTime() + 3 * 3600 * 1000).toISOString(); // BRT→UTC
  const { data, error } = await sb.from("funnel_leads").select("funnel_slug,name,phone,created_at,utm_source,utm_campaign,src").gte("created_at", startUtc).order("created_at", { ascending: true });
  if (error) throw error;
  console.log(`LEADS DE HOJE (desde 00:00 BRT) — total: ${data.length}\n`);
  const byFunnel = {};
  for (const l of data) { (byFunnel[l.funnel_slug] ||= []).push(l); }
  for (const slug of Object.keys(byFunnel).sort((a, b) => byFunnel[b].length - byFunnel[a].length)) {
    const list = byFunnel[slug];
    console.log(`■ ${slug}  (${list.length} leads)`);
    for (const l of list) {
      const camp = (l.utm_campaign || l.src || l.utm_source || "").toString().slice(0, 48);
      console.log(`   ${brt(l.created_at)}  ${(l.name || "—").slice(0, 24).padEnd(24)}  ${(l.phone || "—").padEnd(13)}  ${camp}`);
    }
    console.log("");
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
