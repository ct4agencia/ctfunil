"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full reload deliberately reads the last saved local draft, not unsaved builder state. */

import { useEffect, useState } from "react";
import LayersBuilder from "@/components/builder/LayersBuilder";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep } from "@/lib/quiz/layers/types";
import { createSoniaDraft, SONIA_DRAFT_KEY, SONIA_REDIRECT } from "@/lib/quiz/layers/sonia-draft";
import { soniaConfigError } from "@/lib/quiz/layers/sonia";

export default function SoniaLab({ view, realRedirect = false }: { view: "builder" | "selection" | "flow"; realRedirect?: boolean }) {
  const [draft, setDraft] = useState<Funnel | null>(null);
  const [notice, setNotice] = useState("");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const frame = window.setTimeout(() => {
      let initial = createSoniaDraft();
      try {
        const saved = localStorage.getItem(SONIA_DRAFT_KEY);
        if (!saved && localStorage.getItem("quizfunel:sonia:local-draft:v1")) setNotice("Template v2 carregado. Seu rascunho v1 permanece preservado nesta origem; ele não foi migrado nem sobrescrito.");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.settings?.engine !== "layers" || !Array.isArray(parsed.steps) || !parsed.steps.length || parsed.steps.some((s: InleadStep) => !s.id || !Array.isArray(s.layers))) throw new Error("Formato inválido");
          initial = parsed;
        }
      } catch { setNotice("Rascunho local ilegível; template carregado sem sobrescrever o armazenamento."); }
      setDraft(initial);
    });
    return () => window.clearTimeout(frame);
  }, []);
  const save = async (funnel: Funnel) => {
    const layers = (funnel.steps as unknown as InleadStep[]).flatMap((s) => s.layers);
    const invalid = layers.filter((l) => l.type === "sonia-numbers").map((l) => soniaConfigError(l.content)).find(Boolean);
    if (invalid) return { ok: false, error: invalid };
    try {
      const serialized = JSON.stringify(funnel);
      localStorage.setItem(SONIA_DRAFT_KEY, serialized);
      if (localStorage.getItem(SONIA_DRAFT_KEY) !== serialized) throw new Error("Falha ao verificar gravação");
      return { ok: true };
    } catch { return { ok: false, error: "Armazenamento local indisponível. Nada foi enviado ao servidor." }; }
  };
  const reset = () => {
    try { localStorage.removeItem(SONIA_DRAFT_KEY); } catch { setNotice("Não foi possível remover o rascunho local."); return; }
    setDraft(createSoniaDraft()); setNonce((n) => n + 1); setNotice("Template local restaurado.");
  };
  if (!draft) return <p role="status">Carregando rascunho local…</p>;
  const steps = draft.steps as unknown as InleadStep[];
  const selectionIndex = Math.max(0, steps.findIndex((s) => s.layers.some((l) => l.type === "sonia-numbers")));
  return <>
    <details className="ct-workspace ct-lab-menu">
      <summary>Laboratório local</summary>
    <nav aria-label="Laboratório local" className="ct-lab-links">
      <strong>QUIZFUNEL · RASCUNHO LOCAL</strong>
      <a href="/lab/sonia?view=builder" className="underline">Construtor</a>
      <a href="/lab/sonia" className="underline">Funil completo</a>
      <a href="/lab/sonia?view=selection" className="underline">Seleção isolada</a>
      <a href="/lab/sonia?mode=redirect" className="underline">Executar local com redirect real (opt-in)</a>
      <button type="button" className="underline" onClick={reset}>Restaurar template local</button>
      <span>Sem publicação, tracking, captura ou reserva.</span>
    </nav>
    </details>
    {realRedirect && view !== "builder" ? <p role="status" className="bg-amber-50 p-3 text-sm text-amber-950">Modo local real: somente Continuar após selecionar abre {SONIA_REDIRECT}. Sem tracking, captura ou reserva. Outros destinos externos permanecem bloqueados; preview padrão não abre externos.</p> : null}
    {notice ? <p role="status" className="bg-amber-50 p-3 text-sm text-amber-950">{notice}</p> : null}
    {view === "builder" ? <LayersBuilder key={nonce} initial={draft} localDraft={{ save, previewHref: "/lab/sonia" }} />
      : <LayersRunner key={nonce} funnel={draft} startIndex={view === "selection" ? selectionIndex : 0} preview localPreviewRedirect={realRedirect ? SONIA_REDIRECT : undefined} />}
  </>;
}
