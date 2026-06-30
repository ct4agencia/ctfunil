/** Diagnóstico de tracking: últimas sessões/eventos por funil + se anon consegue inserir. */
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
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const slug of ["cdb-tb1", "cdb-type01", "cdb-hero04-2"]) {
    const s = await admin.from("funnel_sessions").select("session_id,created_at,max_step_reached").eq("funnel_slug", slug).order("created_at", { ascending: false }).limit(3);
    const e = await admin.from("step_events").select("created_at,step_index").eq("funnel_slug", slug).order("created_at", { ascending: false }).limit(1);
    const cnt = await admin.from("funnel_sessions").select("session_id", { count: "exact", head: true }).eq("funnel_slug", slug);
    console.log(`\n■ ${slug}: ${cnt.count ?? "?"} sessões totais`);
    console.log(`  última sessão: ${s.data?.[0]?.created_at || "(nenhuma)"} (max_step ${s.data?.[0]?.max_step_reached ?? "-"})`);
    console.log(`  últimas 3:`, (s.data || []).map((r) => r.created_at).join("  |  ") || "(nenhuma)");
    console.log(`  último step_event: ${e.data?.[0]?.created_at || "(nenhum)"}`);
  }

  // Testa se a chave ANON consegue inserir (reproduz o 403 do client)
  console.log(`\n— Teste de INSERT com chave ANON (reproduz o client) —`);
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) { console.log("  (sem NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local)"); }
  else {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } });
    const testId = `diag-${Math.random().toString(36).slice(2, 8)}::diag`;
    const ins = await anon.from("funnel_sessions").upsert({ session_id: testId, funnel_slug: "diag", max_step_reached: 0 }, { onConflict: "session_id" });
    console.log(`  funnel_sessions upsert (anon): ${ins.error ? "❌ " + ins.error.code + " " + ins.error.message : "✅ OK"}`);
    const se = await anon.from("step_events").insert({ session_id: testId, funnel_slug: "diag", step_index: 0, step_id: "x", step_type: "diag" });
    console.log(`  step_events insert (anon):     ${se.error ? "❌ " + se.error.code + " " + se.error.message : "✅ OK"}`);
    const qa = await anon.from("quiz_answers").insert({ session_id: testId, funnel_slug: "diag", step_id: "x", question: "q", answer: "a" });
    console.log(`  quiz_answers insert (anon):    ${qa.error ? "❌ " + qa.error.code + " " + qa.error.message : "✅ OK"}`);
    // limpa o que conseguiu inserir
    await admin.from("step_events").delete().eq("session_id", testId);
    await admin.from("quiz_answers").delete().eq("session_id", testId);
    await admin.from("funnel_sessions").delete().eq("session_id", testId);
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
