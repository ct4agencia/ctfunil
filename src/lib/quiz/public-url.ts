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

export function funnelPublicUrl(funnel: { slug: string; domain?: string | null }): string {
  const domain = funnelDomain(funnel.domain);
  const slug = encodeURIComponent(funnel.slug);
  if (!domain) return `/q/${slug}`;
  return HOSTS_DO_PAINEL.has(domain) ? `https://${domain}/q/${slug}` : `https://${domain}/${slug}`;
}

/** O mesmo endereço sem o protocolo, para mostrar como texto. */
export function funnelPublicLabel(funnel: { slug: string; domain?: string | null }): string {
  return funnelPublicUrl(funnel).replace(/^https:\/\//, "");
}
