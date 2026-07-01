"use client";

/**
 * Seleciona e carrega SÓ o motor do funil (quiz / layers / typebot) via
 * next/dynamic. Antes o page.tsx importava os 3 runners estaticamente → TODO
 * funil baixava Quiz + Layers + Typebot + steps.tsx (1270 linhas). Agora cada
 * funil baixa só o seu motor → bundle bem menor no 4G.
 */
import dynamic from "next/dynamic";
import type { Funnel } from "@/lib/quiz/types";

const QuizRunner = dynamic(() => import("./QuizRunner"), { ssr: false });
const LayersRunner = dynamic(() => import("./layers/LayersRunner"), { ssr: false });
const ChatRunner = dynamic(() => import("./typebot/ChatRunner"), { ssr: false });

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
