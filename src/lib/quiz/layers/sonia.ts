/** Contrato local de seleção. Não representa estoque, reserva nem participação. */
export interface SoniaConfig {
  numeroX?: number;
  numeroY?: number;
  destination?: string;
}
export const SONIA_DEFAULTS = { numeroX: 42, numeroY: 17 } as const;
export interface SoniaState {
  yBlocked: boolean;
  selected: boolean;
  modal: "x" | "y" | null;
  screen: "select" | "confirm";
  confirmed: boolean;
}
export const initialSoniaState: SoniaState = { yBlocked: false, selected: false, modal: null, screen: "select", confirmed: false };
export const soniaLabel = (n: number) => String(n).padStart(2, "0");
export function soniaCells(c: SoniaConfig, s: SoniaState) {
  const valid = !soniaConfigError(c);
  const x = c.numeroX ?? SONIA_DEFAULTS.numeroX;
  const y = c.numeroY ?? SONIA_DEFAULTS.numeroY;
  return Array.from({ length: 60 }, (_, i) => {
    const number = i + 1;
    const status = valid && number === x ? (s.selected ? "selected" : "available")
      : valid && number === y && !s.yBlocked ? "available" : "locked";
    return { number, label: soniaLabel(number), status };
  });
}
export function pickSonia(c: SoniaConfig, s: SoniaState, n: number): SoniaState {
  if (soniaConfigError(c) || s.modal || s.screen !== "select") return s;
  if (n === (c.numeroY ?? SONIA_DEFAULTS.numeroY) && !s.yBlocked) return { ...s, yBlocked: true, modal: "y" };
  if (n === (c.numeroX ?? SONIA_DEFAULTS.numeroX)) return { ...s, selected: true, modal: "x" };
  return s;
}
/** Valida o destino antes de delegar ao navigate do LayersRunner. Sem fallback inventado. */
export function soniaDestination(dest: string | undefined, steps: { id: string; nextStep?: string }[], idx: number): string | null {
  const step = steps[idx];
  if (!step) return null;
  if (!dest && !step.nextStep) return null;
  if (!dest || dest === "next") {
    const target = step.nextStep || steps[idx + 1]?.id;
    return target && target !== step.id && steps.some((s) => s.id === target) ? "next" : null;
  }
  if (/^https?:\/\//i.test(dest)) {
    try { const u = new URL(dest); return u.hostname ? dest : null; } catch { return null; }
  }
  return dest !== step.id && steps.some((s) => s.id === dest) ? dest : null;
}
export function soniaConfigError(c: SoniaConfig): string | null {
  const x = c.numeroX ?? SONIA_DEFAULTS.numeroX;
  const y = c.numeroY ?? SONIA_DEFAULTS.numeroY;
  if (![x, y].every((n) => Number.isInteger(n) && n >= 1 && n <= 60))
    return "X e Y devem ser números inteiros de 1 a 60.";
  if (x === y) return "X e Y devem ser distintos.";
  return null;
}
