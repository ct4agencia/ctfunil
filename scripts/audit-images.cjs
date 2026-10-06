/** Lista todas as imagens (qualquer host) usadas nos funis + tamanho, ordenado por peso. */
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
  const { data: funnels } = await sb.from("funnels").select("slug,settings,steps");
  const urlToFunnels = new Map();
  for (const f of funnels) {
    const json = JSON.stringify({ s: f.settings, t: f.steps });
    const urls = json.match(/https:\/\/[^"'\\ )]+\.(png|jpe?g|webp)|https:\/\/media\.inlead\.cloud\/[^"'\\ )]+|https:\/\/[a-z0-9]+\.supabase\.co\/storage\/[^"'\\ )]+/gi) || [];
    for (const u of new Set(urls)) { if (!urlToFunnels.has(u)) urlToFunnels.set(u, new Set()); urlToFunnels.get(u).add(f.slug); }
  }
  const rows = [];
  for (const [u, slugs] of urlToFunnels) {
    let kb = 0, type = "?";
    try { const r = await fetch(u, { method: "GET" }); const b = Buffer.from(await r.arrayBuffer()); kb = Math.round(b.length / 1024); type = r.headers.get("content-type") || "?"; } catch { kb = -1; }
    rows.push({ u, kb, type, n: slugs.size, host: u.split("/")[2] });
  }
  rows.sort((a, b) => b.kb - a.kb);
  console.log(`Imagens distintas: ${rows.length}\n`);
  for (const r of rows) {
    if (r.kb < 100 && !/png|jpeg/.test(r.type)) continue; // foca no que pesa
    console.log(`  ${String(r.kb).padStart(5)}KB  ${r.type.padEnd(12)} x${r.n}  ${r.host}  ${r.u.split("/").pop().slice(0, 34)}`);
  }
  const heavy = rows.filter((r) => r.kb > 150);
  console.log(`\n>150KB: ${heavy.length} imagens · soma ${(heavy.reduce((a, r) => a + r.kb, 0) / 1024).toFixed(1)} MB`);
  const inleadHeavy = heavy.filter((r) => /inlead/.test(r.host));
  console.log(`  dessas, no inlead CDN: ${inleadHeavy.length} · ${(inleadHeavy.reduce((a, r) => a + r.kb, 0) / 1024).toFixed(1)} MB`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
