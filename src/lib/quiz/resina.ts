/**
 * TOKENS DA REFERÊNCIA (artedaresina.com.br)
 *
 * DE ONDE VIERAM
 * Não são estimativa nem leitura de print. Saíram do código-fonte do
 * `Velas-Lucrativas`, que o CLAUDE.md daquele projeto declara ser réplica
 * técnica do Resina ("replicado a partir do funil A Arte da Resina",
 * 16/05/2026). Os valores estão em `funil/tailwind.config.ts` (escala
 * `brand.*`, sombras, gradientes) e em `funil/src/components/steps/StepQuiz.tsx`
 * (o botão de opção, o check redondo, a pílula de pergunta).
 *
 * O Velas trocou a paleta para âmbar (#E8842A) mantendo a MESMA estrutura; o
 * Resina usa sky-600 (#0284c7), como o próprio CLAUDE.md registra na tabela de
 * diferenças. Por isso aqui a paleta é derivada de uma cor, não fixa: passar
 * #0284c7 devolve o Resina, passar outra devolve a mesma gramática em outra cor.
 *
 * POR QUE ISTO EXISTE COMO MÓDULO
 * Três componentes precisam dos mesmos números (o bloco de opções, o header e
 * o card). Repetir os hexadecimais nos três é como as divergências nascem —
 * já aconteceu cinco vezes neste app. Um lugar só, importado por todos.
 *
 * Puro de propósito: sem React, sem I/O, sem Supabase. Só entra cor e sai
 * objeto, então dá para conferir os valores sem subir a aplicação.
 */

import type { CSSProperties } from "react";

/** A cor da referência: sky-600. */
export const RESINA_PRIMARY = "#0284c7";

export interface TokensResina {
  /** cor de marca — destaque, borda selecionada, CTA */
  primary: string;
  /** um degrau abaixo — fim do degradê do CTA */
  primaryDark: string;
  /** o mais escuro — cor do TÍTULO (não é cinza-ardósia; é azul) */
  primaryDarker: string;
  /** fundo dos blocos claros e da pílula */
  softBg: string;
  /** borda de card em repouso */
  softBorder: string;
  /** corpo de texto */
  text: string;
  /** texto secundário, legendas */
  muted: string;
  sombraCard: string;
  sombraCardLg: string;
  sombraCta: string;
  gradienteCta: string;
  fundoPagina: string;
}

/** Clareia um hex em direção ao branco (0 = igual, 1 = branco). */
function clarear(hex: string, f: number): string {
  const m = /^#?([\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(v + (255 - v) * f);
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Escurece um hex em direção ao preto (0 = igual, 1 = preto). */
function escurecer(hex: string, f: number): string {
  const m = /^#?([\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(v * (1 - f));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** `#0284c7` → `2, 132, 199`, para montar rgba() com alfa variável. */
export function rgbDe(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "2, 132, 199";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Deriva a escala inteira de uma cor de marca. Os fatores reproduzem a distância
 * entre os tons que o Velas declara à mão: #E8842A → #C26818 é ~0,17 de preto,
 * → #8A4612 é ~0,41; o fundo creme #FFF8F0 e a borda #F0E5D8 estão a ~0,96 e
 * ~0,86 do branco. Aplicados a #0284c7 caem em cima de sky-700/800/50/100.
 */
export function tokensResina(cor = RESINA_PRIMARY): TokensResina {
  const rgb = rgbDe(cor);
  return {
    primary: cor,
    primaryDark: escurecer(cor, 0.17),
    primaryDarker: escurecer(cor, 0.41),
    softBg: clarear(cor, 0.96),
    softBorder: clarear(cor, 0.86),
    text: "#0f172a",
    muted: "#64748b",
    // A sombra de card da referência é COLORIDA e larga — é o "sombreamento
    // sutil" que dá o ar caro. Sombra preta chapada deixa o card com aspecto
    // de caixa de formulário.
    sombraCard: `0 4px 20px rgba(${rgb}, 0.08)`,
    sombraCardLg: `0 10px 40px rgba(${rgb}, 0.12)`,
    sombraCta: `0 8px 25px rgba(${rgb}, 0.4)`,
    gradienteCta: `linear-gradient(135deg, ${cor} 0%, ${clarear(cor, 0.28)} 50%, ${cor} 100%)`,
    fundoPagina: `linear-gradient(180deg, ${clarear(cor, 0.96)} 0%, #ffffff 35%, ${clarear(cor, 0.96)} 100%)`,
  };
}

/**
 * BOTÃO DE OPÇÃO — layout "list" (StepQuiz.tsx:250-319).
 *
 * Os números são os da referência, não arredondamentos: borda de 1,5px (não 2),
 * raio 16 (não 24), e a sombra em repouso é PRETA a 8% — a colorida entra só na
 * seleção. Trocar qualquer um deles é o que fazia a tela "parecer feita por IA":
 * borda grossa demais e sombra colorida demais.
 */
export function estiloOpcao(cor: string, selecionada: boolean): CSSProperties {
  const rgb = rgbDe(cor);
  return {
    background: selecionada ? clarear(cor, 0.88) : "#FFFFFF",
    border: `1.5px solid rgba(${rgb}, ${selecionada ? 0.55 : 0.18})`,
    borderRadius: 16,
    fontWeight: 600,
    fontSize: 16,
    color: "#0f172a",
    boxShadow: selecionada ? `0 0 20px rgba(${rgb}, 0.2)` : "0 2px 12px rgba(0,0,0,0.08)",
    padding: "22px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
    transition: "background .25s, border-color .25s, box-shadow .25s",
  };
}

/**
 * O CHECK REDONDO que o Luca apontou nos prints. 18px, e o miolo é um
 * `radial-gradient` que para em 40% — não um círculo cheio. É essa parada que
 * dá o anel fino de respiro entre o miolo e a borda.
 */
export function estiloCheck(cor: string, selecionada: boolean): CSSProperties {
  const rgb = rgbDe(cor);
  return {
    width: 18,
    height: 18,
    borderRadius: "50%",
    flexShrink: 0,
    border: `2px solid rgba(${rgb}, ${selecionada ? 1 : 0.3})`,
    background: selecionada ? `radial-gradient(circle, ${cor} 40%, transparent 60%)` : "transparent",
    transition: "all .2s",
  };
}

/**
 * PÍLULA "Pergunta X de Y" (StepQuiz.tsx:60). Fica ACIMA do título, centrada,
 * em caixa alta e com `tracking` largo. Na referência não existe barra de
 * progresso nesta tela — a pílula é que informa onde o visitante está.
 */
export function estiloPilulaPergunta(cor: string): CSSProperties {
  const t = tokensResina(cor);
  return {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: cor,
    background: t.softBg,
    border: `1px solid ${t.softBorder}`,
    padding: "4px 12px",
    borderRadius: 9999,
    display: "inline-block",
  };
}

/**
 * TÍTULO DA PERGUNTA (StepQuiz.tsx:67). Peso 800 e cor `primaryDarker` — o
 * título da referência é AZUL ESCURO, não cinza-ardósia. Era esse o erro que
 * deixava a tela cinzenta mesmo com o tema certo aplicado.
 */
export function estiloTituloPergunta(cor: string): CSSProperties {
  return {
    fontWeight: 800,
    fontSize: 28,
    lineHeight: 1.15,
    color: tokensResina(cor).primaryDarker,
    textAlign: "center",
  };
}
