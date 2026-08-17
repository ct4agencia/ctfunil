"use client";

/**
 * TELA DE PERGUNTA no formato da referência (artedaresina.com.br).
 *
 * POR QUE UM COMPONENTE, E NÃO MAIS ESTILO NO OptionsBlock
 * Tentei antes chegar na referência aplicando cor, peso e borda nos blocos que
 * já existiam. Não chega: o que separa as duas telas não é paleta, é ARRANJO.
 * A referência tem um voltar em chevron, uma pílula de posição, um título
 * responsivo com destaque, um subtítulo, e — o que mais muda a sensação — um
 * respiro de 320 ms entre escolher e avançar, para o visitante VER a marcação
 * acontecer. Nada disso cabe em `design.*` de um bloco de opções sem transformar
 * aquele componente num segundo motor.
 *
 * O QUE ELE NÃO FAZ
 * Não conhece Supabase, `LayersCtx`, tracking nem navegação. Recebe a pergunta
 * e devolve `onEscolha(opcao)`. Quem chama decide o que gravar e para onde ir —
 * mesmo contrato do `Diagnostico.tsx` e do `RoletaInterativa.tsx`, pelo mesmo
 * motivo: manter os dois motores usando a MESMA tela em vez de duas cópias que
 * divergem no primeiro ajuste.
 *
 * Os números (1,5px de borda, raio 16, sombra preta a 8%, check de 18px,
 * spring 280/18, delay 0,1 s por item) saem de `lib/quiz/resina.ts`, medidos no
 * código-fonte da referência — não estimados de print.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { estiloOpcao, estiloCheck, estiloPilulaPergunta, tokensResina } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface OpcaoResina {
  id: string;
  /** já em texto puro — o componente não interpreta HTML */
  label: string;
  emoji?: string;
  imagem?: string;
}

export interface ResinaQuizProps {
  cor: string;
  /** título da pergunta, em texto puro */
  pergunta: string;
  /** trecho do título que ganha a cor de marca; ausente, o título sai inteiro na cor escura */
  destaque?: string;
  subtitulo?: string;
  opcoes: OpcaoResina[];
  /** posição desta pergunta (1-based) e total, para a pílula */
  posicao?: number;
  total?: number;
  onEscolha: (o: OpcaoResina) => void;
  onVoltar?: () => void;
}

/**
 * O respiro entre marcar e avançar. Sem ele o check acende e some no mesmo
 * quadro, e a tela parece que "pulou" em vez de ter registrado a resposta.
 * 320 ms é o valor da referência (StepQuiz.tsx:32).
 */
const RESPIRO_MS = 320;

export default function ResinaQuiz({
  cor, pergunta, destaque, subtitulo, opcoes, posicao, total, onEscolha, onVoltar,
}: ResinaQuizProps) {
  const t = tokensResina(cor);
  const reduzido = prefereMenosMovimento();
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const escolher = (o: OpcaoResina) => {
    if (escolhida) return;         // segundo toque durante o respiro é ignorado
    setEscolhida(o.id);
    setTimeout(() => { setEscolhida(null); onEscolha(o); }, RESPIRO_MS);
  };

  // O título é partido no destaque para colorir só ele. Uso o índice da PRIMEIRA
  // ocorrência: `split` devolveria pedaços demais se o trecho se repetir.
  const corte = destaque ? pergunta.indexOf(destaque) : -1;
  const partes = corte >= 0 && destaque
    ? [pergunta.slice(0, corte), pergunta.slice(corte + destaque.length)]
    : null;

  return (
    <div className="flex w-full flex-col gap-5 py-3">
      {onVoltar ? (
        <button
          onClick={onVoltar}
          className="-mb-2 flex items-center gap-1.5 self-start text-xs font-medium transition-colors sm:text-sm"
          style={{ color: t.muted }}
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voltar
        </button>
      ) : null}

      {posicao && total && total > 1 ? (
        <p className="text-center">
          <span style={estiloPilulaPergunta(cor)}>Pergunta {posicao} de {total}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 px-1 text-center">
        <h2
          className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl"
          style={{ color: t.primaryDarker }}
        >
          {partes ? (
            <>
              {partes[0]}
              <span style={{ color: cor }}>{destaque}</span>
              {partes[1]}
            </>
          ) : pergunta}
        </h2>
        {subtitulo ? (
          <p className="text-sm font-medium sm:text-base" style={{ color: t.muted }}>{subtitulo}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 px-1.5 pt-1 sm:px-2">
        {opcoes.map((o, i) => {
          const ativa = escolhida === o.id;
          return (
            <motion.button
              key={o.id}
              onClick={() => escolher(o)}
              initial={reduzido ? false : { opacity: 0, y: 20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              // Escalonado: cada opção entra 0,1 s depois da anterior. É o que
              // faz a lista "se montar" em vez de aparecer pronta de uma vez.
              transition={{ delay: reduzido ? 0 : i * 0.1, type: "spring", stiffness: 280, damping: 18 }}
              whileHover={reduzido ? undefined : { y: -4 }}
              whileTap={{ scale: 0.97 }}
              style={estiloOpcao(cor, ativa)}
            >
              {o.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imagem} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : o.emoji ? (
                <motion.span
                  // repeatDelay diferente por opção: pulsassem juntas, a lista
                  // inteira "respiraria" em bloco e viraria distração.
                  animate={reduzido ? {} : { scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 + i * 0.3 }}
                  style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}
                >
                  {o.emoji}
                </motion.span>
              ) : null}
              <span style={{ flex: 1 }}>{o.label}</span>
              <span style={estiloCheck(cor, ativa)} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
