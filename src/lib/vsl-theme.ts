/**
 * Deriva uma paleta completa a partir da cor primária da marca,
 * pra VSL se adaptar a qualquer cor (azul, âmbar, verde, etc.)
 * mantendo o mesmo visual premium.
 */

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h || "0284c7", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

/** Mistura duas cores hex: t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** rgba() a partir de um hex + alpha. */
function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface VslTheme {
  primary: string;
  light: string;
  lighter: string;
  dark: string;
  textLight: string;
  bgFrom: string;
  bgMid: string;
  rgba: (alpha: number) => string;
}

export function buildTheme(primaryInput: string): VslTheme {
  const primary = primaryInput?.startsWith("#") ? primaryInput : "#0284c7";
  return {
    primary,
    light: mix(primary, "#ffffff", 0.4),
    lighter: mix(primary, "#ffffff", 0.65),
    dark: mix(primary, "#000000", 0.4),
    textLight: mix(primary, "#ffffff", 0.9),
    // Fundo escuro levemente tingido pela marca
    bgFrom: mix(primary, "#070a12", 0.9),
    bgMid: mix(primary, "#0c1322", 0.82),
    rgba: (alpha: number) => rgba(primary, alpha),
  };
}
