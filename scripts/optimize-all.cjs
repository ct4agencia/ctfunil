/**
 * Roda a otimização de imagens (PNG/JPG → webp, max 1080px) em TODOS os funis.
 * Reupa no Supabase Storage e troca as URLs. Idempotente (pula webp já feito).
 * Uso: node scripts/optimize-all.cjs
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

const cacheOpt = new Map(); // url original → url webp (evita reprocessar a mesma imagem entre funis)

async function optimizeFunnel(sb, slug) {
  const { data: funnel } = await sb.from("funnels").select("slug,name,settings,steps,logo").eq("slug", slug).maybeSingle();
  if (!funnel) return { slug, saved: 0, imgs: 0, err: "não encontrado" };
  let json = JSON.stringify({ settings: funnel.settings, steps: funnel.steps, logo: funnel.logo ?? null });
  // imagens no Supabase Storage OU no CDN do inlead; ignora áudio/webp/svg/gif
  const re = /(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\\ )]+|https:\/\/media\.inlead\.cloud\/[^"'\\ )]+)/gi;
  const matches = [...new Set((json.match(re) || []))].filter((u) => !/\.(webp|svg|gif|ogg|mp3|mp4|webm|m4a|wav)(\?|$)/i.test(u));
  if (!matches.length) return { slug, saved: 0, imgs: 0 };

  let saved = 0, imgs = 0;
  for (const url of matches) {
    try {
      if (cacheOpt.has(url)) { const nu = cacheOpt.get(url); if (nu !== url) json = json.split(url).join(nu); imgs++; continue; }
      const resp = await fetch(url);
      if (!resp.ok || !/^image\//.test(resp.headers.get("content-type") || "")) { cacheOpt.set(url, url); continue; }
      const buf = Buffer.from(await resp.arrayBuffer());
      const origKb = Math.round(buf.length / 1024);
      if (origKb < 60) { cacheOpt.set(url, url); continue; } // já é leve, não mexe
      const webp = await sharp(buf).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      if (webp.length >= buf.length) { cacheOpt.set(url, url); continue; } // não piora
      const newKb = Math.round(webp.length / 1024);
      // destino: mesmo bucket/pasta se for Supabase; senão vsl-assets/uploads/opt-<nome> (inlead)
      let bucket, objPath;
      if (url.includes("/storage/v1/object/public/")) {
        const pathPart = url.split("/storage/v1/object/public/")[1];
        bucket = pathPart.split("/")[0];
        objPath = pathPart.split("/").slice(1).join("/").replace(/\.(png|jpe?g)$/i, "") + ".webp";
      } else {
        bucket = "vsl-assets";
        const nameRaw = url.split("/").pop().split("?")[0].replace(/\.(png|jpe?g)$/i, "");
        const name = nameRaw.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60);
        objPath = `uploads/opt-${name}.webp`;
      }
      const up = await sb.storage.from(bucket).upload(objPath, webp, { contentType: "image/webp", upsert: true });
      if (up.error) { cacheOpt.set(url, url); continue; }
      const newUrl = sb.storage.from(bucket).getPublicUrl(objPath).data.publicUrl;
      cacheOpt.set(url, newUrl);
      json = json.split(url).join(newUrl);
      saved += (origKb - newKb); imgs++;
    } catch { /* pula imagem problemática */ }
  }
  if (!imgs) return { slug, saved: 0, imgs: 0 };
  const updated = JSON.parse(json);
  await sb.from("funnels").update({ settings: updated.settings, steps: updated.steps, logo: updated.logo ?? null, updated_at: new Date().toISOString() }).eq("slug", slug);
  return { slug, name: funnel.name, saved, imgs };
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: funnels } = await sb.from("funnels").select("slug").order("updated_at", { ascending: false });
  console.log(`Funis: ${funnels.length}\n`);
  let total = 0, totalImgs = 0;
  for (const f of funnels) {
    const r = await optimizeFunnel(sb, f.slug);
    total += r.saved; totalImgs += r.imgs;
    const tag = r.err ? `⚠️ ${r.err}` : r.imgs ? `✓ ${r.imgs} img · -${r.saved}KB` : "· (sem imagens Supabase)";
    console.log(`  ${f.slug.padEnd(22)} ${tag}`);
  }
  console.log(`\n✅ Concluído. ${totalImgs} imagens otimizadas · economia total ~${(total / 1024).toFixed(1)} MB por carga.`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
