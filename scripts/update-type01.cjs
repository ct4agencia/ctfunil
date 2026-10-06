/**
 * cdb-type01: (1) troca foto da bolsa (ETAPA 01) e imagem da PERGUNTA 6;
 * (2) garante "wait" proporcional entre TODAS as mensagens consecutivas.
 * Uso: node scripts/update-type01.cjs [apply]
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
const BAG = "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/1782955740579-bolsa_croche_sonia_b9d4b4fd570b375760758ef5d732c408.webp";
const P6 = "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/1782955741621-bolsa_croche_sonia_videoframe_0.webp";
const BUBBLE = new Set(["text", "image", "voice", "audio", "video", "embed", "document", "link", "location", "contact", "call", "system", "date"]);
const genId = () => `w${Math.random().toString(36).slice(2, 9)}`;
const chars = (r) => [...(r || "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim()].length;
const seg = (n) => Math.min(4.5, Math.max(0.8, Math.round((0.5 + n / 35) * 10) / 10));
const waitFor = (b) => (b.type === "text" ? seg(chars(b.richText)) : 1.2);

async function main() {
  const apply = process.argv[2] === "apply";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: f } = await sb.from("funnels").select("settings").eq("slug", "cdb-type01").maybeSingle();
  const tb = f.settings.typebot;

  // 1) trocar imagens (por grupo)
  for (const g of tb.groups) {
    for (const b of g.blocks) {
      if (b.type !== "image") continue;
      if (/ETAPA 01/i.test(g.title)) { console.log(`  🖼️ ETAPA 01: bolsa → b9d4b4fd`); b.url = BAG; }
      if (/PERGUNTA 6/i.test(g.title)) { console.log(`  🖼️ PERGUNTA 6: imagem → videoframe_0`); b.url = P6; }
    }
  }

  // 2) waits proporcionais entre bolhas consecutivas (em todos os grupos)
  let added = 0, resized = 0;
  for (const g of tb.groups) {
    const src = g.blocks || [];
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const b = src[i]; out.push(b);
      const next = src[i + 1];
      if (!next || !BUBBLE.has(b.type)) continue;
      if (next.type === "wait") { next.seconds = waitFor(b); resized++; }
      else if (BUBBLE.has(next.type)) { out.push({ id: genId(), type: "wait", seconds: waitFor(b) }); added++; }
    }
    g.blocks = out;
  }
  console.log(`\n  waits: ${added} adicionados · ${resized} reajustados`);

  if (apply) {
    const settings = { ...f.settings, typebot: tb };
    const { error } = await sb.from("funnels").update({ settings, updated_at: new Date().toISOString() }).eq("slug", "cdb-type01");
    if (error) throw error;
    console.log("✅ aplicado no cdb-type01");
  } else {
    console.log("(dry-run — rode com 'apply')");
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
