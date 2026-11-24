"use client";

/**
 * RELÓGIO DA VSL — o tempo que revela o CTA, o ranking e a barra de vagas.
 *
 * POR QUE EXISTE
 * Cada bloco contava o próprio `Date.now()` desde a montagem, ou seja, tempo de
 * PÁGINA ABERTA. Quem pausasse o vídeo para atender o telefone via o botão de
 * compra aparecer antes do pitch — exatamente o que a revelação por tempo
 * existe para evitar. Quem assistisse adiantado via o oposto: o pitch passava e
 * o botão ainda não estava lá.
 *
 * Agora a fonte é o TEMPO DO VÍDEO: pausou, o relógio para; adiantou, ele
 * acompanha; saiu da aba, congela junto.
 *
 * O FALLBACK NÃO É DETALHE
 * Player não é garantido — bloqueador de anúncio, rede ruim, VTurb fora do ar.
 * Sem player em `ESPERA_PLAYER`, volta a contar tempo de página. Sem isso, uma
 * falha do player esconderia o botão de compra para sempre e a venda morreria
 * em silêncio: trocar um desalinho de minutagem por uma página sem CTA é
 * péssimo negócio.
 *
 * A LEITURA DO TEMPO VEM DO `vsl-watch`
 * Ele já procura o tempo em cascata porque o v4 do VTurb muda o valor de lugar
 * entre versões. Escrever uma segunda cascata aqui repetiria o erro que deixou
 * 394 sessões sem retenção — está documentado lá.
 */

import { useEffect, useRef, useState } from "react";
import { smartInstances, tempoDoPlayer } from "@/lib/quiz/vsl-watch";

/** quanto esperar pelo player antes de contar tempo de página */
const ESPERA_PLAYER = 10_000;
/** de quanto em quanto se lê o relógio; 500ms é imperceptível e barato */
const PASSO = 500;

export type FonteTempo = "video" | "pagina" | "esperando";

/**
 * Segundos corridos da VSL e de onde eles vêm.
 *
 * `esperando` é o estado dos primeiros instantes, quando ainda não se sabe se
 * há player. Quem revela conteúdo deve tratá-lo como "ainda não" — é o que
 * impede o CTA de piscar na tela antes de o player assumir o relógio.
 */
export function useTempoVsl(enabled = true): { segundos: number; fonte: FonteTempo } {
  const [segundos, setSegundos] = useState(0);
  const [fonte, setFonte] = useState<FonteTempo>("esperando");
  const montadoEm = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    montadoEm.current = Date.now();

    const ler = () => {
      const inst = smartInstances()?.[0];
      // o elemento pode existir antes da instância; `tempoDoPlayer` cobre os dois
      const temPlayer = !!inst || !!document.querySelector("vturb-smartplayer");

      if (temPlayer) {
        const t = tempoDoPlayer(inst ?? ({} as Parameters<typeof tempoDoPlayer>[0]));
        if (Number.isFinite(t) && t >= 0) {
          setSegundos(t);
          setFonte("video");
          return;
        }
      }

      /* Sem player: espera antes de desistir. O custom element demora a montar
         (o script vem de outro domínio), e desistir no primeiro quadro jogaria
         a VSL inteira para o relógio de página sem necessidade. */
      const esperandoHa = Date.now() - montadoEm.current;
      if (esperandoHa >= ESPERA_PLAYER) {
        setSegundos((esperandoHa - ESPERA_PLAYER) / 1000);
        setFonte("pagina");
      }
    };

    ler();
    const iv = setInterval(ler, PASSO);
    return () => clearInterval(iv);
  }, [enabled]);

  return { segundos, fonte };
}

/**
 * `true` quando a VSL já passou de `revelarEm`.
 *
 * `preview` short-circuita: no construtor o canvas existe para conferir layout,
 * e obedecer o relógio esconderia CTA, selos e garantia atrás de 20 minutos de
 * espera. `revelarEm <= 0` também passa direto — é o "aparece desde o início".
 */
export function useRevelado(revelarEm: number, preview?: boolean): boolean {
  const { segundos, fonte } = useTempoVsl();
  if (preview || revelarEm <= 0) return true;
  if (fonte === "esperando") return false;
  return segundos >= revelarEm;
}


export function rankingVideoRange(revealAt: unknown, finishAt: unknown) {
  const start = Number(revealAt) || 0;
  const end = Math.max(start + 1, Number(finishAt) || start + 60);
  return { start, end };
}
