"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

/** Acha o ancestral rolável (preview = div do "celular"; live = a própria janela). */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
}

/**
 * Seta pulsante "role para baixo": aparece quando há conteúdo abaixo da dobra,
 * some ao chegar perto do fim. Clicável. Funciona tanto no funil ao vivo (rola
 * a janela) quanto no preview do construtor (rola o "celular"). Reavalia em `dep`.
 */
export function ScrollHint({ dep }: { dep?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sc = scrollParent(ref.current);
    const target: HTMLElement | Window = sc ?? window;
    const check = () => {
      if (sc) {
        setShow(sc.scrollHeight - sc.clientHeight > 60 && sc.scrollTop < sc.scrollHeight - sc.clientHeight - 80);
      } else {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setShow(max > 60 && window.scrollY < max - 80);
      }
    };
    const t = setTimeout(check, 350);
    target.addEventListener("scroll", check, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", check);
    return () => { clearTimeout(t); target.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [dep]);

  const go = () => {
    const sc = scrollParent(ref.current);
    if (sc) sc.scrollBy({ top: sc.clientHeight * 0.7, behavior: "smooth" });
    else window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" });
  };

  return (
    <>
      <div ref={ref} className="hidden" aria-hidden />
      {show ? (
        <motion.button
          type="button" onClick={go}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, y: [0, 7, 0] }}
          transition={{ y: { duration: 1.2, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 }, scale: { duration: 0.3 } }}
          className="fixed bottom-[98px] left-1/2 z-30 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full text-white"
          style={{ background: "var(--q-primary)", boxShadow: "0 8px 22px -6px var(--q-primary)" }}
          aria-label="Rolar para baixo"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.button>
      ) : null}
    </>
  );
}

/** Regex de marcação rica: `==pílula==`, `**negrito**` e `*negrito*` (simples). */
export const RICH_RE = /(==[^=]+==|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

/**
 * Texto rico estilo vivadevelas: `==destaque==` vira pílula gradiente âmbar
 * (texto branco); `**negrito**` E `*negrito*` viram realce na cor primária.
 * Mantém quebras de linha. Tudo theme-driven (usa --q-primary).
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(RICH_RE).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith("==") && p.endsWith("==")) {
          return (
            <span key={i} className="mx-0.5 inline-block rounded-xl px-2.5 py-0.5 font-extrabold text-white shadow-[0_6px_16px_-6px_var(--q-primary)]"
              style={{ background: "linear-gradient(95deg, var(--q-primary), color-mix(in srgb, var(--q-primary) 62%, #ffd9a8))" }}>
              {p.slice(2, -2)}
            </span>
          );
        }
        if (p.startsWith("**") && p.endsWith("**")) {
          return <b key={i} className="font-extrabold text-[var(--q-primary)]">{p.slice(2, -2)}</b>;
        }
        if (p.startsWith("*") && p.endsWith("*")) {
          return <b key={i} className="font-extrabold text-[var(--q-primary)]">{p.slice(1, -1)}</b>;
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </span>
  );
}

/** Barra de progresso fixa no topo + logo + voltar (estilo Zenlya/inlead). */
export function TopBar({
  percent,
  logo,
  onBack,
  showBack,
}: {
  percent: number;
  logo?: string;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 bg-[var(--q-bg)]/90 backdrop-blur-sm px-4 pt-3 pb-2">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className={`shrink-0 text-[var(--q-primary)] transition ${showBack ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/10">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(90deg, var(--q-primary), var(--q-primary-dark))" }}
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-sm font-bold text-[var(--q-primary)]">
          {Math.round(percent)}%
        </span>
      </div>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="mx-auto mt-2 h-7 w-auto object-contain" />
      ) : null}
    </header>
  );
}

/** Botão CTA principal — usa a cor primária da paleta + pulse/shine. */
export function CtaButton({
  children,
  onClick,
  disabled,
  type = "button",
  pulse = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  pulse?: boolean;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      className={`fx-shine relative w-full overflow-hidden rounded-2xl px-6 py-4 text-center text-[17px] font-extrabold tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${pulse && !disabled ? "fx-pulse" : ""}`}
      style={{
        background: "linear-gradient(95deg, var(--q-primary), color-mix(in srgb, var(--q-primary) 64%, #ffd9a8))",
        boxShadow: disabled ? "none" : "0 14px 30px -10px var(--q-primary), inset 0 1px 0 rgba(255,255,255,.35)",
      }}
    >
      <span className="relative z-[2]">{children}</span>
    </motion.button>
  );
}

/** Opção de pergunta (single/multi). */
export function OptionButton({
  label,
  emoji,
  image,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  emoji?: string;
  image?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-[15px] font-semibold transition disabled:opacity-60"
      style={{
        borderColor: selected ? "var(--q-ring)" : "color-mix(in srgb, var(--q-primary) 16%, transparent)",
        background: selected
          ? "linear-gradient(95deg, var(--q-primary), color-mix(in srgb, var(--q-primary) 64%, #ffd9a8))"
          : "var(--q-bg-soft)",
        color: selected ? "#fff" : "var(--q-text)",
        boxShadow: selected ? "0 12px 28px -10px var(--q-primary)" : "0 1px 0 rgba(0,0,0,.03)",
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
      ) : emoji ? (
        <span className="text-2xl leading-none">{emoji}</span>
      ) : null}
      <span className="flex-1">{label}</span>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[13px] transition"
        style={{
          borderColor: selected ? "rgba(255,255,255,.85)" : "color-mix(in srgb, var(--q-primary) 30%, transparent)",
          background: selected ? "rgba(255,255,255,.2)" : "transparent",
          color: "#fff",
        }}>
        {selected ? "✓" : ""}
      </span>
    </motion.button>
  );
}

/** Container central de cada lâmina, com fade-in-up. */
export function StepShell({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-32 ${center ? "justify-center" : "justify-start pt-4"}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Rodapé fixo com o CTA (não rola junto). `bare` = sem o gradiente de fundo
 * (usado nas lâminas com fundo full-screen, ex: roleta — senão aparece um
 * "fade" cor-creme atrás do botão que destoa do fundo).
 */
export function StickyCta({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <div className={`sticky bottom-0 z-10 mx-auto w-full max-w-md px-5 pb-5 pt-3 ${bare ? "" : "bg-gradient-to-t from-[var(--q-bg)] via-[var(--q-bg)] to-transparent"}`}>
      {children}
    </div>
  );
}
