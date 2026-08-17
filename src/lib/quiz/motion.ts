/**
 * Tokens de movimento do funil.
 *
 * POR QUE EXISTE
 * Cada componente escrevia sua própria duração e curva à mão — 1.6s aqui, 0.25
 * ali, spring com stiffness 320 num lugar e 300 noutro. O resultado é um funil
 * onde cada tela se move num ritmo diferente, e a soma parece desleixo mesmo
 * quando cada peça isolada está bem feita.
 *
 * ACESSIBILIDADE NÃO É OPCIONAL
 * `prefereMenosMovimento()` existe porque animação de entrada em tela inteira
 * causa enjoo em quem tem sensibilidade vestibular. Quem ligou "reduzir
 * movimento" no sistema recebe o conteúdo sem deslocamento — não sem conteúdo.
 */

/** Durações em ms. Nomes por INTENÇÃO, não por número. */
export const DUR = {
  /** microinteração: toque em botão, troca de estado */
  toque: 140,
  /** entrada de um elemento na tela */
  entrada: 380,
  /** transição entre telas/lâminas */
  tela: 520,
  /** respiração contínua: pulse, brilho, flutuação */
  respiro: 2200,
} as const;

/**
 * Curvas. `saida` é mais rápida que `entrada` de propósito: o olho perdoa algo
 * saindo depressa, mas estranha algo chegando depressa demais.
 */
export const EASE = {
  entrada: [0.16, 1, 0.3, 1] as const,   // desacelera forte no fim
  saida: [0.7, 0, 0.84, 0] as const,
  suave: [0.4, 0, 0.2, 1] as const,
} as const;

/** Molas por peso do elemento. */
export const SPRING = {
  /** elemento leve: pílula, ícone, selo */
  leve: { type: "spring" as const, stiffness: 380, damping: 26 },
  /** padrão: card, bloco, modal */
  padrao: { type: "spring" as const, stiffness: 300, damping: 28 },
  /** pesado: tela cheia, hero */
  pesado: { type: "spring" as const, stiffness: 200, damping: 30 },
};

/**
 * Atraso entre irmãos numa lista, em segundos.
 *
 * 60 ms é o ponto onde a sequência é percebida como cascata sem virar espera.
 * O teto de 6 existe porque, numa lâmina com 12 blocos, o último entraria quase
 * um segundo depois do primeiro — a essa altura o visitante já rolou a tela e a
 * animação vira distração, não boas-vindas.
 */
export const escalonar = (indice: number, passoMs = 60, teto = 6): number =>
  (Math.min(indice, teto) * passoMs) / 1000;

/**
 * O visitante pediu menos movimento no sistema operacional?
 *
 * Lido em tempo de chamada e não em módulo: no SSR `window` não existe, e no
 * cliente a preferência pode mudar sem recarregar a página.
 */
export function prefereMenosMovimento(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Variantes de entrada prontas, já respeitando a preferência do sistema.
 * Com movimento reduzido o elemento aparece — só não desliza.
 */
export function entradaBloco(indice = 0) {
  const reduzido = prefereMenosMovimento();
  return {
    initial: { opacity: 0, y: reduzido ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: DUR.entrada / 1000,
      ease: EASE.entrada,
      delay: reduzido ? 0 : escalonar(indice),
    },
  };
}
