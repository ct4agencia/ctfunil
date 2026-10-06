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
import { useEffect, useState } from "react";
import type { Funnel } from "@/lib/quiz/types";

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
  // Geo no CLIENT: com leadGeo() no server a página era force-dynamic e nunca
  // cacheava na borda. O {estado} chega ~200ms depois do paint — antes de
  // qualquer lâmina que o use ser lida.
  const [clientGeo, setClientGeo] = useState(geo);
  useEffect(() => {
    if (preview || geo?.estado) return;
    fetch("/api/geo")
      .then((r) => r.json())
      .then((g) => setClientGeo((prev) => ({ ...g, ...prev })))
      .catch(() => {});
  }, [preview, geo?.estado]);

  // O motor TIPADO foi aposentado: os funis que rodavam nele viraram `layers`
  // (premio-sonia e cdb-rr, 12/08/2026) e o QuizRunner foi removido. `layers` é
  // o fallback — funil sem `engine` gravado abre no motor padrão em vez de
  // quebrar. O typebot fica: simula WhatsApp, é outra experiência.
  if (funnel.settings?.engine === "typebot") return <ChatRunner funnel={funnel} preview={preview} />;
  return <LayersRunner funnel={funnel} geo={clientGeo} preview={preview} />;
}
