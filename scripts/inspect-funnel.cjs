/** Inspeciona a estrutura typebot de um funil. Uso: node scripts/inspect-funnel.cjs <slug> */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

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

async function main() {
  const slug = process.argv[2] || "cdb-type01";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.from("funnels").select("slug,name,settings").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) { console.log(`Funil "${slug}" não encontrado.`); return; }
  console.log(`Funil: ${data.name} (${data.slug})`);
  const tb = data.settings?.typebot;
  if (!tb) { console.log("⚠️ Não é typebot (sem settings.typebot)."); console.log(JSON.stringify(data.settings, null, 2).slice(0, 500)); return; }
  console.log(`startGroup: ${tb.startGroup} · grupos: ${tb.groups.length}`);
  for (const g of tb.groups) {
    console.log(`\n■ [${g.id}] "${g.title}"  → to: ${g.to || "(fim)"}`);
    for (const b of g.blocks) {
      let extra = "";
      if (b.type === "embed") extra = ` html=${(b.html || "").slice(0, 70).replace(/\n/g, " ")}…`;
      else if (b.type === "redirect") extra = ` url=${b.url}`;
      else if (b.type === "vsl") extra = ` checkout=${b.checkoutUrl} embed?${!!b.embedHtml}`;
      else if (b.type === "text") extra = ` "${(b.richText || "").slice(0, 40)}"`;
      else if (b.type === "input-choice") extra = ` [${(b.items || []).map((i) => i.label).join(" / ").slice(0, 40)}]`;
      console.log(`    - ${b.type}${extra}`);
    }
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
