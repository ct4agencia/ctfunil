"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { fireMetaEvent } from "@/lib/tracking";
import type { Layer, InleadOption, InleadDesign } from "@/lib/quiz/layers/types";

/** Contexto passado a cada bloco. */
export interface LayersCtx {
  design: InleadDesign;
  name: string;
  setName: (v: string) => void;
  fields: Record<string, string>;
  setField: (k: string, v: string) => void;
  estado?: string;
  cidade?: string;
  funnelSlug: string;
  stepId: string;
  hasFields: boolean;
  submitting: boolean;
  submitFields: () => void;
  navigate: (dest?: string) => void;
  trackAnswer: (stepId: string, question: string, answer: string) => void;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Interpola {estado}/{nome}/{cidade} dentro do HTML do Quill. */
export function interpHtml(html: string | undefined, ctx: LayersCtx): string {
  if (!html) return "";
  return html
    .replace(/\{nome\}/gi, cap(ctx.name) || "você")
    .replace(/\{estado\}/gi, ctx.estado || "sua região")
    .replace(/\{cidade\}/gi, ctx.cidade || "sua cidade");
}

/** Texto puro de um HTML (para tracking de resposta). */
function plain(html: string | undefined): string {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** rem de strings tipo "h-[1rem]" ou "34rem". */
function remOf(v: string | undefined, fallback: number): number {
  const m = (v || "").match(/([\d.]+)rem/);
  return m ? parseFloat(m[1]) : fallback;
}

const ROUND: Record<string, string> = {
  "rounded-none": "0", "rounded": ".5rem", "rounded-lg": ".75rem",
  "rounded-xl": "1rem", "rounded-2xl": "1rem", "rounded-3xl": "1.5rem", "rounded-full": "9999px",
};
function radius(d: InleadDesign): string { return ROUND[d.rounded || "rounded-2xl"] || "1rem"; }

/** HTML do Quill renderizado verbatim (cores/negrito inline preservados). */
function Html({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <div className={`lyr-html ${className || ""}`} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─────────────────────────────── TEXT ───────────────────────────────
function TextBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const basis = Number(layer.design?.basis) || 100;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: `${basis}%` }}>
      <Html html={interpHtml(layer.content.text, ctx)} style={{ fontSize: `${remContent(ctx)}px`, color: ctx.design.contentColor || "#000" }} />
    </div>
  );
}
function remContent(ctx: LayersCtx): number { return Number(ctx.design.contentSize) || 17; }

// ─────────────────────────────── CLEAR ──────────────────────────────
function ClearBlock({ layer }: { layer: Layer }) {
  return <div style={{ height: `${remOf(layer.content.clear, 1)}rem` }} />;
}

// ─────────────────────────────── ALERT ──────────────────────────────
function AlertBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const delay = layer.effects?.starts ?? layer.content?.starts ?? 0;
  const [show, setShow] = useState(!delay);
  useEffect(() => {
    if (!delay) return;
    const t = setTimeout(() => setShow(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  const style = layer.design?.style || "default";
  const pad = Number(layer.design?.padding) || 16;
  const theme = ctx.design.themeColor || "#ea580c";
  const tint =
    style === "danger" ? { bg: "#fff7ed", border: theme }
    : style === "success" ? { bg: "#f0fdf4", border: "#86efac" }
    : style === "theme" ? { bg: "#f8fafc", border: theme }
    : { bg: "#f8fafc", border: "#e2e8f0" };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full"
      style={{ background: tint.bg, border: `${layer.design?.borderWidth ?? 1}px solid ${tint.border}`, borderRadius: radius(ctx.design), padding: pad }}>
      <Html html={interpHtml(layer.content.text, ctx)} style={{ fontSize: `${remContent(ctx)}px` }} />
    </motion.div>
  );
}

// ─────────────────────────────── IMAGE ──────────────────────────────
function ImageBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const src = layer.content.image?.src;
  if (!src) return null;
  const basis = Number(layer.design?.basis) || 100;
  return (
    <div className="mx-auto flex w-full justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: `${basis}%`, borderRadius: radius(ctx.design) }} className="h-auto object-contain" />
    </div>
  );
}

// ─────────────────────────────── BUTTON ─────────────────────────────
function ButtonBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const d = layer.design || {};
  const basis = Number(d.basis) || 100;
  const bg = d.backgroundColor || ctx.design.themeColor || "#ea580c";
  const dest = c.destination || (c.type === "next" ? "next" : c.destination);
  const isExternal = typeof dest === "string" && /^https?:\/\//i.test(dest);

  // revealAt: botão de checkout só aparece após N segundos (pitch da VSL)
  const revealAt = Number(c.revealAt) || 0;
  const [reveal, setReveal] = useState(revealAt <= 0);
  useEffect(() => {
    if (reveal) return;
    const t = setTimeout(() => setReveal(true), revealAt * 1000);
    return () => clearTimeout(t);
  }, [reveal, revealAt]);

  const onClick = () => {
    if (ctx.hasFields) { ctx.submitFields(); return; }
    if (isExternal) fireMetaEvent("InitiateCheckout");
    ctx.navigate(dest);
  };

  if (!reveal) {
    return <p className="mx-auto w-full text-center text-sm opacity-60">{c.waitText || "⏳ Assista o vídeo para liberar o acesso…"}</p>;
  }
  return (
    <div className="mx-auto w-full" style={{ maxWidth: `${basis}%` }}>
      <motion.button
        onClick={onClick} disabled={ctx.submitting}
        initial={revealAt > 0 ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        className="w-full font-bold disabled:opacity-60"
        style={{
          background: bg, color: d.color || "#fff",
          border: d.borderColor ? `1px solid ${d.borderColor}` : "none",
          borderRadius: radius(ctx.design), minHeight: ctx.design.elementSize || "64px",
          fontSize: `${remContent(ctx) + 1}px`, padding: "0 1.25rem",
          boxShadow: "0 12px 24px -10px rgba(0,0,0,.3)",
        }}>
        {ctx.submitting ? "Enviando…" : c.label}
      </motion.button>
    </div>
  );
}

// ─────────────────────── EMBED / VÍDEO (VTurb) ──────────────────────
/** Injeta o embed do player (seta innerHTML + RE-EXECUTA os <script>). */
function EmbedBlock({ layer }: { layer: Layer }) {
  const html = layer.content.embedHtml || layer.content.html || layer.content.text || "";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !html) return;
    el.innerHTML = html;
    el.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      if (!old.src) s.textContent = old.textContent;
      s.async = true;
      document.head.appendChild(s);
      old.remove();
    });
    return () => { el.innerHTML = ""; };
  }, [html]);
  return <div ref={ref} className="mx-auto w-full overflow-hidden rounded-2xl shadow-2xl" />;
}

// ─────────────────────────────── OPTIONS ────────────────────────────
/** chevron ">" para o ícone das opções (icon "select"/"right"). */
function Chevron({ color }: { color: string }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ border: `2px solid ${color}` }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </span>
  );
}
function OptionsBlock({ layer, ctx, question }: { layer: Layer; ctx: LayersCtx; question: string }) {
  const c = layer.content;
  const d = layer.design || {};
  const opts = c.options || [];
  const theme = ctx.design.themeColor || "#ea580c";
  // colunas: design.grid ("grid-cols-2") tem prioridade sobre content.cols
  const cols = Math.max(1, parseInt(String(d.grid || c.cols || "grid-cols-1").replace(/\D/g, "")) || 1);
  // espessura da borda: "border-[4px]" → 4px | "border" → 1px
  const bw = (() => { const m = String(d.border || "border").match(/\[(\d+)px\]/); return m ? parseInt(m[1]) : 1; })();
  // fundo "contrast" = leve tom do tema (pêssego); senão branco
  const contrast = d.background === "contrast";
  const cardBg = contrast ? `color-mix(in srgb, ${theme} 9%, #ffffff)` : "#ffffff";
  const shadow = /lg/.test(d.shadow || "") ? "0 12px 24px -12px rgba(0,0,0,.25)" : /md/.test(d.shadow || "") ? "0 8px 16px -12px rgba(0,0,0,.2)" : "0 6px 16px -12px rgba(0,0,0,.18)";
  const showIcon = d.icon && d.icon !== "none";
  const iconStart = d.iconPosition === "start";
  const multiple = !!c.multiple;
  const [sel, setSel] = useState<string[]>([]);

  const pick = (o: InleadOption) => {
    if (multiple) { setSel((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id])); return; }
    ctx.trackAnswer(ctx.stepId, plain(question), plain(o.label));
    ctx.navigate(o.destination || "next");
  };

  return (
    <div className="mx-auto grid w-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: ".55rem" }}>
      {opts.map((o) => {
        const img = o.image?.type === "image" ? o.image?.src : null;
        const emoji = o.image?.type === "emoji" ? o.image?.src : o.emoji;
        const active = sel.includes(o.id);
        return (
          <motion.button key={o.id} onClick={() => pick(o)} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 text-left transition"
            style={{
              borderRadius: radius(ctx.design), minHeight: ctx.design.elementSize || "64px",
              background: cardBg,
              border: `${bw}px solid ${active ? theme : contrast ? `color-mix(in srgb, ${theme} 55%, #ffffff)` : "#e5e7eb"}`,
              boxShadow: active ? `0 0 0 2px ${theme}` : shadow,
              padding: ".75rem 1rem", justifyContent: cols > 1 ? "center" : "flex-start",
            }}>
            {showIcon && iconStart ? <Chevron color={theme} /> : null}
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : emoji ? <span className="text-2xl">{emoji}</span> : null}
            <Html html={interpHtml(o.label, ctx)} className={cols > 1 ? "" : "flex-1"} style={{ fontSize: `${remContent(ctx)}px`, fontWeight: 500, color: ctx.design.contentColor || "#000" }} />
            {showIcon && !iconStart ? <Chevron color={theme} /> : null}
          </motion.button>
        );
      })}
      {multiple ? (
        <button onClick={() => { ctx.trackAnswer(ctx.stepId, plain(question), sel.map((id) => plain(opts.find((o) => o.id === id)?.label)).join(", ")); ctx.navigate("next"); }}
          className="mt-1 w-full font-bold text-white"
          style={{ background: theme, borderRadius: radius(ctx.design), minHeight: "56px", gridColumn: `1 / -1` }}>
          Continuar
        </button>
      ) : null}
    </div>
  );
}

// ─────────────────────────────── FIELD ──────────────────────────────
function maskPhoneBr(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function FieldBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const key = c.name || c.id || "campo";
  const val = ctx.fields[key] || "";
  const onChange = (raw: string) => {
    const v = c.mask === "phone_br" || c.type === "phone" ? maskPhoneBr(raw) : raw;
    ctx.setField(key, v);
    if (key === "nome") ctx.setName(v);
  };
  return (
    <div className="mx-auto w-full text-left">
      {c.title ? <label className="mb-1.5 block text-sm font-semibold" style={{ color: ctx.design.contentColor || "#000" }}>{c.title}</label> : null}
      <input
        value={val} onChange={(e) => onChange(e.target.value)}
        placeholder={c.placeholder} inputMode={c.type === "phone" ? "tel" : "text"}
        className="w-full border bg-white px-4 py-3.5 outline-none focus:ring-2"
        style={{ borderRadius: radius(ctx.design), borderColor: "#e5e7eb", fontSize: `${remContent(ctx)}px` }}
      />
    </div>
  );
}

// ─────────────────────────────── LOADING ────────────────────────────
function LoadingBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const secs = Number(c.seconds) || 4;
  const [pct, setPct] = useState(Number(c.starts) || 0);
  const done = useRef(false);
  useEffect(() => {
    const start = (Number(c.starts) || 0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, start + ((now - t0) / (secs * 1000)) * (100 - start));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else if (!done.current) { done.current = true; setTimeout(() => ctx.navigate(c.destination || "next"), 300); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      {c.show_title && c.title ? <p className="mb-2 font-bold" style={{ fontSize: `${remContent(ctx) + 2}px` }}>{c.title}</p> : null}
      {c.show_progress !== false ? (
        <div className="mx-auto h-2.5 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: ctx.design.themeColor }} />
        </div>
      ) : null}
      {c.show_percent ? <p className="mt-2 text-sm font-semibold" style={{ color: ctx.design.themeColor }}>{Math.round(pct)}%</p> : null}
      {c.description ? <Html html={interpHtml(c.description, ctx)} className="mt-3 text-sm opacity-70" /> : null}
    </div>
  );
}

// ─────────────────────────────── TIMER ──────────────────────────────
function TimerBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const d = layer.design || {};
  const [left, setLeft] = useState(Number(layer.content.time) || 300);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const txt = interpHtml(layer.content.text, ctx).replace(/\[time\]/g, `${mm}:${ss}`);
  return (
    <div className="mx-auto w-full text-center"
      style={{ background: d.backgroundColor || "#e3eeff", color: d.color || "#1c72f1", border: `1px solid ${d.borderColor || "#c7dcfe"}`, borderRadius: radius(ctx.design), padding: d.padding || 10 }}>
      <Html html={txt} style={{ color: d.color || "#1c72f1", fontWeight: 700 }} />
    </div>
  );
}

// ──────────────────────────── NOTIFICATION ──────────────────────────
function NotificationBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const [show, setShow] = useState(false);
  useEffect(() => {
    const showT = setTimeout(() => setShow(true), 1500);
    let hideT: ReturnType<typeof setTimeout>;
    if (c.duration) hideT = setTimeout(() => setShow(false), 1500 + c.duration * 1000);
    return () => { clearTimeout(showT); if (hideT) clearTimeout(hideT); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const d = layer.design || {};
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      className="fixed bottom-4 left-4 z-50 max-w-[78%] shadow-xl"
      style={{ background: d.backgroundColor || "#52525b", color: d.color || "#fff", borderRadius: radius(ctx.design), padding: "10px 14px", pointerEvents: "none" }}>
      <Html html={interpHtml(c.text, ctx)} style={{ fontSize: "13px", color: d.color || "#fff" }} />
    </motion.div>
  );
}

// ─────────────────────────────── GRAPHICS ───────────────────────────
function GraphicsBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const g = (layer.content.graphics || [])[0];
  if (!g) return null;
  const pct = Number(g.percent) || 0;
  const color = g.style || "#16a34a";
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (n: number) => { const p = Math.min(pct, (n - t0) / 1400 * pct); setVal(p); if (p < pct) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="mx-auto w-full text-center">
      <div className="relative mx-auto" style={{ width: 150, height: 150 }}>
        <svg width="150" height="150" viewBox="0 0 130 130" className="-rotate-90">
          <circle cx="65" cy="65" r={R} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - (val / 100) * C} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-3xl font-extrabold" style={{ color }}>{Math.round(val)}%</span>
        </div>
      </div>
      {g.legend ? <Html html={interpHtml(g.legend, ctx)} className="mt-3" /> : null}
    </div>
  );
}

// ─────────────────────────── DISPATCHER ─────────────────────────────
export function Block({ layer, ctx, question }: { layer: Layer; ctx: LayersCtx; question: string }) {
  switch (layer.type) {
    case "text": return <TextBlock layer={layer} ctx={ctx} />;
    case "clear": return <ClearBlock layer={layer} />;
    case "alert": return <AlertBlock layer={layer} ctx={ctx} />;
    case "image": return <ImageBlock layer={layer} ctx={ctx} />;
    case "button": return <ButtonBlock layer={layer} ctx={ctx} />;
    case "options": return <OptionsBlock layer={layer} ctx={ctx} question={question} />;
    case "field": return <FieldBlock layer={layer} ctx={ctx} />;
    case "loading": return <LoadingBlock layer={layer} ctx={ctx} />;
    case "timer": return <TimerBlock layer={layer} ctx={ctx} />;
    case "notification": return <NotificationBlock layer={layer} ctx={ctx} />;
    case "graphics": return <GraphicsBlock layer={layer} ctx={ctx} />;
    case "embed": case "video": return <EmbedBlock layer={layer} />;
    default: return null;
  }
}
