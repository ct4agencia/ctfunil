/**
 * Redirecionamento automático do popup do presente em `/upbf1/roleta`
 * (pedido do Luca em 25/11/2026). Ligado, o popup leva a pessoa sozinha ao
 * link do WhatsApp depois de `seconds` segundos; desligado, só o botão leva.
 *
 * Este arquivo não importa nada do servidor: o cartão do painel (cliente) e a
 * leitura no servidor usam os mesmos limites e a mesma normalização.
 */
export type Upbf1RouletteSettings = { autoRedirect: boolean; seconds: number };
/** ok = lida do banco; readonly = preview em consulta; missing = tabela ausente; error = falha na leitura. */
export type Upbf1SettingsStatus = "ok" | "readonly" | "missing" | "error";

export const UPBF1_ROULETTE_KEY = "upbf1_roleta";
export const UPBF1_SECONDS_MIN = 1;
export const UPBF1_SECONDS_MAX = 60;
/** Desligado por padrão: sem configuração gravada, a roleta fica como sempre foi. */
export const UPBF1_ROULETTE_DEFAULTS: Upbf1RouletteSettings = { autoRedirect: false, seconds: 5 };

export function validUpbf1Seconds(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= UPBF1_SECONDS_MIN && value <= UPBF1_SECONDS_MAX;
}

export function normalizeUpbf1Settings(value: unknown): Upbf1RouletteSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    autoRedirect: source.autoRedirect === true,
    seconds: validUpbf1Seconds(source.seconds) ? source.seconds : UPBF1_ROULETTE_DEFAULTS.seconds,
  };
}
