"use client";

/**
 * Seleciona e carrega SÓ o motor do funil (quiz / layers / typebot) via
 * next/dynamic. Antes o page.tsx importava os 3 runners estaticamente → TODO
 * funil baixava Quiz + Layers + Typebot + steps.tsx (1270 linhas). Agora cada
 * funil baixa só o seu motor → bundle bem menor no 4G.
 *
 * SSR LIGADO (sem ssr:false): com ssr:false a página pública saía VAZIA do
 * servidor e o lead via TELA BRANCA até a hidratação (~6s de FCP em celular
 * 4G/CPU 4x — medido). Com SSR o HTML da 1ª lâmina pinta imediatamente e o
 * code-split por engine continua igual.
 */
import dynamic from "next/dynamic";
import type { Funnel } from "@/lib/quiz/types";

const QuizRunner = dynamic(() => import("./QuizRunner"));
const LayersRunner = dynamic(() => import("./layers/LayersRunner"));
const ChatRunner = dynamic(() => import("./typebot/ChatRunner"));

export default function FunnelRenderer({
  funnel,
  geo,
  preview = false,
}: {
  funnel: Funnel;
  geo?: { estado?: string; cidade?: string };
  preview?: boolean;
}) {
  const engine = funnel.settings?.engine;
  if (engine === "typebot") return <ChatRunner funnel={funnel} preview={preview} />;
  if (engine === "layers") return <LayersRunner funnel={funnel} geo={geo} preview={preview} />;
  return <QuizRunner funnel={funnel} geo={geo} preview={preview} />;
}
