import type { RouletteStep } from "@/lib/quiz/types";

/** Limites do redirecionamento automático do popup da roleta. */
export const ROULETTE_REDIRECT_SECONDS_MIN = 1;
export const ROULETTE_REDIRECT_SECONDS_MAX = 60;
export const ROULETTE_REDIRECT_SECONDS_DEFAULT = 5;

export function clampRedirectSeconds(value: number) {
  return Math.min(ROULETTE_REDIRECT_SECONDS_MAX, Math.max(ROULETTE_REDIRECT_SECONDS_MIN, Math.round(value)));
}

/**
 * Segundos até o popup redirecionar sozinho, ou `undefined` quando o
 * redirecionamento está desligado. Um valor inválido gravado vira o padrão.
 * Serve ao funil (cliente) e à página fixa do /upbf1 (servidor).
 */
export function rouletteAutoRedirectSeconds(step: Pick<RouletteStep, "popupEnabled" | "popupAutoRedirect" | "popupAutoRedirectSeconds"> | null | undefined) {
  if (!step?.popupEnabled || step.popupAutoRedirect !== true) return undefined;
  const seconds = step.popupAutoRedirectSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) ? clampRedirectSeconds(seconds) : ROULETTE_REDIRECT_SECONDS_DEFAULT;
}
