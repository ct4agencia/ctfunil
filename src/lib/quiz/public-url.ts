/**
 * Endereço público de um funil, o mesmo em todas as telas (construtor,
 * dashboard, relatório, projetos).
 *
 * Com domínio próprio, é `https://{domínio}/{slug}`. Sem domínio, é
 * `/q/{slug}` no host atual: o `/{slug}` de um segmento só cai no funil nos
 * domínios dos funis, e no painel oficial o proxy o manda para "não
 * encontrado" (src/proxy.ts).
 *
 * Funil cujo domínio é o próprio painel (o `upbf1` e as cópias dele, porque o
 * "Duplicar" leva o domínio junto) também abre em `/q/{slug}`: o
 * `ctfunil.vercel.app/upbf1-v3` dava "Página não encontrada" (26/11).
 */
const HOSTS_DO_PAINEL = new Set(["ctfunil.vercel.app", "ctfunil-agencia-ct4s-projects.vercel.app"]);

export function funnelDomain(domain?: string | null): string | undefined {
  const host = domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : undefined;
}

/** Domínio próprio do funil (não o painel): lá a página roda outro deploy e atualiza com atraso. */
export function funnelDominioProprio(domain?: string | null): string | undefined {
  const host = funnelDomain(domain);
  return host && !HOSTS_DO_PAINEL.has(host) ? host : undefined;
}

/**
 * Desde 26/11 (pedido do Luca), o painel serve qualquer funil publicado em
 * `/{slug}`, com cache: é a "URL padrão do CTFunil". O `/q/{slug}` é a prévia
 * sem cache, para ver o funil como está salvo agora.
 */
export const HOST_PADRAO = "ctfunil.vercel.app";

/** URL padrão do CTFunil (com cache). */
export function funnelUrlPadrao(slug: string): string {
  return `https://${HOST_PADRAO}/${encodeURIComponent(slug)}`;
}

/** URL no domínio próprio do funil, quando há. */
export function funnelUrlDominio(funnel: { slug: string; domain?: string | null }): string | undefined {
  const dominio = funnelDominioProprio(funnel.domain);
  return dominio ? `https://${dominio}/${encodeURIComponent(funnel.slug)}` : undefined;
}

/** Prévia sem cache: o funil como está salvo agora (sempre no painel). */
export function funnelUrlPrevia(slug: string): string {
  return `https://${HOST_PADRAO}/q/${encodeURIComponent(slug)}`;
}

/** Endereço público principal: o domínio próprio, se houver; senão, a URL padrão do CTFunil. */
export function funnelPublicUrl(funnel: { slug: string; domain?: string | null }): string {
  return funnelUrlDominio(funnel) ?? funnelUrlPadrao(funnel.slug);
}

/** O mesmo endereço sem o protocolo, para mostrar como texto. */
export function funnelPublicLabel(funnel: { slug: string; domain?: string | null }): string {
  return funnelPublicUrl(funnel).replace(/^https:\/\//, "");
}
