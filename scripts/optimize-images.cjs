/**
 * Otimiza as imagens PNG/JPG de um funil: redimensiona (max 1080px) + converte
 * pra webp, re-upa no Supabase Storage e troca as URLs no funil. O hero pesado
 * (LCP) some. Uso: node scripts/optimize-images.cjs <slug>
 */
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: node scripts/optimize-images.cjs <slug>");
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: funnel, error } = await sb.from("funnels").select("slug,settings,steps").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!funnel) throw new Error(`funil "${slug}" não encontrado`);

  let json = JSON.stringify({ settings: funnel.settings, steps: funnel.steps });
  // qualquer URL de storage do Supabase (o hero pode não ter extensão no nome);
  // filtra o que já é webp/svg/gif — o resto o sharp tenta converter.
  const re = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\\ )]+/gi;
  const matches = [...new Set((json.match(re) || []))].filter((u) => !/\.(webp|svg|gif)$/i.test(u));
  console.log(`Imagens PNG/JPG no funil: ${matches.length}`);
  if (!matches.length) { console.log("Nada a otimizar."); return; }

  let savedKb = 0;
  for (const url of matches) {
    try {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const origKb = Math.round(buf.length / 1024);
      const webp = await sharp(buf).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      const newKb = Math.round(webp.length / 1024);
      const pathPart = url.split("/storage/v1/object/public/")[1]; // vsl-assets/uploads/xxx
      const bucket = pathPart.split("/")[0];
      const objPath = pathPart.split("/").slice(1).join("/").replace(/\.(png|jpe?g)$/i, "") + ".webp";
      const up = await sb.storage.from(bucket).upload(objPath, webp, { contentType: "image/webp", upsert: true });
      if (up.error) { console.log(`  ⚠️ upload falhou (${objPath}): ${up.error.message}`); continue; }
      const newUrl = sb.storage.from(bucket).getPublicUrl(objPath).data.publicUrl;
      json = json.split(url).join(newUrl);
      savedKb += (origKb - newKb);
      console.log(`  ✓ ${origKb}KB → ${newKb}KB  ${objPath}`);
    } catch (e) { console.log(`  ⚠️ ${url.slice(-40)}: ${e.message}`); }
  }

  const updated = JSON.parse(json);
  const { error: upErr } = await sb.from("funnels").update({ settings: updated.settings, steps: updated.steps, updated_at: new Date().toISOString() }).eq("slug", slug);
  if (upErr) throw upErr;
  console.log(`✅ "${slug}" atualizado. Economia total: ~${savedKb} KB por carga.`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
