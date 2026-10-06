/**
 * Parâmetros e presets da roleta do laboratório — separados da página para
 * poderem ser VERIFICADOS.
 *
 * Enquanto isto morava dentro de `page.tsx`, não havia como testar se a régua
 * de intensidade realmente intensifica o que promete: um teste teria que
 * replicar a função, e aí estaria testando a cópia, não o código que roda.
 *
 * Nada aqui toca a roleta de produção (`components/quiz/steps.tsx:141`).
 */

export interface Params {
  voltas: number;
  duracaoAlvo: number;
  limiarCatraca: number;
  pedagio: number;
  rigidez: number;
  amortecimento: number;
  overshoot: number;
  pegHang: boolean;
}

export const PADRAO: Params = {
  voltas: 5, duracaoAlvo: 4.2, limiarCatraca: 150, pedagio: 16,
  rigidez: 120, amortecimento: 7.5, overshoot: 9, pegHang: false,
};

export type Direcao = Partial<{ [K in keyof Omit<Params, "pegHang">]: number }>;

export const LIMITES: { [K in keyof Omit<Params, "pegHang">]: [number, number] } = {
  voltas: [2, 10], duracaoAlvo: [2, 8], limiarCatraca: [60, 400],
  pedagio: [0, 40], rigidez: [40, 300], amortecimento: [2, 20], overshoot: [0, 20],
};

/** Extremos da régua de intensidade. 0 = preset puro. */
export const ESCALA = 10;

/**
 * A régua amplifica a CARACTERÍSTICA do preset, não "drama" genérico: +10 em
 * "Roda pesada" deixa a roda mais pesada; +10 em "Rápido e limpo" a deixa ainda
 * mais enxuta, que é o oposto de dramático. Por isso a direção mora em cada
 * preset — uma tabela global empurraria todos para o mesmo lugar e apagaria a
 * identidade que os separa.
 *
 * `n` vai de -ESCALA a +ESCALA. A escala é só a régua que o usuário enxerga: o
 * efeito é o mesmo de antes (±100), apenas com passo dez vezes maior por
 * entalhe — dez casas de cada lado, como o teto que ele já conhece.
 *
 * ATENÇÃO ao teto: `LIMITES` corta o resultado. Um parâmetro que já nasce perto
 * do limite (ex.: `voltas: 8` de "Roda pesada", teto 10) sobe menos do que a
 * amplitude sugere. É por isso que o check mede o resultado REAL em vez de
 * confiar na tabela de direções.
 */
export function comIntensidade(base: Params, dir: Direcao, n: number): Params {
  if (!n) return base;
  const f = n / ESCALA;
  const out = { ...base };
  (Object.keys(dir) as (keyof Direcao)[]).forEach((k) => {
    const amp = dir[k];
    if (amp === undefined) return;
    const [min, max] = LIMITES[k];
    const escalado = base[k] * (1 + f * amp);
    const passo = k === "duracaoAlvo" ? 10 : k === "amortecimento" ? 2 : 1;
    out[k] = Math.round(Math.min(max, Math.max(min, escalado)) * passo) / passo;
  });
  return out;
}

export interface Preset {
  nome: string;
  desc: string;
  eixo: string;
  params: Params;
  dir: Direcao;
}

export const PRESETS: Preset[] = [
  {
    nome: "Cassino clássico",
    desc: "O padrão de casa. Recuo visível no fim, sem exagero.",
    eixo: "discreto ⟷ teatral",
    params: PADRAO,
    dir: { overshoot: 0.8, pedagio: 0.6, amortecimento: -0.4, duracaoAlvo: 0.25 },
  },
  {
    nome: "Suspense",
    desc: "Quase para três, quatro vezes antes de decidir. O mais tenso.",
    eixo: "menos ⟷ mais suspense",
    params: { voltas: 6, duracaoAlvo: 5.4, limiarCatraca: 300, pedagio: 30, rigidez: 100, amortecimento: 6, overshoot: 13, pegHang: false },
    dir: { pedagio: 0.85, limiarCatraca: 0.5, duracaoAlvo: 0.3, amortecimento: -0.3 },
  },
  {
    nome: "Rápido e limpo",
    desc: "Sem drama. Para quando o funil não pode perder tempo.",
    eixo: "menos ⟷ mais rápido",
    params: { voltas: 3, duracaoAlvo: 2.6, limiarCatraca: 90, pedagio: 6, rigidez: 190, amortecimento: 12, overshoot: 4, pegHang: false },
    dir: { duracaoAlvo: -0.45, voltas: -0.4, overshoot: -0.7, pedagio: -0.6, rigidez: 0.4, amortecimento: 0.35 },
  },
  {
    nome: "Roda pesada",
    desc: "Roda grande de parque: gira muito e assenta devagar.",
    eixo: "menos ⟷ mais pesada",
    params: { voltas: 8, duracaoAlvo: 6.4, limiarCatraca: 200, pedagio: 12, rigidez: 70, amortecimento: 5, overshoot: 15, pegHang: false },
    dir: { voltas: 0.5, duracaoAlvo: 0.4, rigidez: -0.5, amortecimento: -0.35, overshoot: 0.4 },
  },
  {
    nome: "Nervosa",
    desc: "Balança bastante antes de assentar. Chama atenção.",
    eixo: "menos ⟷ mais balanço",
    params: { voltas: 5, duracaoAlvo: 4, limiarCatraca: 160, pedagio: 14, rigidez: 210, amortecimento: 3, overshoot: 16, pegHang: false },
    dir: { amortecimento: -0.7, overshoot: 0.9, rigidez: 0.45 },
  },
  {
    nome: "Quase não passa",
    desc: "Equilibra em cima do pino, hesita e cai pro lado.",
    eixo: "menos ⟷ mais hesitação",
    // Rigidez ALTA e amortecimento médio de propósito: depois de hesitar, ela
    // tem que TOMBAR — mola frouxa aqui vira escorregada lenta e mata o susto.
    params: { voltas: 5, duracaoAlvo: 4.2, limiarCatraca: 240, pedagio: 26, rigidez: 200, amortecimento: 9, overshoot: 0, pegHang: true },
    dir: { pedagio: 0.6, limiarCatraca: 0.4, duracaoAlvo: 0.2, amortecimento: -0.3 },
  },
  {
    nome: "Personalizado",
    desc: "Abre os controles finos abaixo. Parte do padrão e é só ajustar.",
    eixo: "sem efeito — use os controles",
    params: PADRAO,
    dir: {},
  },
];
