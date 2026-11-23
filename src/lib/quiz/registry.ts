import type { Funnel } from "./types";
import { clubeDasBolsas } from "./funnels/clube-das-bolsas";

/**
 * Registro de funis (seed). Na Fase B isto vem do Supabase (tabela `funnels`),
 * permitindo criar/duplicar/configurar pelo admin. Por enquanto, seeds em código.
 *
 * NOTA: os 4 cdb-estado1..4 NÃO entram aqui de propósito — vivem no banco em
 * formato `layers` (clone 1:1). O typed em `funnels/cdb-estado.ts` ficou obsoleto
 * (gerado por engano noutro motor) e foi desligado pra não servir de fallback
 * com visual divergente.
 */
const FUNNELS: Funnel[] = [clubeDasBolsas];

export function getFunnel(slug: string): Funnel | undefined {
  return FUNNELS.find((f) => f.slug === slug);
}

export function listFunnels(): Funnel[] {
  return FUNNELS;
}
