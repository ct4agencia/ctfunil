/**
 * Endereço público de um funil, o mesmo em todas as telas (construtor,
 * dashboard, relatório, projetos).
 *
 * Com domínio cadastrado, é `https://{domínio}/{slug}`. Sem domínio, é
 * `/q/{slug}` no host atual: o `/{slug}` de um segmento só cai no funil nos
 * domínios dos funis, e no painel oficial o proxy o manda para "não
 * encontrado" (src/proxy.ts).
 */
export function funnelDomain(domain?: string | null): string | undefined {
  const host = domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : undefined;
}

export function funnelPublicUrl(funnel: { slug: string; domain?: string | null }): string {
  const domain = funnelDomain(funnel.domain);
  const slug = encodeURIComponent(funnel.slug);
  return domain ? `https://${domain}/${slug}` : `/q/${slug}`;
}

/** O mesmo endereço sem o protocolo, para mostrar como texto. */
export function funnelPublicLabel(funnel: { slug: string; domain?: string | null }): string {
  return funnelPublicUrl(funnel).replace(/^https:\/\//, "");
}
