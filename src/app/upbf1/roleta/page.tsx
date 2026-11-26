import { redirect } from "next/navigation";

/**
 * Endereço antigo da página fixa do /upbf1 (presell → /upbf1/roleta), que saiu
 * em 25/11/2026: o upbf1 passou a ser um funil normal do construtor, servido
 * em /upbf1. Quem chegar pelo link antigo vai para o funil, com as UTMs.
 * Pode sair quando a campanha da Black Friday acabar.
 */
export default async function RoletaAntiga({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) consulta.append(chave, item);
  }
  redirect(`/upbf1${consulta.size ? `?${consulta}` : ""}`);
}
