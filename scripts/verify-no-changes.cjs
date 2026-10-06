/** Verifica se a auditoria deixou alguma alteração: lixo 'diag' + updated_at dos funis. */
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
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1) sobrou algum lixo do diagnóstico (funnel_slug='diag')?
  for (const tbl of ["funnel_sessions", "step_events", "quiz_answers"]) {
    const r = await sb.from(tbl).select("*", { count: "exact", head: true }).eq("funnel_slug", "diag");
    console.log(`  ${tbl} com funnel_slug='diag': ${r.count ?? "?"}`);
  }

  // 2) updated_at dos funis (pra ver o que foi tocado e quando)
  const { data } = await sb.from("funnels").select("slug,name,updated_at").order("updated_at", { ascending: false }).limit(20);
  console.log(`\n  Funis por updated_at (mais recente primeiro):`);
  for (const f of data || []) console.log(`    ${f.updated_at}  ${f.slug}  (${f.name})`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
