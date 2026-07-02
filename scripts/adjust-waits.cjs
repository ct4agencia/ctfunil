/**
 * Ajusta os blocos "wait" de um funil typebot: cada esperar vira proporcional ao
 * nº de caracteres da mensagem de TEXTO imediatamente ANTERIOR (tempo de leitura).
 * Curta = pausa curta; longa = pausa longa. Uso: node scripts/adjust-waits.cjs <slug> [apply]
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
// nº de caracteres visíveis (tira **negrito**, mantém emoji como 1)
function chars(rich) { return [...(rich || "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim()].length; }
// fórmula: curta ~0,8s · média (~50) ~1,9s · longa (~113) ~3,7s
function segundos(n) { const s = 0.5 + n / 35; return Math.min(4.5, Math.max(0.8, Math.round(s * 10) / 10)); }

async function main() {
  const slug = process.argv[2] || "cdb-type01";
  const apply = process.argv[3] === "apply";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: f } = await sb.from("funnels").select("settings").eq("slug", slug).maybeSingle();
  const tb = f.settings?.typebot;
  if (!tb) { console.log("não é typebot"); return; }

  let n = 0;
  for (const g of tb.groups) {
    const blocks = g.blocks || [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type !== "wait") continue;
      // acha o texto mais próximo ANTES desse wait, no mesmo grupo
      let prevText = null;
      for (let j = i - 1; j >= 0; j--) { if (blocks[j].type === "text") { prevText = blocks[j]; break; } }
      const c = prevText ? chars(prevText.richText) : 0;
      const old = b.seconds;
      const nov = prevText ? segundos(c) : 1.2;
      const snip = prevText ? [...prevText.richText.replace(/\*\*/g, "")].slice(0, 32).join("") : "(sem texto antes)";
      console.log(`  ${g.title.slice(0, 18).padEnd(18)} | ${String(c).padStart(3)} car | ${old}s → ${nov}s | "${snip}…"`);
      b.seconds = nov; n++;
    }
  }
  console.log(`\n${n} blocos "wait" recalculados.`);
  if (apply) {
    const settings = { ...f.settings, typebot: tb };
    const { error } = await sb.from("funnels").update({ settings, updated_at: new Date().toISOString() }).eq("slug", slug);
    if (error) throw error;
    console.log("✅ aplicado no funil " + slug);
  } else {
    console.log("(dry-run — rode com 'apply' pra salvar)");
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
