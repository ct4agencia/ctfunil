"use client";

import dynamic from "next/dynamic";
import type { Funnel } from "@/lib/quiz/types";

/**
 * Carrega SÓ o construtor do motor do funil (code-split por engine, mesmo
 * padrão do FunnelRenderer público). Antes: os 3 builders iam juntos no
 * bundle da rota (~1,2MB de JS) mesmo que o funil usasse só 1.
 */
const Loading = () => (
  <div className="grid min-h-screen place-items-center bg-[#f4f6f9]">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      <p className="text-sm text-neutral-500">Abrindo o construtor…</p>
    </div>
  </div>
);

const FunnelBuilder = dynamic(() => import("@/components/builder/FunnelBuilder"), { loading: Loading });
const LayersBuilder = dynamic(() => import("@/components/builder/LayersBuilder"), { loading: Loading });
const TypebotBuilder = dynamic(() => import("@/components/builder/TypebotBuilder"), { loading: Loading });

export default function BuilderRenderer({ funnel }: { funnel: Funnel }) {
  // Funis do motor "typebot" (chat) usam o construtor conversacional.
  if (funnel.settings?.engine === "typebot") return <TypebotBuilder initial={funnel} />;
  // Funis do motor "layers" (clones do inlead) usam o construtor de blocos.
  if (funnel.settings?.engine === "layers") return <LayersBuilder initial={funnel} />;
  return <FunnelBuilder initial={funnel} />;
}
