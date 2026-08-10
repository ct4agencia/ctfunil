import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const BUCKET = "vsl-assets";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // Só o admin autenticado pode subir arquivos.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (!adminEmail || user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "img";
  let path = `uploads/${Date.now()}-${safe}`;
  let body: File | Buffer = file;
  let contentType = file.type || undefined;

  // Imagens raster → webp otimizado (max 1080px). Mantém o funil rápido: um PNG
  // de 1MB do ChatGPT vira ~90KB webp automaticamente. Áudio/vídeo/svg passam direto.
  if (/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const webp = await sharp(buf).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      if (webp.length < buf.length) {
        body = webp;
        contentType = "image/webp";
        path = `uploads/${Date.now()}-${safe.replace(/\.(png|jpe?g|webp)$/i, "")}.webp`;
      }
    } catch { /* fallback: sobe o original */ }
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    // Sem isto o Storage serve `cache-control: no-cache` e o navegador revalida
    // a imagem do hero em TODA visita — medido em produção no cdb-01
    // (cdb01-bolsas-bg.webp, 124 KB, no-cache). O caminho embute `Date.now()`,
    // então o conteúdo nunca muda sob o mesmo nome: cache de um ano é seguro.
    cacheControl: "31536000",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
