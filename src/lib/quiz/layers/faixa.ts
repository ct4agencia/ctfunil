import { designNumber } from "./design";

/**
 * Faixa em movimento: o bloco "disclaimer" com `animar` ligado vira uma esteira
 * de texto, opcionalmente inclinada. Pedido do Luca (25/11/2026) para levar ao
 * construtor a faixa "BLACK FRIDAY" que só existia na página fixa do /upbf1.
 *
 * Mora no `disclaimer`, e não num tipo novo, de propósito: os domínios dos
 * funis ainda rodam um deploy antigo, que ignora campos novos. Lá a faixa
 * aparece parada, em vez de sumir. Sem `animar`, nada muda nos disclaimers que
 * já existem. Fonte, tamanho, peso e cor do texto vêm da aba Aparência, como
 * em qualquer bloco.
 */
export const FAIXA_LIMITES = {
  velocidade: { min: 4, max: 60, padrao: 14 },
  inclinacao: { min: -15, max: 15, padrao: 0 },
  espacamento: { min: 0, max: 12, padrao: 0 },
} as const;

export function faixaConfig(content: Record<string, unknown>) {
  const { velocidade, inclinacao, espacamento } = FAIXA_LIMITES;
  return {
    animar: content.animar === true,
    /** Segundos de cada volta da esteira: menos segundos, mais rápido. */
    velocidade: designNumber(content.velocidade, velocidade.padrao, velocidade.min, velocidade.max),
    inclinacao: designNumber(content.inclinacao, inclinacao.padrao, inclinacao.min, inclinacao.max),
    espacamento: designNumber(content.espacamento, espacamento.padrao, espacamento.min, espacamento.max),
    sombra: content.sombra === true,
  };
}

/** Padrão do catálogo: reproduz a faixa da página fixa do /upbf1. */
export const FAIXA_PADRAO = {
  design: { basis: 100, backgroundColor: "#e3c48d", textColor: "#14110c", fontFamily: "Nunito", fontSize: 14, fontWeight: 800 },
  content: { text: "BLACK FRIDAY · ", animar: true, velocidade: 14, inclinacao: -4, espacamento: 2, sombra: true, revealAt: 0 },
};
