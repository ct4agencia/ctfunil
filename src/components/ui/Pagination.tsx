"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

/**
 * Paginação animada (21st.dev "the-pagination", nativa com motion).
 * Janela deslizante de páginas + reticências, com realce animado (layoutId).
 */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

function Arrow({
  dir,
  disabled,
  onClick,
}: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="grid size-10 place-items-center rounded-lg border border-ct-line-strong bg-ct-surface text-ct-ink hover:bg-ct-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ct-blue disabled:opacity-40"
      aria-label={dir < 0 ? "Anterior" : "Próxima"}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );
}

export default function Pagination({
  current, total, onChange, accent = "var(--ct-action)",
}: { current: number; total: number; onChange: (p: number) => void; accent?: string }) {
  const group = useId();
  const reduced = useReducedMotion();
  if (total <= 1) return null;
  const go = (p: number) => onChange(Math.max(1, Math.min(total, p)));
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1.5">
      <Arrow dir={-1} disabled={current <= 1} onClick={() => go(current - 1)} />
      {pageWindow(current, total).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} aria-hidden="true" className="grid size-6 place-items-center text-ct-dim">…</span>
        ) : (
          <button type="button" key={p} aria-label={`Página ${p}`} aria-current={p === current ? "page" : undefined} onClick={() => go(p)}
            className="relative grid size-10 place-items-center rounded-lg text-sm font-semibold text-ct-ink hover:bg-ct-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ct-blue aria-[current=page]:text-white">
            {p === current ? (
              <motion.span layoutId={reduced ? undefined : group} className="absolute inset-0 rounded-lg"
                style={{ background: accent }} transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            ) : null}
            <span className="relative z-10">{p}</span>
          </button>
        ),
      )}
      <Arrow dir={1} disabled={current >= total} onClick={() => go(current + 1)} />
    </nav>
  );
}
