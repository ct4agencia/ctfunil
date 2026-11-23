"use client";

import { WorkspaceLoading } from "@/components/workspace/WorkspaceLoading";
import dynamic from "next/dynamic";
import type { Funnel } from "@/lib/quiz/types";

/**
 * Carrega SÓ o construtor do motor do funil (code-split por engine, mesmo
 * padrão do FunnelRenderer público). Antes: os 3 builders iam juntos no
 * bundle da rota (~1,2MB de JS) mesmo que o funil usasse só 1.
 */
const Loading = () => <WorkspaceLoading label="Abrindo o construtor"/>;

const LayersBuilder = dynamic(() => import("@/components/builder/LayersBuilder"), { loading: Loading });
const TypebotBuilder = dynamic(() => import("@/components/builder/TypebotBuilder"), { loading: Loading });

export default function BuilderRenderer({ funnel, draft=false }: { funnel: Funnel; draft?:boolean }) {
  // Funis do motor "typebot" (chat) usam o construtor conversacional.
  if (funnel.settings?.engine === "typebot") return <TypebotBuilder initial={funnel} />;
  // `layers` é o padrão. O FunnelBuilder (construtor do motor tipado) saiu em
  // 12/08/2026 junto com o próprio motor: funil sem `engine` gravado abre no
  // construtor de blocos em vez de quebrar.
  return <LayersBuilder initial={funnel} initiallyDraft={draft} />;
}
