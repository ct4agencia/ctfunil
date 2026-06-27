import type { Funnel } from "./types";
import { clubeDasBolsas } from "./funnels/clube-das-bolsas";
import { cdbEstadoFunnels } from "./funnels/cdb-estado";

/**
 * Registro de funis (seed). Na Fase B isto vem do Supabase (tabela `funnels`),
 * permitindo criar/duplicar/configurar pelo admin. Por enquanto, seeds em código.
 */
const FUNNELS: Funnel[] = [clubeDasBolsas, ...cdbEstadoFunnels];

export function getFunnel(slug: string): Funnel | undefined {
  return FUNNELS.find((f) => f.slug === slug);
}

export function listFunnels(): Funnel[] {
  return FUNNELS;
}
