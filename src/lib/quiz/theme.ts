import type { Palette } from "./types";

/**
 * Paletas preset por funil (requisito Luca: cada funil escolhe uma paleta).
 * Aplicadas como CSS vars (--q-*) no container do funil — ver applyPalette.
 */
export const PALETTES: Palette[] = [
  {
    id: "laranja-cdb",
    name: "Laranja CDB (Clube das Bolsas)",
    primary: "#ea580c",
    primaryDark: "#c2410c",
    bg: "#ffffff",
    bgSoft: "#fff1e7",
    surface: "#ffffff",
    text: "#171717",
    textMuted: "#6b6b6b",
    ring: "#ea580c",
  },
  {
    id: "roxo-zen",
    name: "Roxo Zen (Zenlya)",
    primary: "#6d46b8",
    primaryDark: "#4a2d8b",
    bg: "#ffffff",
    bgSoft: "#f8f5ff",
    surface: "#ffffff",
    text: "#0a0a1a",
    textMuted: "#6b7280",
    ring: "#6d46b8",
  },
  {
    id: "rosa-bolsas",
    name: "Rosa Artesanal (Clube das Bolsas)",
    primary: "#d6336c",
    primaryDark: "#a61e4d",
    bg: "#fff7fa",
    bgSoft: "#ffeaf1",
    surface: "#ffffff",
    text: "#2a0a16",
    textMuted: "#8a6b75",
    ring: "#d6336c",
  },
  {
    // Tokens extraídos do vivadevelas.com.br (Velas Lucrativas).
    id: "ambar-velas",
    name: "Âmbar Velas (vivadevelas)",
    primary: "#e8842a",
    primaryDark: "#c96e1f",
    bg: "#fffaf4",
    bgSoft: "#fdeede",
    surface: "#ffffff",
    text: "#4a2e1f",
    textMuted: "#6b4e3a",
    ring: "#e8842a",
  },
  {
    id: "verde-saude",
    name: "Verde Saúde",
    primary: "#0ca678",
    primaryDark: "#087f5b",
    bg: "#f4fbf8",
    bgSoft: "#e3f7ef",
    surface: "#ffffff",
    text: "#0a261c",
    textMuted: "#5f7d73",
    ring: "#0ca678",
  },
  {
    id: "azul-confianca",
    name: "Azul Confiança",
    primary: "#1c7ed6",
    primaryDark: "#1864ab",
    bg: "#f4f9ff",
    bgSoft: "#e3f0ff",
    surface: "#ffffff",
    text: "#0a1a2a",
    textMuted: "#5f7488",
    ring: "#1c7ed6",
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}
function darken(hex: string, f: number): string { const [r, g, b] = hexToRgb(hex); return toHex(r * (1 - f), g * (1 - f), b * (1 - f)); }
function tint(hex: string, f: number): string { const [r, g, b] = hexToRgb(hex); return toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); }

/** Gera uma paleta a partir de uma cor primária (color picker). */
export function buildPalette(hex: string): Palette {
  return {
    id: hex, name: "Personalizada", primary: hex, primaryDark: darken(hex, 0.28),
    bg: "#ffffff", bgSoft: tint(hex, 0.88), surface: "#ffffff",
    text: "#171717", textMuted: "#6b6b6b", ring: hex,
  };
}

/** Resolve paleta por id de preset OU por cor hex (#rrggbb). */
export function getPalette(id?: string): Palette {
  if (id && /^#[0-9a-fA-F]{6}$/.test(id)) return buildPalette(id);
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Converte a paleta em CSS custom properties pro container do funil. */
export function paletteVars(p: Palette): Record<string, string> {
  return {
    "--q-primary": p.primary,
    "--q-primary-dark": p.primaryDark,
    "--q-bg": p.bg,
    "--q-bg-soft": p.bgSoft,
    "--q-surface": p.surface,
    "--q-text": p.text,
    "--q-text-muted": p.textMuted,
    "--q-ring": p.ring,
  };
}
