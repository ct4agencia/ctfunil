/**
 * Janela de datas do painel — fonte ÚNICA.
 *
 * A mesma lógica vivia solta em dois lugares (`LayersBuilder.tsx:668` e
 * `VslDetail.tsx:35`), com presets parecidos mas não idênticos, e um terceiro
 * consumidor — `/dashboard/[slug]` — simplesmente não tinha filtro, apesar de a
 * tela dizer "Troque o período acima" quando não havia visitas.
 *
 * FUSO: tudo é ancorado no dia civil de São Paulo, não em UTC. Isso já quebrou
 * em produção: com UTC, das 21h à meia-noite o dia já virou lá fora, então
 * "Hoje" pedia o dia SEGUINTE e a tela voltava vazia (medido: 3 de 6 horários
 * testados devolviam o dia errado). O Brasil não tem horário de verão desde
 * 2019, então o offset fixo -03:00 é seguro.
 */

/** Data yyyy-mm-dd no fuso de São Paulo (offset em dias: 0 = hoje, 1 = ontem). */
export const spYmd = (offsetDays = 0): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() - offsetDays * 86400000));

/** Limites UTC de um dia (00:00–23:59.999) no fuso BR. */
export const dayBounds = (ymd: string): { from: string; to: string } => ({
  from: new Date(`${ymd}T00:00:00.000-03:00`).toISOString(),
  to: new Date(`${ymd}T23:59:59.999-03:00`).toISOString(),
});

/** Últimos N dias corridos, contados a partir de agora. */
export const sinceDays = (n: number): { from: string } => ({ from: new Date(Date.now() - n * 86400000).toISOString() });

export interface Janela { from?: string; to?: string }

export const PERIODOS: { key: string; label: string; make: () => Janela }[] = [
  { key: "tudo", label: "Tudo", make: () => ({}) },
  { key: "hoje", label: "Hoje", make: () => dayBounds(spYmd(0)) },
  { key: "ontem", label: "Ontem", make: () => dayBounds(spYmd(1)) },
  { key: "7d", label: "7 dias", make: () => sinceDays(7) },
  { key: "30d", label: "30 dias", make: () => sinceDays(30) },
];

/**
 * Resolve o período vindo da URL (`?p=hoje` ou `?p=dia&d=2026-08-07`).
 *
 * Chave desconhecida cai em "tudo" em vez de lançar: a URL é editável pelo
 * usuário e um período inválido não pode derrubar a página de métricas.
 */
export function janelaDeChave(key?: string, dia?: string): { key: string; janela: Janela } {
  if (key === "dia" && dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return { key: "dia", janela: dayBounds(dia) };
  }
  const p = PERIODOS.find((x) => x.key === key);
  return p ? { key: p.key, janela: p.make() } : { key: "tudo", janela: {} };
}

/** Rótulo humano do período — usado no cabeçalho e no aviso de estado vazio. */
export function rotuloDoPeriodo(key: string, dia?: string): string {
  if (key === "dia" && dia) {
    const [a, m, d] = dia.split("-");
    return `${d}/${m}/${a}`;
  }
  return PERIODOS.find((x) => x.key === key)?.label ?? "Tudo";
}
