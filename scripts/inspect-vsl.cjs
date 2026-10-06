/** Dump da lâmina VSL de um funil layers: blocos + revealAt (reveal do botão do pitch). */
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
  const { data: f } = await sb.from("funnels").select("steps").eq("slug", slug).maybeSingle();
  const steps = f.steps || [];
  steps.forEach((s, i) => {
    const layers = s.layers || [];
    // é uma lâmina de VSL/vídeo? tem embed/video ou button com revealAt
    const isVsl = /vsl/i.test(s.type || "") || /vsl/i.test(s.id || "") || layers.some((l) => ["embed", "video"].includes(l.type)) || layers.some((l) => l.type === "button" && (l.content?.revealAt || l.content?.countdown));
    if (!isVsl) return;
    console.log(`\n■ Lâmina ${i} · id=${s.id} · type=${s.type} · disabled=${!!s.disabled}`);
    layers.forEach((l) => {
      const c = l.content || {};
      let extra = "";
      if (l.type === "button") extra = ` label="${c.label || ""}" revealAt=${c.revealAt ?? "(nenhum)"} countdown=${!!c.countdown} dest=${c.destination || c.type || ""}`;
      else if (["embed", "video"].includes(l.type)) extra = ` (player: ${(c.embedHtml || c.html || c.image?.src || "").slice(0, 40)}…)`;
      else if (l.type === "text") extra = ` "${(c.text || "").replace(/<[^>]+>/g, "").slice(0, 40)}"`;
      console.log(`   - ${l.type}${extra}`);
    });
  });
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
