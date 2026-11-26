/**
 * Validação única dos links de clique configurados no construtor (botão do
 * popup da roleta e, por extensão, outros botões que levam para fora do funil).
 *
 * Aceita só HTTPS, sem usuário e senha na URL: um `javascript:` ou `data:`
 * gravado no funil nunca vira destino de clique. Para links do WhatsApp sem
 * mensagem, acrescenta a mensagem pronta configurada (o tratamento que antes
 * só existia na página fixa do /upbf1).
 *
 * Roda no navegador e no servidor (não importa nada de servidor).
 */
export type MotivoLinkInvalido = "invalido" | "http" | "credenciais";

const WHATSAPP_HOSTS = new Set(["wa.me", "api.whatsapp.com", "whatsapp.com", "www.whatsapp.com"]);

export function ehLinkWhatsapp(url: URL) {
  return WHATSAPP_HOSTS.has(url.hostname.toLowerCase());
}

export function checarLink(input?: string | null): { ok: true; url: URL } | { ok: false; motivo: MotivoLinkInvalido } | null {
  const texto = input?.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, motivo: "invalido" };
  }
  if (url.protocol === "http:") return { ok: false, motivo: "http" };
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return { ok: false, motivo: "invalido" };
  if (url.username || url.password) return { ok: false, motivo: "credenciais" };
  return { ok: true, url };
}

/** Destino pronto para o clique, ou `undefined` quando o link falta ou não é seguro. */
export function linkSeguro(input?: string | null, mensagemWhatsapp?: string | null): string | undefined {
  const resultado = checarLink(input);
  if (!resultado?.ok) return;
  const { url } = resultado;
  const mensagem = mensagemWhatsapp?.trim();
  if (mensagem && ehLinkWhatsapp(url) && !url.searchParams.has("text")) url.searchParams.set("text", mensagem);
  return url.href;
}

/** Mensagem do editor para um link recusado: o que houve e como corrigir. */
export function mensagemLinkInvalido(motivo: MotivoLinkInvalido) {
  if (motivo === "http") return "Este link começa com http://, que não é seguro. Troque por https://.";
  if (motivo === "credenciais") return "Este link tem usuário ou senha dentro dele. Use um link sem login, que comece com https://.";
  return "Link inválido. Use o endereço completo, começando com https://, como https://wa.me/5511999999999.";
}
