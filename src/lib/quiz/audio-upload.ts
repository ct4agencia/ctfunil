/**
 * Regras únicas para o envio de áudio (som da roleta e bloco de áudio): as
 * mesmas no editor, que avisa antes de enviar, e na rota /api/upload, que
 * confere de novo no servidor. Não importa nada de servidor.
 */
export const AUDIO_LIMITE_BYTES = 2 * 1024 * 1024;
/** Duração máxima aceita no editor: um giro mais longo que isso cansa. */
export const AUDIO_DURACAO_MAXIMA = 15;

/** Extensões aceitas e o tipo servido para cada formato detectado. */
export const AUDIO_FORMATOS: Record<string, { extensoes: string[]; mime: string }> = {
  mp3: { extensoes: ["mp3"], mime: "audio/mpeg" },
  wav: { extensoes: ["wav"], mime: "audio/wav" },
  ogg: { extensoes: ["ogg", "oga", "opus"], mime: "audio/ogg" },
  m4a: { extensoes: ["m4a", "mp4"], mime: "audio/mp4" },
  aac: { extensoes: ["aac"], mime: "audio/aac" },
  webm: { extensoes: ["webm", "weba"], mime: "audio/webm" },
};
export const AUDIO_EXTENSOES = Object.values(AUDIO_FORMATOS).flatMap(f => f.extensoes);
export const AUDIO_ACCEPT = AUDIO_EXTENSOES.map(e => `.${e}`).join(",") + ",audio/*";

export function extensaoDe(nome: string) {
  return nome.split(".").pop()?.toLowerCase() ?? "";
}

export function pareceAudio(nome: string, tipo?: string) {
  return (tipo ?? "").toLowerCase().startsWith("audio/") || AUDIO_EXTENSOES.includes(extensaoDe(nome));
}

/**
 * Formato pela assinatura dos primeiros bytes, sem confiar no nome nem no tipo
 * informado pelo navegador. Devolve a chave de AUDIO_FORMATOS ou null.
 */
export function detectarFormatoAudio(b: Uint8Array): string | null {
  const ascii = (inicio: number, fim: number) => String.fromCharCode(...b.slice(inicio, fim));
  if (b.length < 12) return null;
  if (ascii(0, 3) === "ID3") return "mp3";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "aac"; // ADTS
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3"; // quadro MPEG
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(4, 8) === "ftyp") return "m4a";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

export const MENSAGENS_AUDIO = {
  formato: "Formato de áudio não aceito. Envie MP3, WAV, OGG, M4A, AAC ou WebM.",
  grande: `Áudio grande demais. O limite é ${AUDIO_LIMITE_BYTES / 1024 / 1024} MB: exporte em MP3 ou corte o arquivo.`,
  invalido: "O arquivo não parece ser um áudio válido. Exporte de novo em MP3 e tente outra vez.",
  longo: `O áudio passa de ${AUDIO_DURACAO_MAXIMA} s. Use um trecho mais curto: o giro mais longo cansa.`,
};
