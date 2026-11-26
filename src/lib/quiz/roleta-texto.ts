"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

/**
 * Rótulo das fatias da roleta: UMA regra de encaixe para os três motores
 * (clássica e interativa em SVG, v3 em canvas).
 *
 * POR QUE MUDOU (pedido do Luca, 25/11/2026)
 * Antes cada motor tinha a sua regra, e todas só ENCOLHIAM a partir de um
 * tamanho fixo. Rótulo curto ficava miúdo numa fatia vazia; na v3, cada linha
 * encolhia sozinha e a entrelinha continuava do tamanho pedido, o que aparecia
 * como "espaçamento" entre linhas pequenas. A largura era estimada por número
 * de caracteres (emoji contava 2, maiúscula em negrito era subestimada).
 *
 * AGORA
 * - mede o texto de verdade (canvas, com a fonte da roleta), por grafema;
 * - tenta 1, 2 e 3 linhas, com a quebra mais equilibrada por palavras;
 * - escolhe o MAIOR corpo que cabe na geometria da fatia, com entrelinha
 *   proporcional ao corpo final, sem espaçamento artificial;
 * - o tamanho configurado (na fatia ou na lâmina) passa a ser o TETO: o texto
 *   cresce até ele, nunca além, e encolhe se não couber.
 * Cada motor só informa a geometria: tangencial (SVG) ou radial (v3).
 */

/** Largura de um texto num corpo, na mesma unidade do desenho. */
export type Medidor = (texto: string, fontSize: number) => number;
/** A geometria da fatia: as larguras das linhas cabem neste corpo? */
export type Cabe = (larguras: number[], fontSize: number, linhas: number) => boolean;

export interface Encaixe { linhas: string[]; fontSize: number; cabe: boolean }

/** Entrelinha, em múltiplos do corpo: a mesma para medir e para desenhar. */
export const ENTRELINHA = 1.1;
/** Teto quando nem a fatia nem a lâmina definem tamanho (unidades do viewBox 200). */
export const TAMANHO_AUTO = 15;
/** Piso de leitura no celular (unidades do viewBox 200). */
export const TAMANHO_MINIMO = 6;

/**
 * Largura útil de uma fatia no raio `raio`: a corda `2·r·sen(θ/2)` com 18% de
 * folga, para o texto não encostar na divisória.
 */
export function larguraDaFatia(fatias: number, raio: number): number {
  const theta = (2 * Math.PI) / Math.max(1, fatias);
  return 2 * raio * Math.sin(theta / 2) * 0.82;
}

export function grafemas(texto: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: "grapheme" }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter("pt-BR", { granularity: "grapheme" }).segment(texto), s => s.segment) : Array.from(texto);
}

/** Largura média de cada grafema em negrito 800, em múltiplos do corpo. */
function larguraEstimada(g: string): number {
  if (/\p{Extended_Pictographic}/u.test(g)) return 1.2;
  if (g === " ") return 0.3;
  if (/[MWÆŒ]/.test(g)) return 0.98;
  if (/[IÍÌÎÏ]/.test(g)) return 0.34;
  if (/[A-ZÀ-ÖØ-Þ]/.test(g)) return 0.74;
  if (/[mw]/.test(g)) return 0.92;
  if (/[iljíìîït]/.test(g)) return 0.32;
  if (/[a-zß-öø-ÿ]/.test(g)) return 0.6;
  if (/\d/.test(g)) return 0.64;
  if (g === "%") return 0.95;
  return 0.42;
}

/** Medida aproximada, igual no servidor e no navegador (primeira pintura). */
export const medirEstimado: Medidor = (texto, fontSize) =>
  grafemas(texto).reduce((total, g) => total + larguraEstimada(g) * fontSize, 0);

/** Medida real com canvas, na família e no peso dados. Fora do navegador, null. */
export function medidorCanvas(familia: string, peso = 800): Medidor | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const cache = new Map<string, number>();
  return (texto, fontSize) => {
    const chave = `${fontSize}|${texto}`;
    let largura = cache.get(chave);
    if (largura === undefined) {
      ctx.font = `${peso} ${fontSize}px ${familia}`;
      largura = ctx.measureText(texto).width;
      cache.set(chave, largura);
    }
    return largura;
  };
}

/** Todas as quebras de `palavras` em `n` linhas, sem cortar palavra. */
function quebras(palavras: string[], n: number): string[][] {
  if (n === 1) return [[palavras.join(" ")]];
  const saida: string[][] = [];
  const cortar = (inicio: number, resto: number, atual: string[]) => {
    if (resto === 1) { saida.push([...atual, palavras.slice(inicio).join(" ")]); return; }
    for (let fim = inicio + 1; fim <= palavras.length - (resto - 1); fim++) {
      cortar(fim, resto - 1, [...atual, palavras.slice(inicio, fim).join(" ")]);
    }
  };
  cortar(0, n, []);
  return saida;
}

/**
 * Melhor encaixe do rótulo: maior corpo entre `fsMin` e `fsMax` que cabe, em
 * 1 a `maxLinhas` linhas. Uma linha a mais só vence se o corpo crescer 8% ou
 * mais: duas linhas quase do mesmo tamanho de uma leem pior.
 * Se nada couber nem no piso (palavra longa demais), devolve a quebra que
 * menos estoura, no piso, com `cabe: false`.
 */
export function encaixarRotulo(
  texto: string,
  { medir, cabe, fsMin, fsMax, maxLinhas = 3 }: { medir: Medidor; cabe: Cabe; fsMin: number; fsMax: number; maxLinhas?: number },
): Encaixe {
  const palavras = (texto || "").trim().split(/\s+/).filter(Boolean).slice(0, 12);
  if (!palavras.length) return { linhas: [], fontSize: fsMin, cabe: true };
  const teto = Math.max(fsMin, fsMax);
  let melhor: Encaixe | null = null;
  let menosPior: { linhas: string[]; estouro: number } | null = null;
  for (let n = 1; n <= Math.min(maxLinhas, palavras.length); n++) {
    for (const linhas of quebras(palavras, n)) {
      const testa = (fs: number) => cabe(linhas.map(l => medir(l, fs)), fs, linhas.length);
      if (!testa(fsMin)) {
        const estouro = Math.max(...linhas.map(l => medir(l, fsMin)));
        if (!menosPior || estouro < menosPior.estouro) menosPior = { linhas, estouro };
        continue;
      }
      let baixo = fsMin, alto = teto;
      if (testa(alto)) baixo = alto;
      else for (let k = 0; k < 16; k++) { const meio = (baixo + alto) / 2; if (testa(meio)) baixo = meio; else alto = meio; }
      const fontSize = Math.floor(baixo * 4) / 4;
      if (!melhor || fontSize > melhor.fontSize * 1.08) melhor = { linhas, fontSize, cabe: true };
    }
  }
  return melhor ?? { linhas: menosPior?.linhas ?? [palavras.join(" ")], fontSize: fsMin, cabe: false };
}

/**
 * Geometria TANGENCIAL (clássica e interativa, viewBox 200): o texto corre de
 * lado a lado da fatia, centrado no raio `raioCentro`, com as linhas
 * empilhadas ao longo do raio. Cada linha cabe na corda do seu próprio raio
 * (medida no lado de dentro, o mais estreito), e a pilha fica entre o miolo e
 * a borda.
 */
export function cabeTangencial({ fatias, raioCentro, raioMin, raioMax }: { fatias: number; raioCentro: number; raioMin: number; raioMax: number }): Cabe {
  const meioAngulo = Math.sin(Math.PI / Math.max(2, fatias));
  return (larguras, fs, n) => {
    const passo = fs * ENTRELINHA;
    const metade = ((n - 1) / 2) * passo;
    if (raioCentro + metade + fs / 2 > raioMax || raioCentro - metade - fs / 2 < raioMin) return false;
    return larguras.every((largura, k) => {
      const raioInterno = raioCentro + metade - k * passo - fs * 0.4;
      return largura <= 2 * raioInterno * meioAngulo * 0.84;
    });
  };
}

/**
 * Geometria RADIAL (v3, canvas): o texto corre ao longo do raio, ancorado na
 * borda externa `raioMax`, e as linhas se empilham de lado. O comprimento cabe
 * entre o miolo e a borda; a pilha cabe na largura da fatia na ponta de
 * dentro do texto, onde ela é mais estreita.
 */
export function cabeRadial({ fatias, raioMin, raioMax }: { fatias: number; raioMin: number; raioMax: number }): Cabe {
  const meioAngulo = Math.sin(Math.PI / Math.max(2, fatias));
  return (larguras, fs, n) => {
    const comprimento = Math.max(0, ...larguras);
    if (comprimento > raioMax - raioMin) return false;
    const pilha = fs + (n - 1) * fs * ENTRELINHA;
    return pilha <= 2 * (raioMax - comprimento) * meioAngulo * 0.84;
  };
}

/** Geometria das roletas SVG (viewBox 200, roda de raio 86, texto no raio 62). */
export const GEOMETRIA_SVG = { raioCentro: 62, raioMin: 33, raioMax: 83 };

/**
 * Encaixes das fatias de uma roleta SVG. A primeira pintura usa a medida
 * aproximada (igual no servidor e no navegador); quando as fontes carregam, a
 * medida real, na família que o SVG herdou, substitui.
 */
export function useEncaixesSvg(
  fatias: { label: string; labelSize?: number }[],
  tamanhoLamina: number | undefined,
  alvo: RefObject<Element | null>,
): Encaixe[] {
  const chave = JSON.stringify([fatias.map(f => [f.label, f.labelSize ?? null]), tamanhoLamina ?? null]);
  const estimados = useMemo(() => calcularSvg(fatias, tamanhoLamina, medirEstimado), [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const [medidos, setMedidos] = useState<{ chave: string; encaixes: Encaixe[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    const medir = () => {
      if (!vivo) return;
      const familia = alvo.current ? getComputedStyle(alvo.current).fontFamily : "";
      const medidor = medidorCanvas(familia || "Poppins, Arial, sans-serif");
      if (medidor) setMedidos({ chave, encaixes: calcularSvg(fatias, tamanhoLamina, medidor) });
    };
    const fontes = typeof document !== "undefined" ? document.fonts : undefined;
    if (fontes?.ready) void fontes.ready.then(medir);
    else requestAnimationFrame(medir);
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return medidos?.chave === chave ? medidos.encaixes : estimados;
}

function calcularSvg(fatias: { label: string; labelSize?: number }[], tamanhoLamina: number | undefined, medir: Medidor): Encaixe[] {
  const cabe = cabeTangencial({ fatias: fatias.length, ...GEOMETRIA_SVG });
  return fatias.map(f => encaixarRotulo(f.label, {
    medir, cabe, fsMin: TAMANHO_MINIMO, fsMax: f.labelSize ?? tamanhoLamina ?? TAMANHO_AUTO,
  }));
}
