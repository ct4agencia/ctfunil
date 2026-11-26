/**
 * Contraste de cores pela fórmula do WCAG 2.x (luminância relativa).
 * Texto normal pede 4,5:1; texto grande (24 px, ou 18,66 px em negrito) e
 * elementos de interface pedem 3:1. Usado pelos avisos do editor: o aviso
 * orienta, não impede salvar.
 *
 * Só entende cores sólidas (#rgb, #rrggbb, #rrggbbaa opaco, rgb()). Para
 * gradientes e variáveis CSS devolve null: o editor não confere o que não sabe
 * calcular.
 */
export const CONTRASTE_TEXTO = 4.5;
export const CONTRASTE_GRANDE = 3;

function canais(cor?: string | null): [number, number, number] | null {
  const valor = cor?.trim().toLowerCase();
  if (!valor) return null;
  let hex = valor.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split("").map(c => c + c).join("");
    if (hex.length === 8 && hex.slice(6) !== "ff") return null;
    if (hex.length !== 6 && hex.length !== 8) return null;
    return [0, 2, 4].map(i => parseInt(hex!.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = valor.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    if (rgb[4] && rgb[4] !== "1" && rgb[4] !== "100%") return null;
    return [rgb[1], rgb[2], rgb[3]].map(Number) as [number, number, number];
  }
  return null;
}

function luminancia([r, g, b]: [number, number, number]) {
  const linear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Razão de contraste entre duas cores sólidas, ou null quando não dá para calcular. */
export function razaoContraste(a?: string | null, b?: string | null): number | null {
  const ca = canais(a), cb = canais(b);
  if (!ca || !cb) return null;
  const [claro, escuro] = [luminancia(ca), luminancia(cb)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

export function formatarRazao(razao: number) {
  return `${razao.toFixed(1).replace(".", ",")}:1`;
}
