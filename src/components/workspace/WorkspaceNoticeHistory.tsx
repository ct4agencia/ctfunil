"use client";

import { Bell, Ellipsis, X } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";

type Notice = { id: number; message: string; error: boolean; time: string; area: string };
const empty: Notice[] = [];
let history = empty;
let sequence = 0;
const subscribers = new Set<() => void>();
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function updateHistory(next: Notice[]) {
  history = next;
  subscribers.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

export function recordWorkspaceNotice(area: string, message: string, error = false) {
  const item = { id: ++sequence, area, message, error, time: time.format(new Date()) };
  updateHistory([item, ...history].slice(0, 20));
  return item;
}

export function clearWorkspaceNotices() {
  updateHistory(empty);
}

export default function WorkspaceNoticeHistory() {
  const entries = useSyncExternalStore(subscribe, () => history, () => empty);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ notice: number; pointer: number; x: number; y: number } | null>(null);
  const [openActions, setOpenActions] = useState<number | null>(null);

  function endSwipe(event: PointerEvent<HTMLLIElement>) {
    const start = gesture.current;
    if (!start || start.pointer !== event.pointerId) return;
    gesture.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    setOpenActions(dx < 0 ? start.notice : null);
  }

  function removeNotice(id: number) {
    updateHistory(history.filter(item => item.id !== id));
    setOpenActions(null);
    closeButton.current?.focus();
  }
  return <>
    <button type="button" className="ct-editor-notices ct-expand-icon" onClick={() => dialog.current?.showModal()}
      aria-label="Histórico de avisos" aria-haspopup="dialog" title="Histórico de avisos"><Bell size={16} aria-hidden="true" /><span className="ct-expand-icon-label" aria-hidden="true">Avisos</span></button>
    <dialog ref={dialog} className="ct-confirm ct-notice-history" aria-labelledby={title} onClose={() => setOpenActions(null)}
      onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={title} className="font-semibold">Histórico de avisos</h2>
        <button type="button" ref={closeButton} className="ct-icon-button" autoFocus aria-label="Fechar histórico" onClick={() => dialog.current?.close()}><X size={16} /></button>
      </div>
      {entries.length ? (
        <ol className="ct-notice-history-list">
          {entries.map(({ id, area, message, error, time }) => (
            <li key={id} className="ct-notice-history-entry" onPointerDown={event => {
              if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) return;
              gesture.current = { notice: id, pointer: event.pointerId, x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerUp={endSwipe} onPointerCancel={() => { gesture.current = null; }}>
              <div className="ct-notice-history-summary">
                <div>
                  <span className="text-xs text-ct-dim">{time} · {area} · {error ? "Falha" : "Concluído"}</span>
                  <p className="text-sm">{message}</p>
                </div>
                <button type="button" className="ct-icon-button" aria-label={`Ações do aviso: ${message}`}
                  aria-expanded={openActions === id} onClick={() => setOpenActions(current => current === id ? null : id)}>
                  <Ellipsis size={17} aria-hidden="true" />
                </button>
              </div>
              {openActions === id && <div className="ct-notice-history-actions">
                <button type="button" className="ct-confirm-delete" onClick={() => removeNotice(id)}>Remover do histórico</button>
              </div>}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-ct-dim">Ainda não há avisos nesta sessão.</p>}
    </dialog>
  </>;
}
