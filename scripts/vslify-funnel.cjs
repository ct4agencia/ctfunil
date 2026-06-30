/**
 * Converte o grupo terminal (embed VTurb + redirect) de um funil typebot
 * num único bloco "vsl" (repaginação no mesmo domínio), PRESERVANDO o embed
 * do player e a URL de checkout. Idempotente: se já houver bloco vsl, não duplica.
 *
 * Uso: node scripts/vslify-funnel.cjs <slug>
 */
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
const genId = () => `b${Math.random().toString(36).slice(2, 9)}`;

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: node scripts/vslify-funnel.cjs <slug>");
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data, error } = await sb.from("funnels").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Funil "${slug}" não encontrado.`);
  const tb = data.settings?.typebot;
  if (!tb) throw new Error("Não é typebot (sem settings.typebot).");

  let changed = 0;
  const groups = tb.groups.map((g) => {
    const hasRedirect = g.blocks.some((b) => b.type === "redirect");
    const hasVsl = g.blocks.some((b) => b.type === "vsl");
    if (!hasRedirect || hasVsl) return g; // só o grupo terminal com redirect (e ainda não convertido)

    const embed = g.blocks.find((b) => b.type === "embed");
    const redirect = g.blocks.find((b) => b.type === "redirect");
    const embedHtml = embed ? (embed.html || "") : "";
    const checkoutUrl = redirect ? (redirect.url || "") : "";

    const vsl = {
      id: genId(),
      type: "vsl",
      barText: "⚠️ ATENÇÃO: ESTE VÍDEO SAI DO AR EM BREVE",
      title: "Assista o vídeo abaixo e veja como ativar sua Bolsa de Estudos 👇",
      embedHtml,
      pitchRevealAt: 8,
      ctaText: "QUERO ATIVAR MINHA BOLSA AGORA",
      checkoutUrl,
      background: "#ffffff",
    };
    // mantém quaisquer blocos que não sejam embed/redirect; insere o vsl no lugar.
    const kept = g.blocks.filter((b) => b.type !== "embed" && b.type !== "redirect");
    changed++;
    console.log(`  ✓ grupo [${g.id}] "${g.title}": embed?${!!embedHtml} checkout=${checkoutUrl || "(vazio)"} → bloco vsl`);
    return { ...g, title: g.title === "Redirect" ? "VSL - Ativar Bolsa" : g.title, blocks: [...kept, vsl] };
  });

  if (!changed) { console.log("Nada a converter (nenhum grupo com redirect, ou já tem vsl)."); return; }

  const newSettings = { ...data.settings, typebot: { ...tb, groups } };
  const { error: upErr } = await sb.from("funnels")
    .update({ settings: newSettings, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (upErr) throw upErr;

  console.log(`✅ "${slug}" convertido: ${changed} grupo(s) → VSL (repaginação no mesmo domínio). Embed e checkout preservados.`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
