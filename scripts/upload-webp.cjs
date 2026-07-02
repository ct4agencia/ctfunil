/** Converte arquivos locais pra webp (max 1080px) e sobe no Supabase. Imprime URLs.
 *  Uso: node scripts/upload-webp.cjs "<arquivo1>" "<arquivo2>" ... */
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const { readFileSync, existsSync } = require("node:fs");
const { join, basename, extname } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("passe os arquivos");
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const file of files) {
    if (!existsSync(file)) { console.log(`⚠️ não existe: ${file}`); continue; }
    const buf = readFileSync(file);
    const webp = await sharp(buf).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const name = basename(file, extname(file)).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60);
    const objPath = `uploads/${Date.now()}-${name}.webp`;
    const up = await sb.storage.from("vsl-assets").upload(objPath, webp, { contentType: "image/webp", upsert: true });
    if (up.error) { console.log(`❌ ${name}: ${up.error.message}`); continue; }
    const url = sb.storage.from("vsl-assets").getPublicUrl(objPath).data.publicUrl;
    console.log(`✓ ${Math.round(buf.length / 1024)}KB → ${Math.round(webp.length / 1024)}KB  ${name}`);
    console.log(`  ${url}`);
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
