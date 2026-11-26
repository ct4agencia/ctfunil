import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AUDIO_FORMATOS, AUDIO_LIMITE_BYTES, MENSAGENS_AUDIO, detectarFormatoAudio, extensaoDe, pareceAudio } from "@/lib/quiz/audio-upload";

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

  // Áudio (som da roleta, bloco de áudio): formato pela assinatura do arquivo,
  // não pelo nome nem pelo tipo que o navegador diz; tamanho limitado; o tipo
  // servido sai do formato detectado. Mesmas regras que o editor avisa antes.
  if (pareceAudio(file.name, file.type)) {
    if (file.size > AUDIO_LIMITE_BYTES) return NextResponse.json({ error: MENSAGENS_AUDIO.grande }, { status: 413 });
    const inicio = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const formato = detectarFormatoAudio(inicio);
    if (!formato) return NextResponse.json({ error: MENSAGENS_AUDIO.invalido }, { status: 415 });
    const { extensoes, mime } = AUDIO_FORMATOS[formato];
    const extensao = extensoes.includes(extensaoDe(file.name)) ? extensaoDe(file.name) : extensoes[0];
    const base = file.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "audio";
    path = `uploads/audio/${Date.now()}-${base}.${extensao}`;
    contentType = mime;
  }

  // Imagens raster → webp otimizado (max 1080px). Mantém o funil rápido: um PNG
  // de 1MB do ChatGPT vira ~90KB webp automaticamente. Áudio/vídeo/svg passam direto.
  //
  // O `sharp` é carregado AQUI DENTRO, não no topo do arquivo. Ele é um módulo
  // nativo: o binário do Windows entra no lockfile na máquina de desenvolvimento
  // e na Vercel (linux-x64) o carregamento falhava com
  // `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3`. Como o import estava no topo, a
  // rota morria ANTES do handler rodar — o navegador recebia um 500 sem corpo,
  // e o construtor mostrava "falha no upload" sem dizer o porquê.
  // Com o import dentro do try, uma otimização indisponível custa alguns KB a
  // mais no arquivo; nunca mais custa o upload inteiro.
  if (/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    try {
      const { default: sharp } = await import("sharp");
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
