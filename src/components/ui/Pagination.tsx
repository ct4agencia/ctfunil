"use client";

import { motion } from "motion/react";

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

export default function Pagination({
  current, total, onChange, accent = "var(--q-primary, #3b82f6)",
}: { current: number; total: number; onChange: (p: number) => void; accent?: string }) {
  if (total <= 1) return null;
  const go = (p: number) => onChange(Math.max(1, Math.min(total, p)));
  const Arrow = ({ dir, disabled }: { dir: -1 | 1; disabled: boolean }) => (
    <button onClick={() => go(current + dir)} disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-400 disabled:opacity-30"
      aria-label={dir < 0 ? "Anterior" : "Próxima"}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );
  return (
    <nav className="flex items-center justify-center gap-1.5">
      <Arrow dir={-1} disabled={current <= 1} />
      {pageWindow(current, total).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="grid h-9 w-9 place-items-center text-neutral-400">…</span>
        ) : (
          <button key={p} onClick={() => go(p)}
            className="relative grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold transition"
            style={{ color: p === current ? "#fff" : "#4b5563" }}>
            {p === current ? (
              <motion.span layoutId="pg-active" className="absolute inset-0 rounded-lg"
                style={{ background: accent }} transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            ) : null}
            <span className="relative z-10">{p}</span>
          </button>
        ),
      )}
      <Arrow dir={1} disabled={current >= total} />
    </nav>
  );
}
