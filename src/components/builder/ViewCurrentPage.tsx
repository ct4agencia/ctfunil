"use client";

import { useRef, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { PreviewScrollContext } from "@/components/quiz/layers/PreviewScrollContext";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";

export default function ViewCurrentPage({ children, stages, initialStageId, disabled, prepare }: {
  children: ReactNode | ((stageId: string) => ReactNode);
  stages?: { value: string; label: string }[];
  initialStageId?: string;
  disabled?: boolean;
  prepare?: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [previewSession, setPreviewSession] = useState(0);
  const [opening, setOpening] = useState(false);
  const [stageId, setStageId] = useState("");

  async function show() {
    if (opening || disabled) return;
    setOpening(true);
    try {
      if (prepare && !await prepare()) return;
      if (!dialog.current?.isConnected) return;
      setStageId(initialStageId ?? "");
      setPreviewSession(session => session + 1);
      dialog.current.showModal();
      scrollContainer.current?.scrollTo({ top: 0, behavior: "instant" });
      setOpen(true);
    } finally {
      setOpening(false);
    }
  }

  return <>
    <button ref={trigger} type="button" className="ct-primary rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      disabled={opening || disabled} onClick={() => void show()}>
      {opening ? "Abrindo visualização…" : "Visualizar página"}
    </button>
    <dialog ref={dialog} aria-label="Visualizar página" onClose={() => {
      if (dialog.current?.open) return;
      setOpen(false);
      trigger.current?.focus();
    }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-white">
      <div className="ct-workspace flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ct-line bg-ct-surface px-4 py-2">
          <button type="button" className="ct-action-link" onClick={() => dialog.current?.close()}>
            Voltar à edição
          </button>
          {open && stages && stages.length > 1 && <WorkspaceSelect key={previewSession} searchable label="Etapa de início"
            value={stageId} onChange={value => {
              if (value === stageId) return;
              setStageId(value);
              scrollContainer.current?.scrollTo({ top: 0, behavior: "instant" });
            }} options={stages} />}
        </div>
        <div ref={scrollContainer} tabIndex={-1} role="region" aria-label="Conteúdo da prévia" className="min-h-0 flex-1 overflow-auto">
          {open && <PreviewScrollContext.Provider key={previewSession} value={scrollContainer}>
            <MotionConfig reducedMotion="user">{typeof children === "function" ? children(stageId) : children}</MotionConfig>
          </PreviewScrollContext.Provider>}
        </div>
      </div>
    </dialog>
  </>;
}
