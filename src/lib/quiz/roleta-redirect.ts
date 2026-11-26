import type { RouletteStep } from "@/lib/quiz/types";

/** Limites do redirecionamento automático do popup da roleta. */
export const ROULETTE_REDIRECT_SECONDS_MIN = 1;
export const ROULETTE_REDIRECT_SECONDS_MAX = 60;
export const ROULETTE_REDIRECT_SECONDS_DEFAULT = 5;

export function clampRedirectSeconds(value: number) {
  return Math.min(ROULETTE_REDIRECT_SECONDS_MAX, Math.max(ROULETTE_REDIRECT_SECONDS_MIN, Math.round(value)));
}

/**
 * Segundos até a roleta redirecionar sozinha depois da vitória, ou `undefined`
 * quando o redirecionamento está desligado. Não depende do popup: com ele
 * desligado, a contagem aparece no resultado da própria lâmina. Um valor
 * inválido gravado vira o padrão.
 */
export function rouletteAutoRedirectSeconds(step: Pick<RouletteStep, "popupAutoRedirect" | "popupAutoRedirectSeconds"> | null | undefined) {
  if (step?.popupAutoRedirect !== true) return undefined;
  const seconds = step.popupAutoRedirectSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) ? clampRedirectSeconds(seconds) : ROULETTE_REDIRECT_SECONDS_DEFAULT;
}
