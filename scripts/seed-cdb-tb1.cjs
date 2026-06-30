/**
 * Seed do funil typebot "CDB [BOLSAS] - WHATSAPP" no Supabase com slug fixo cdb-tb1.
 * O builder canônico é TS (src/lib/quiz/typebot/cdb-whatsapp.ts); aqui usamos a
 * versão compilada em scripts/.tmp (CommonJS). Espelha o branch typebot de funnelFromPreset.
 *
 * Rodar:
 *   npx tsc src/lib/quiz/typebot/types.ts src/lib/quiz/typebot/cdb-whatsapp.ts --outDir scripts/.tmp --module commonjs --target es2020 --skipLibCheck
 *   node scripts/seed-cdb-tb1.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { cdbWhatsappTypebot } = require("./.tmp/cdb-whatsapp.js");

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
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const SLUG = "cdb-tb1";

  const existing = await sb.from("funnels").select("slug").eq("slug", SLUG).maybeSingle();
  if (existing.data) console.log(`⚠️  Já existe "${SLUG}". Vou sobrescrever (upsert) o conteúdo typebot.`);

  const tb = cdbWhatsappTypebot();
  const row = {
    slug: SLUG,
    name: "CDB [BOLSAS] - WHATSAPP",
    niche: "",
    logo: null,
    palette_id: "laranja-cdb",
    steps: [],
    status: "published",
    updated_at: new Date().toISOString(),
    font: "poppins",
    music: null,
    click_sound: false,
    domain: null,
    settings: { engine: "typebot", typebot: tb },
    utmify_pixel_id: null,
    hotmart_account_id: null,
    hotmart_product_id: null,
    checkout_url: null,
    webhooks: [],
  };

  let { error } = await sb.from("funnels").upsert(row, { onConflict: "slug" });
  if (error && /column .* does not exist|could not find|schema cache|PGRST204|42703/i.test(error.message || error.code || "")) {
    // migração 0010 ainda não rodou — salva só as colunas base.
    ({ error } = await sb.from("funnels").upsert(
      { slug: row.slug, name: row.name, niche: row.niche, logo: row.logo, palette_id: row.palette_id, steps: row.steps, status: "published", updated_at: row.updated_at, settings: row.settings },
      { onConflict: "slug" },
    ));
  }
  if (error) throw error;

  console.log(`✅ Funil "${SLUG}" criado/atualizado no Supabase.`);
  console.log(`   Construtor: /builder/${SLUG}`);
  console.log(`   Ao vivo:    /${SLUG}`);
  console.log(`   Grupos: ${tb.groups.length} · Variáveis: ${tb.variables.join(", ")}`);
}

main().catch((e) => { console.error("❌ Falhou:", e.message || e); process.exit(1); });
