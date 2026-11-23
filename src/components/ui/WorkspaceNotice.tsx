"use client";

import { useRef, useState, type PointerEvent } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

const swipeThreshold = 64;

export default function WorkspaceNotice({ message, error = false, onDismiss }: {
  message: string;
  error?: boolean;
  onDismiss: () => void;
}) {
  const Icon = error ? CircleAlert : CircleCheck;
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) return;
    origin.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const point = origin.current;
    if (!point || point.id !== event.pointerId) return;
    origin.current = null;
    setDragging(false);
    setOffset(0);
    const dx = Math.abs(event.clientX - point.x);
    const dy = Math.abs(event.clientY - point.y);
    if (!cancelled && dx >= swipeThreshold && dx > dy) onDismiss();
  }

  return <aside className="ct-notice" data-error={error} data-dragging={dragging}
    style={{ translate: `${offset}px 0` }}
    onPointerDown={start}
    onPointerMove={event => {
      const point = origin.current;
      if (point?.id === event.pointerId) setOffset(event.clientX - point.x);
    }}
    onPointerUp={event => finish(event)}
    onPointerCancel={event => finish(event, true)}
    onLostPointerCapture={event => finish(event, true)}>
    <span role={error ? "alert" : "status"}>
      <span className="ct-notice-symbol" aria-hidden="true"><Icon size={18} /></span>
      {message}
    </span>
    <button type="button" className="ct-icon-button" aria-label="Dispensar aviso" onClick={onDismiss}><X size={16} /></button>
  </aside>;
}
