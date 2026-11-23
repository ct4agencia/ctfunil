"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadImportDraft, saveImportDraft } from "@/lib/assistant/import-drafts";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep } from "@/lib/quiz/layers/types";

const legacyMediaWarning = "Vídeos e imagens externas são representados por blocos. Links de produção e integrações foram excluídos da cópia.";
const videoMediaWarning = "A cópia carrega as imagens públicas disponíveis e simula o tempo de vídeo. Vídeos, links de produção e integrações ficam fora da execução local.";

export function restoreOriginalImages(current: Funnel, source: Funnel) {
  const sourceSteps = new Map((source.steps as unknown as InleadStep[]).map(step => [step.id, step]));
  let restored = 0;
  const steps = (current.steps as unknown as InleadStep[]).map(step => {
    const original = sourceSteps.get(step.id);
    if (!original) return step;
    const originalLayers = new Map(original.layers.map(layer => [layer.id, layer]));
    const layers = step.layers.map(layer => {
      if (layer.type !== "image" || layer.content.image?.src) return layer;
      const sourceLayer = originalLayers.get(layer.id);
      const src = sourceLayer?.type === "image" ? sourceLayer.content.image?.src : undefined;
      if (!src) return layer;
      restored++;
      return { ...layer, content: { ...layer.content, image: { ...layer.content.image, type: "image" as const, src } } };
    });
    return { ...step, layers };
  });
  return { restored, funnel: restored ? { ...current, steps: steps as unknown as Funnel["steps"] } : current };
}

export default function PreviewVslDraftButton({ funnel, video }: { funnel: Funnel; video: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"open" | "restore" | null>(null);
  const [notice, setNotice] = useState("");
  const id = `preview-${video ? "vsl" : "funil"}-${funnel.slug}`;
  const canRestore = video && (funnel.steps as unknown as InleadStep[]).some(step =>
    step.layers.some(layer => layer.type === "image" && layer.content.image?.src)
  );
  const [error, setError] = useState("");

  async function openDraft() {
    if (pending) return;
    setPending("open");
    setError("");
    try {
      if (!await loadImportDraft(id)) {
        await saveImportDraft({
          id,
          funnel,
          source: funnel.slug,
          reviewed: true,
          warnings: [video ? videoMediaWarning : legacyMediaWarning],
        });
      }
      router.push(`/importar/${encodeURIComponent(id)}`);
    } catch {
      setError("Não foi possível abrir a cópia local neste navegador.");
      setPending(null);
    }
  }

  async function restoreImages() {
    if (pending) return;
    setPending("restore");
    setError("");
    setNotice("");
    try {
      const draft = await loadImportDraft(id);
      if (!draft) {
        setNotice("Ao abrir a cópia pela primeira vez, as imagens disponíveis já serão carregadas.");
        return;
      }
      const result = restoreOriginalImages(draft.funnel, funnel);
      if (!result.restored) {
        setNotice("Nenhuma imagem original pendente neste rascunho.");
        return;
      }
      const warnings = draft.warnings.map(warning => warning === legacyMediaWarning ? videoMediaWarning : warning);
      await saveImportDraft({ ...draft, funnel: result.funnel, warnings });
      setNotice(result.restored === 1 ? "Uma imagem restaurada no rascunho." : `${result.restored} imagens restauradas no rascunho.`);
    } catch {
      setError("Não foi possível restaurar as imagens neste navegador.");
    } finally {
      setPending(null);
    }
  }

  return <div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="ct-action-link" onClick={openDraft} disabled={!!pending}>
        {pending === "open" ? "Abrindo cópia…" : "Editar cópia local"}
      </button>
      {canRestore && <button type="button" className="text-sm text-ct-blue underline disabled:opacity-50" onClick={restoreImages} disabled={!!pending}>
        {pending === "restore" ? "Restaurando imagens…" : "Restaurar imagens da fonte"}
      </button>}
    </div>
    {notice && <p role="status" className="mt-2 text-sm text-ct-dim">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-ct-dim">{error}</p>}
  </div>;
}
