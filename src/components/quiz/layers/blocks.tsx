"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fireMetaEvent } from "@/lib/tracking";
import { attachVslWatch } from "@/lib/quiz/vsl-watch";
import { interpEstado } from "@/lib/quiz/estado";
import { DedoArrasta } from "../ui";
import dynamic from "next/dynamic";
import { entradaBloco, prefereMenosMovimento, DUR, EASE } from "@/lib/quiz/motion";
import { estiloOpcao, estiloCheck, gradienteTema } from "@/lib/quiz/resina";
import type { Layer, InleadOption, InleadDesign } from "@/lib/quiz/layers/types";

// Tela do bloco `loading` no estilo "diagnóstico", dividida com o motor tipado.
// `dynamic` porque a maioria das lâminas de loading usa a barra simples e não
// deve baixar o anel + as caixas.
const ResinaDiagnostico = dynamic(() => import("../ResinaDiagnostico"), { ssr: false });
// Barras rotuladas + micro-perguntas — mesma tela do motor tipado.
const Checklist = dynamic(() => import("../Checklist"), { ssr: false });

/** Modo de edição no canvas (construtor inline estilo inlead). Off = runtime normal. */
export interface LayersEdit {
  selectedId?: string;
  onSelect: (id: string) => void;
  onAction: (id: string, action: "copy" | "hide" | "delete") => void;
  /** reordena blocos no canvas (drag & drop) */
  onReorder?: (activeId: string, overId: string) => void;
}
export const LayersEditContext = createContext<LayersEdit | null>(null);

/** Toolbar flutuante do bloco selecionado (⠿ arrastar · copiar · ocultar · excluir). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BlockToolbar({ onAction, dragProps }: { onAction: (a: "copy" | "hide" | "delete") => void; dragProps?: any }) {
  const Btn = ({ a, title, children }: { a: "copy" | "hide" | "delete"; title: string; children: React.ReactNode }) => (
    <button title={title} onClick={(e) => { e.stopPropagation(); onAction(a); }} className="grid h-6 w-6 place-items-center rounded text-white/90 hover:bg-white/20">{children}</button>
  );
  return (
    <div data-block-toolbar className="absolute -top-7 left-0 z-30 flex items-center gap-0.5 rounded-md bg-blue-600 px-1 py-0.5 text-xs shadow-lg" onClick={(e) => e.stopPropagation()}>
      <span {...(dragProps || {})} className="cursor-grab touch-none px-1 text-base leading-none text-white/90 active:cursor-grabbing" title="Arrastar para reordenar">⠿</span>
      <Btn a="copy" title="Duplicar">⧉</Btn>
      <Btn a="hide" title="Ocultar">◐</Btn>
      <Btn a="delete" title="Excluir">🗑</Btn>
    </div>
  );
}

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
  preview?: boolean;
  hasFields: boolean;
  submitting: boolean;
  submitFields: () => void;
  navigate: (dest?: string) => void;
  trackAnswer: (stepId: string, question: string, answer: string) => void;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Revela o filho após `delay` segundos (effects.starts do inlead). */
export function Reveal({ delay, children }: { delay?: number; children: React.ReactNode }) {
  const d = Number(delay) || 0;
  const [show, setShow] = useState(d <= 0);
  useEffect(() => {
    if (d <= 0) return;
    const t = setTimeout(() => setShow(true), d * 1000);
    return () => clearTimeout(t);
  }, [d]);
  if (d <= 0) return <>{children}</>;
  if (!show) return null;
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>{children}</motion.div>;
}

/** Interpola {estado}/{nome}/{cidade} dentro do HTML do Quill. */
export function interpHtml(html: string | undefined, ctx: LayersCtx): string {
  if (!html) return "";
  let out = html
    // &nbsp; (espaço inquebrável do Quill) → espaço normal, senão a frase vira
    // uma "palavra" gigante e estoura a largura (igual o render do inlead faz).
    .replace(/&nbsp;/g, " ")
    .replace(/\{nome\}/gi, cap(ctx.name) || "você");
  // {estado} com concordância de preposição (da Bahia / do Paraná / de São Paulo)
  out = interpEstado(out, ctx.estado);
  return out.replace(/\{cidade\}/gi, ctx.cidade || "sua cidade");
}

/** Texto puro de um HTML (para tracking de resposta). */
function plain(html: string | undefined): string {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** rem de strings tipo "h-[1rem]" ou "34rem". */
/**
 * Lê "h-[2rem]" e devolve 2. Aceita número cru também: os `steps` vêm de JSONB
 * e nada no banco garante o tipo, então um `clear: 2` gravado por script fazia
 * `v.match` estourar TypeError — e um throw aqui derruba a lâmina inteira, não
 * só o espaçamento. Vale para toda leitura de `content`: o motor renderiza dado
 * de fora, e dado de fora vem torto.
 */
function remOf(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = (typeof v === "string" ? v : "").match(/([\d.]+)rem/);
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

// ── alinhamento (design.align) + opacidade (design.opacity) genéricos por bloco ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hAlign(d?: any): string { const a = d?.align; return a === "left" ? "mr-auto ml-0" : a === "right" ? "ml-auto mr-0" : "mx-auto"; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function justifyOf(d?: any): string { const a = d?.align; return a === "left" ? "justify-start" : a === "right" ? "justify-end" : "justify-center"; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function opacityOf(d?: any): number | undefined { const o = d?.opacity; return o == null || Number(o) >= 100 ? undefined : Number(o) / 100; }

// ─────────────────────────────── TEXT ───────────────────────────────
function TextBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const basis = Number(layer.design?.basis) || 100;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = layer.design as any;
  // alinhamento: design.align tem prioridade; senão lê a classe ql-align do HTML
  const m = (layer.content.text || "").match(/ql-align-(center|right|justify)/);
  const textAlign = (d?.align as "left" | "center" | "right") || (m?.[1] as "center" | "right" | "justify") || "left";
  const fs = Number(d?.fontSize) || remContent(ctx); // tamanho por bloco (sobrepõe o global)
  return (
    <div className={`${hAlign(d)} w-full`} style={{ maxWidth: `${basis}%`, textAlign }}>
      <Html html={interpHtml(layer.content.text, ctx)} style={{ fontSize: `${fs}px`, color: ctx.design.contentColor || "#000" }} />
    </div>
  );
}
function remContent(ctx: LayersCtx): number { return Number(ctx.design.contentSize) || 17; }

// ─────────────────────────────── CLEAR ──────────────────────────────
function ClearBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const alt = remOf(layer.content.clear, 1);
  /* FILETE: o mesmo espaço, com um traço curto no meio. É o divisor da
     referência — antes ficava fixo dentro das telas de hero e VSL, então não
     aparecia no construtor nem podia ser tirado. */
  if (layer.content.linha) {
    const cor = ctx.design.themeColor || "#ea580c";
    return (
      <div className="flex w-full items-center justify-center" style={{ height: `${alt}rem` }}>
        <span
          className="rounded-sm"
          style={{
            width: Number(layer.design?.basis) || 48, height: 3,
            background: gradienteTema(cor), opacity: 0.7,
          }}
        />
      </div>
    );
  }
  return <div style={{ height: `${alt}rem` }} />;
}

// ─────────────────────────────── ALERT ──────────────────────────────
function AlertBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const style = layer.design?.style || "default";
  const pad = Number(layer.design?.padding) || 16;
  const theme = ctx.design.themeColor || "#ea580c";
  /* PÍLULA: cápsula preenchida com o gradiente do tema, centrada. É o "selo"
     do topo da captura — que antes vivia fixo dentro da tela e por isso não
     aparecia no construtor nem podia ser editado. */
  if (style === "pilula") {
    return (
      <div className="flex w-full justify-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-white sm:text-sm"
          style={{ background: gradienteTema(theme), boxShadow: `0 4px 16px ${theme}66` }}
        >
          <Html html={interpHtml(layer.content.text, ctx)} />
        </motion.span>
      </div>
    );
  }
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
  const im = layer.content.image;
  const src = im?.src;
  if (!src) return null;
  const basis = Number(layer.design?.basis) || 100;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (layer.design || {}) as any;
  const fade = d.fade as "top" | "bottom" | "both" | undefined;
  const fullBleed = !!d.fullBleed;
  const bg = ctx.design.backgroundColor || "#ffffff";
  // fade FLUIDO: usa a própria cor do fundo com alfa 0 (mesma tonalidade) em vez de
  // `transparent` (que é preto-transparente e cria uma linha cinza no meio do gradiente).
  const transp = /^#[0-9a-f]{6}$/i.test(bg) ? `${bg}00` : "transparent";
  // INTENSIDADE: maior = zona MENOR (desce menos) + fade mais forte. O fundo fica
  // sólido no topo (cobre a borda) e dissolve numa faixa curta perto da borda.
  const v = Math.min(90, Math.max(10, Number(d.fadeStrength) || 50));
  const zoneH = 70 - v * 0.5;   // v=10→65% · v=50→45% · v=90→25% (zona menor)
  const solid = 18 + v * 0.5;   // v=10→23% · v=50→43% · v=90→63% (mais sólido = mais intenso)
  const topG = `linear-gradient(to bottom, ${bg} 0%, ${bg} ${solid}%, ${transp} 100%)`;
  const botG = `linear-gradient(to top, ${bg} 0%, ${bg} ${solid}%, ${transp} 100%)`;
  const overlays = (
    <>
      {fade === "top" || fade === "both" ? <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: `${zoneH}%`, background: topG }} /> : null}
      {fade === "bottom" || fade === "both" ? <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: `${zoneH}%`, background: botG }} /> : null}
    </>
  );
  // TELA CHEIA: quebra o padding do container (px-5 = 1.25rem) → imagem encosta nas bordas da tela
  if (fullBleed) {
    return (
      <div className="relative overflow-hidden" style={{ width: "calc(100% + 2.5rem)", marginLeft: "-1.25rem", marginRight: "-1.25rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* basis > 100% amplia (imagem mais larga que a tela, recortada e centralizada) */}
        <img src={src} alt="" loading="lazy" decoding="async" className="block" style={{ width: `${basis}%`, height: "auto", marginLeft: basis > 100 ? `${(100 - basis) / 2}%` : 0 }} />
        {overlays}
      </div>
    );
  }
  /* Brilhos ao redor da peça, como na referência. Ficam FORA do <img> (que já
     tem o seu próprio `flutua`): assim eles orbitam a moldura em vez de subir e
     descer junto com ela, e cada um com duração e atraso próprios — pulsando no
     mesmo compasso, a peça inteira "respiraria" e viraria distração. */
  const brilhos = d.brilhos ? [
    { e: "✨", pos: "-top-3 -left-4", tam: 26, dur: 2.8, atraso: 0, giro: 20 },
    { e: "✨", pos: "top-10 -right-5", tam: 22, dur: 2.4, atraso: 0.6, giro: -15 },
    { e: "⭐", pos: "-bottom-2 left-3", tam: 22, dur: 3.2, atraso: 1.2, giro: 25 },
    { e: "💫", pos: "top-1/2 -right-6", tam: 18, dur: 2.6, atraso: 1.8, giro: 0 },
  ] : [];

  return (
    <div className={`flex w-full ${justifyOf(d)}`}>
      <div className="relative" style={{ width: `${basis}%` }}>
        {brilhos.map((b, i) => (
          <motion.span
            key={i} aria-hidden
            className={`pointer-events-none absolute z-20 ${b.pos}`}
            style={{ fontSize: b.tam, lineHeight: 1 }}
            animate={prefereMenosMovimento() ? {} : { scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6], rotate: [0, b.giro, 0] }}
            transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut", delay: b.atraso }}
          >{b.e}</motion.span>
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* Segue a PROPORÇÃO NATURAL da imagem (sem forçar aspect-ratio/object-contain,
            que letterboxava quando im.width/height salvos estavam errados). O slide de
            largura (basis%) escala proporcional; o alinhamento posiciona (justifyOf). */}
        {/* A PEÇA: imagem + selo + tag sobem e descem JUNTOS.
            Antes a flutuação vivia no <img> e o selo e a tag eram irmãos dele,
            parados: a pílula "GRÁTIS" ficava presa à tela enquanto a arte subia,
            e a cada ciclo descolava da quina. Agrupá-los aqui resolve sem tocar
            nos brilhos, que continuam FORA e orbitam a moldura em ritmo próprio
            — se subissem junto, a peça inteira respiraria e viraria distração. */}
        <motion.div
          className="relative block"
          animate={d.flutua && !prefereMenosMovimento() ? { y: [0, -9, 0] } : undefined}
          transition={d.flutua ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
        <img
          src={src} alt="" loading="lazy" decoding="async"
          style={{
            width: "100%", height: "auto",
            // `redonda`: a foto da professora do print. Vira círculo com anel
            // branco, para o selo ter onde encostar sem tocar o rosto.
            borderRadius: d.redonda ? "9999px" : radius(ctx.design),
            aspectRatio: d.redonda ? "1 / 1" : undefined,
            objectFit: d.redonda ? "cover" : undefined,
            boxShadow: d.redonda ? `0 0 0 5px #fff, 0 12px 34px -12px ${ctx.design.themeColor || "#ea580c"}66` : undefined,
          }}
          className="block"
        />
        {/* SELO VERIFICADO — sobreposto no canto, como no print da Sônia */}
        {d.selo === "verificado" ? (
          <motion.span
            className="absolute grid place-items-center rounded-full"
            style={{
              right: d.redonda ? "6%" : 8, bottom: d.redonda ? "4%" : 8,
              width: 42, height: 42,
              background: "linear-gradient(150deg,#38bdf8,#0284c7)",
              boxShadow: "0 0 0 3px #fff, 0 6px 16px -4px rgba(2,132,199,.6)",
              color: "#fff", fontSize: 20, fontWeight: 900,
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.35 }}
          >✓</motion.span>
        ) : null}
        {/* TAG com brilho pulsante — o "GRÁTIS" do print da apostila */}
        {d.tag ? (
          <motion.span
            className="absolute rounded-full px-3 py-1 text-[12px] font-black uppercase tracking-wide text-white"
            style={{
              right: -6, top: -6,
              background: `linear-gradient(135deg, ${d.tagCor || "#16a34a"}, ${d.tagCor || "#16a34a"}cc)`,
              transform: "rotate(6deg)",
            }}
            animate={prefereMenosMovimento() ? {} : {
              boxShadow: [
                `0 0 0 0 ${d.tagCor || "#16a34a"}00`,
                `0 0 22px 4px ${d.tagCor || "#16a34a"}99`,
                `0 0 0 0 ${d.tagCor || "#16a34a"}00`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >{String(d.tag)}</motion.span>
        ) : null}
        </motion.div>
        {overlays}
      </div>
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
  const showCountdown = !!c.countdown;
  const [reveal, setReveal] = useState(revealAt <= 0);
  const [remaining, setRemaining] = useState(revealAt);
  useEffect(() => {
    if (reveal) return;
    const t = setTimeout(() => setReveal(true), revealAt * 1000);
    return () => clearTimeout(t);
  }, [reveal, revealAt]);
  useEffect(() => {
    if (reveal || !showCountdown) return;
    const iv = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [reveal, showCountdown]);

  const onClick = () => {
    // checkout externo (ex: botão da VSL): SEMPRE avisa a Meta (InitiateCheckout)
    if (isExternal) { fireMetaEvent("InitiateCheckout"); ctx.navigate(dest); return; }
    if (ctx.hasFields) { ctx.submitFields(); return; }
    ctx.navigate(dest);
  };

  if (!reveal) {
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    const wait = c.waitText || "⏳ Assista o vídeo para liberar o acesso…";
    return <p className="mx-auto w-full text-center text-sm opacity-60">{wait}{showCountdown ? ` ${mm}:${ss}` : ""}</p>;
  }
  // Efeito de animação configurável (igual a roleta): brilho que varre + pulsar.
  // Pulsa o wrapper (não conflita com o transform do motion); brilho vai no botão.
  const effect = (d.effect as string) || "none";
  const pulseCls = effect === "pulse" || effect === "shine-pulse" ? "fx-pulse" : "";
  const shineCls = effect === "shine" || effect === "shine-pulse" ? "fx-shine" : "";
  // Botão-IMAGEM (estilo inlead: o CTA é um PNG clicável, ex. botão verde "INICIAR").
  // Se content.imageSrc estiver setado, renderiza a imagem no lugar do botão estilizado.
  const imgSrc = (c as { imageSrc?: string }).imageSrc || null;
  if (imgSrc) {
    return (
      <div className={`${hAlign(d)} w-full ${pulseCls}`} style={{ maxWidth: `${basis}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src={imgSrc} alt={c.label || ""} onClick={ctx.submitting ? undefined : onClick}
          initial={revealAt > 0 ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }} decoding="async"
          className={`mx-auto block w-full cursor-pointer select-none ${shineCls}`}
          style={{ maxWidth: "100%" }}
        />
      </div>
    );
  }
  return (
    <div className={`${hAlign(d)} w-full ${pulseCls}`} style={{ maxWidth: `${basis}%` }}>
      <motion.button
        onClick={onClick} disabled={ctx.submitting}
        initial={revealAt > 0 ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        className={`w-full font-bold disabled:opacity-60 ${shineCls}`}
        style={{
          background: bg, color: d.color || "#fff",
          border: d.borderColor ? `1px solid ${d.borderColor}` : "none",
          borderRadius: radius(ctx.design), minHeight: ctx.design.elementSize || "64px",
          fontSize: `${remContent(ctx) + 1}px`, padding: "0 1.25rem",
          // GRADIENTE + HALO da cor do botão. A referência não usa cor chapada:
          // o degradê dá volume e o halo destaca o CTA do fundo claro sem
          // precisar de borda. `sombraChapada` volta ao antigo se alguém quiser.
          ...(d.sombraChapada
            ? { boxShadow: "0 12px 24px -10px rgba(0,0,0,.3)" }
            : {
                background: `linear-gradient(135deg, ${bg} 0%, ${escurecerHex(bg, 0.18)} 100%)`,
                boxShadow: `0 13px 38px 0 ${bg}91, 0 2px 6px 0 rgba(0,0,0,.10)`,
              }),
        }}>
        {ctx.submitting ? "Enviando…" : `${c.icon ? `${c.icon} ` : ""}${c.label || ""}`}
      </motion.button>
    </div>
  );
}

/**
 * Escurece um hex em direção ao preto. Deriva o fim do degradê do botão a
 * partir da própria cor — uma cor define o par, em vez de exigir dois campos.
 * Entrada inválida devolve a própria string: o botão perde o degradê, não a cor.
 */
function escurecerHex(hex: string, fator: number): string {
  const m = /^#?([\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const esc = (c: number) => Math.round(c * (1 - fator));
  const r = esc((n >> 16) & 255), g = esc((n >> 8) & 255), b = esc(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─────────────────────────── CARROSSEL ──────────────────────────────
/** Carrossel de fotos: auto-passa a cada `interval`s + swipe com o dedo (e drag). */
function CarouselBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const imgs: string[] = (layer.content.images as string[]) || [];
  const interval = (Number(layer.content.interval) || 2) * 1000;
  const n = imgs.length;
  const [i, setI] = useState(0);
  const theme = ctx.design.themeColor || "#ea580c";
  const startX = useRef<number | null>(null);
  const go = (d: number) => setI((x) => (x + d + n) % n);

  // auto-play: re-arma a cada troca (manual ou automática) → swipe não briga com o timer
  useEffect(() => {
    if (n <= 1) return;
    const id = setTimeout(() => setI((x) => (x + 1) % n), interval);
    return () => clearTimeout(id);
  }, [i, n, interval]);

  if (!n) return null;
  const onDown = (x: number) => { startX.current = x; };
  const onUp = (x: number) => {
    if (startX.current == null) return;
    const dx = x - startX.current; startX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };
  return (
    <div className="mx-auto w-full select-none">
      <div
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchEnd={(e) => onUp(e.changedTouches[0].clientX)}
        onPointerDown={(e) => onDown(e.clientX)}
        onPointerUp={(e) => onUp(e.clientX)}
      >
        {/* FADE: as fotos ficam empilhadas e cruzam opacidade, em vez de
            deslizar. Some o "corte" entre uma e outra — pedido do Luca para a
            prova social, onde o deslize disputava atenção com a foto.
            `deslizar` continua o padrão: nenhum carrossel publicado muda. */}
        {(layer.design?.transicao as string) === "fade" ? (
          <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
            {imgs.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={src} alt="" loading={k === 0 ? undefined : "lazy"} decoding="async" draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: k === i ? 1 : 0,
                  transition: `opacity ${DUR.tela}ms cubic-bezier(${EASE.suave.join(",")})`,
                }} />
            ))}
          </div>
        ) : (
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
            {imgs.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={src} alt="" loading={k === 0 ? undefined : "lazy"} decoding="async" draggable={false} className="w-full shrink-0 object-cover" style={{ aspectRatio: "1 / 1" }} />
            ))}
          </div>
        )}
      </div>
      {n > 1 ? (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {imgs.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} className="h-2 rounded-full transition-all" style={{ width: k === i ? 18 : 8, background: k === i ? theme : "rgba(0,0,0,.18)" }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────────── DISCLAIMER ───────────────────────────
/**
 * Faixa fixa no topo da lâmina, sangrando até as bordas.
 *
 * POR QUE É BLOCO PRÓPRIO, E NÃO UM ESTILO DO ALERTA
 * Como estilo, a tela precisava ADIVINHAR qual alerta era a faixa — pegava o
 * primeiro e os demais viravam cartão comum no meio do conteúdo. Um segundo
 * disclaimer na mesma lâmina simplesmente não funcionava, sem nada explicando
 * por quê. Como tipo, é inequívoco: todo bloco `disclaimer` é faixa.
 *
 * O CONTADOR
 * `[vagas]` no texto vira um número que sobe de `vagasDe` até `vagasAte` ao
 * longo do tempo. Escassez parada lê como enfeite; escassez que anda na frente
 * do visitante lê como fila andando. A conta é do TEMPO DECORRIDO e não de
 * incrementos somados — assim o valor continua certo se a aba for para segundo
 * plano e o navegador suspender os timers.
 */
/** Nomes de vizinhança do ranking. Femininos porque é o público dos funis de
 *  artesanato e confeitaria; o painel troca a lista quando não for o caso. */
const NOMES_RANKING = [
  "Beatriz", "Camila", "Mariana", "Fernanda", "Juliana", "Patrícia",
  "Larissa", "Amanda", "Carolina", "Vanessa", "Débora", "Renata",
  "Aline", "Tatiane", "Priscila", "Bruna", "Simone", "Michele",
];

/**
 * RANKING — escassez em forma de placar.
 *
 * Mesmo relógio do `DisclaimerBlock` (que conta vagas), outra roupa: em vez de
 * "restam N vagas", a lead vê a própria posição PIORAR enquanto assiste. Perder
 * lugar pressiona mais que ver estoque cair — o número deixa de ser um recurso
 * abstrato e vira a fila que cresce na frente dela.
 *
 * Os vizinhos saem da lista de nomes pela própria posição, então TROCAM quando
 * ela cai. Nomes fixos denunciariam o teatro: a lead cairia vinte lugares com
 * as mesmas duas pessoas em volta.
 */
function RankingBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const d = layer.design || {};
  const revelarEm = Number(c.revealAt) || 0;
  const de = Number(c.posDe) || 28;
  const ate = Number(c.posAte) || 48;
  const fim = Math.max(revelarEm + 1, Number(c.fimEm) || revelarEm + 60);
  const pct = Number(c.pct) || 83;
  const rotulo = String(c.rotulo || "VOCÊ");
  const nomes = (Array.isArray(c.nomes) && c.nomes.length ? c.nomes : NOMES_RANKING) as string[];

  /* ESTRUTURA do print 1 (avatar → posição → pílula → % → anel), PALETA do
     print 2 (coral salmão + dourado quente). O print 1 veio em rosa e o 2 em
     coral: o arranjo é do primeiro, as cores do segundo.
     Tudo sobrescrevível pelo painel. */
  const coral = (d.backgroundColor as string) || "#E4735C";
  const coralClaro = "#EE8A72";
  const ouro = (d.borderColor as string) || "#D9A94E";
  const ouroEscuro = "#B8873F";
  const creme = (d.color as string) || "#FBF6EE";
  const marrom = "#5C4A3A";
  // quem pediu menos movimento vê a posição trocar sem o deslize
  const reduzido = prefereMenosMovimento();

  /* No construtor já nasce visível: o canvas existe para conferir layout, e
     obedecer o relógio o esconderia atrás de minutos de espera. */
  const [visivel, setVisivel] = useState(!!ctx.preview || revelarEm <= 0);
  const [pos, setPos] = useState(de);

  useEffect(() => {
    if (ctx.preview || revelarEm <= 0) return;
    const t = setTimeout(() => setVisivel(true), revelarEm * 1000);
    return () => clearTimeout(t);
  }, [revelarEm, ctx.preview]);

  useEffect(() => {
    const t0 = Date.now();
    const passo = () => {
      const seg = (Date.now() - t0) / 1000;
      const p = Math.min(1, Math.max(0, (seg - revelarEm) / (fim - revelarEm)));
      setPos(Math.round(de + (ate - de) * p));
    };
    passo();
    // 5s: a posição mexe enquanto se assiste, sem virar cronômetro
    const iv = setInterval(passo, 5000);
    return () => clearInterval(iv);
  }, [de, ate, revelarEm, fim]);

  if (!visivel) return null;

  const nomeDe = (p: number) => nomes[((p % nomes.length) + nomes.length) % nomes.length];
  /* As vizinhas têm % MAIOR que a da lead — é o que explica a queda. Ela está
     parada em 83% enquanto as outras avançam, então perde lugar.
     A de baixo também é maior: é quem está prestes a ultrapassá-la, e é dela
     que vem a pressão de agir agora. Com % menor embaixo, a queda não teria
     causa visível na tela e o placar contaria uma história que se contradiz. */
  const linhas = [
    { p: pos - 1, nome: nomeDe(pos - 1), pct: Number(c.pctAcima) || pct + 6, eu: false },
    { p: pos, nome: rotulo, pct, eu: true },
    { p: pos + 1, nome: nomeDe(pos + 1), pct: Number(c.pctAbaixo) || pct + 3, eu: false },
  ];

  return (
    /* TRÊS CARDS separados, não linhas de uma tabela: os de fora ficam
       rebaixados e recuados, e o do meio salta por cima deles. É a diferença
       entre "há uma lista e você está nela" e "você está aqui, olhe" — o
       segundo é o que a referência faz. */
    /* `px-1 py-2` no lugar de `overflow-hidden`: o recorte impedia o conteúdo
       de vazar, mas cortava JUNTO o halo do card da lead — a sombra morria nas
       laterais e o brilho não aparecia. O vazamento já é contido por `min-w-0`
       em cada linha; aqui basta reservar a folga para a sombra respirar. */
    <div className="w-full px-1 py-2">
      {/* `popLayout` tira quem sai do fluxo na hora: sem ele o card antigo e o
          novo ocupariam espaço juntos e a lista daria um pulo de altura no meio
          da transição. */}
      <AnimatePresence mode="popLayout" initial={false}>
      {linhas.map((l) => (
        <motion.div
          key={`${l.eu ? "eu" : "vz"}-${l.p}`}
          /* O MOVIMENTO DA QUEDA — a lista rola, ela desce.
             A LEAD entra vindo DE CIMA e sai POR BAIXO: ela desceu até ali e
             continua descendo. Com `zIndex: 2` ela passa POR CIMA do card de
             baixo durante o trajeto, que é o que se pediu.
             As VIZINHAS fazem o oposto — entram por baixo e saem por cima —
             então a lista escorre para cima enquanto a lead cai. Ver os dois
             movimentos em sentidos contrários é o que faz a queda ser sentida
             em vez de só lida. */
          initial={reduzido ? false : { y: l.eu ? -30 : 26, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduzido ? undefined : { y: l.eu ? 30 : -26, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.9 }}
          /* `min-w-0` em toda a linha: sem ele o nome longo empurrava o anel
             para fora do card — era o "load" pendurado do lado de fora. */
          className="relative flex min-w-0 items-center gap-2"
          style={
            l.eu
              ? {
                  zIndex: 2, margin: "-6px 0", padding: "12px 12px 12px 9px", borderRadius: 20,
                  /* BORDA DOURADA de 1px em GRADIENTE. Cor sólida lia como
                     contorno de formulário; o metal precisa variar de claro a
                     escuro ao longo da volta.
                     Truque das duas camadas: o preenchimento pinta só até o
                     `padding-box` e o gradiente ocupa o `border-box`, então o
                     que sobra na borda É o gradiente. É a única forma de ter
                     borda em degradê sem um segundo elemento por baixo. */
                  border: "1px solid transparent",
                  background: `linear-gradient(180deg, #fffdfb 0%, ${creme} 100%) padding-box,
                               linear-gradient(150deg, #F0DCA8 0%, ${ouro} 38%, ${ouroEscuro} 62%, #EBD49A 100%) border-box`,
                  /* Halo claro (a sombra escura some no fundo escuro) MAIS uma
                     sombra de profundidade funda e larga: sem ela o card
                     flutuava sem peso. Alcance de 80px e preto quase cheio —
                     é o que separa o card da lead do resto da página. */
                  boxShadow: `0 0 30px -2px ${creme}66, 0 0 72px -6px ${ouro}59, 0 26px 60px -12px rgba(20,8,2,.92), 0 10px 26px -8px rgba(20,8,2,.7)`,
                }
              : {
                  /* Opacas (o marrom da página atravessava e as engolia), mas
                     REBAIXADAS: a lista existe para emoldurar a lead, não para
                     competir com ela. Recuo maior, fundo mais próximo do fundo
                     da página e sem sombra própria. */
                  margin: "0 20px", padding: "10px 12px", borderRadius: 16,
                  background: "#EFE3D5",
                  border: "1px solid rgba(184,135,63,.16)",
                }
          }
        >
          {/* AVATAR — silhueta desenhada, sem depender de arquivo. Nas linhas de
              fora entra apagada, como na referência. */}
          <span
            className="grid shrink-0 place-items-center overflow-hidden rounded-full"
            style={{
              width: l.eu ? 46 : 38, height: l.eu ? 46 : 38,
              background: l.eu ? `linear-gradient(160deg, #fff, ${creme})` : "#FDF8F1",
              border: `${l.eu ? 2 : 1}px solid ${l.eu ? ouro : "rgba(184,135,63,.35)"}`,
            }}
          >
            {/* A ILUSTRAÇÃO da referência. Vem de arquivo porque tem fios de
                cabelo, sombreado e roupa — detalhe que vetor desenhado à mão não
                alcança. Convertida para 160px webp (o original tinha 1,2 MB para
                um avatar de 30px na tela).
                Nas linhas de fora entra dessaturada e mais clara: elas emolduram
                a lead, não competem com ela. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String(c.avatar || "/images/lead-perfil.webp")}
              alt="" loading="lazy" decoding="async"
              className="h-full w-full object-cover"
              style={l.eu ? undefined : { filter: "grayscale(.45) sepia(.35) opacity(.55)" }}
            />
          </span>

          {/* NÚMERO em gradiente recortado — dourado claro no topo, escuro na
              base, como na referência. Cor chapada lia como texto comum; é o
              gradiente que dá o brilho de metal. */}
          {/* NÚMERO em gradiente recortado. As classes `bg-clip-text` e
              `text-transparent` do Tailwind e NÃO style inline: inline, o
              React emitia `background-clip` sem o prefixo `-webkit-`, o recorte
              não acontecia e o gradiente pintava um retângulo dourado sólido
              por cima do texto — foi o que apareceu na tela.

              O movimento é da LINHA inteira (acima), não deste número: animar
              os dois faria a peça deslizar dentro de um card que já desliza. */}
          <span
            className="shrink-0 bg-clip-text tabular-nums text-transparent"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: l.eu ? 29 : 22, fontWeight: 700, lineHeight: 1,
              backgroundImage: l.eu
                ? `linear-gradient(175deg, #E8C77A 0%, ${ouro} 42%, ${ouroEscuro} 100%)`
                : `linear-gradient(175deg, #D8B478, ${ouroEscuro})`,
            }}
          >{l.p}º</span>

          {/* filete também em gradiente: some nas pontas, como no print */}
          <span aria-hidden className="shrink-0" style={{
            width: 1, height: l.eu ? 28 : 22,
            background: `linear-gradient(180deg, transparent, ${l.eu ? "rgba(184,135,63,.55)" : "rgba(184,135,63,.3)"} 50%, transparent)`,
          }} />

          <span
            className="min-w-0 truncate"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              // 600 e não 700: no print o nome é elegante, não pesado
              fontSize: l.eu ? 20 : 17, fontWeight: l.eu ? 600 : 400,
              color: l.eu ? marrom : "rgba(92,74,58,.7)",
              letterSpacing: l.eu ? "-.01em" : 0,
            }}
          >{l.nome}</span>

          {/* PÍLULA "Você está aqui" — o que transforma a lista em espelho */}
          {l.eu ? (
            <span
              className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full"
              style={{
                padding: "5px 11px", color: "#fff", fontSize: 10.5, fontWeight: 600,
                letterSpacing: ".01em", whiteSpace: "nowrap",
                // gradiente do print 2: salmão claro no topo, coral na base
                background: `linear-gradient(180deg, ${coralClaro} 0%, ${coral} 100%)`,
                boxShadow: `0 4px 12px -5px ${coral}, inset 0 1px 0 rgba(255,255,255,.3)`,
              }}
            >
              {/* COROA em dourado CLARO com sombra: a 12px em dourado médio
                  sobre coral ela desaparecia — era só um borrão. */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden
                style={{ filter: "drop-shadow(0 1px 1px rgba(90,40,20,.55))" }}>
                <path d="M3 7.5l4.2 3.6L12 4l4.8 7.1L21 7.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5Z" fill="#F2D98A" />
                <path d="M3 16h18v1.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V16Z" fill="#D9A94E" />
              </svg>
              {String(c.selo || "Você está aqui")}
            </span>
          ) : null}

          {/* FAÍSCAS — o brilho que a referência tem nas quinas do card da lead */}
          {l.eu ? (
            <>
              <span aria-hidden className="pointer-events-none absolute" style={{ left: 52, top: 8, color: ouro, fontSize: 11, opacity: 0.75 }}>✦</span>
              <span aria-hidden className="pointer-events-none absolute" style={{ right: 46, bottom: 7, color: ouro, fontSize: 9, opacity: 0.6 }}>✦</span>
            </>
          ) : null}

          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <b
              className="bg-clip-text tabular-nums text-transparent"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: l.eu ? 20 : 16, fontWeight: 700,
                backgroundImage: l.eu
                  ? `linear-gradient(175deg, #E8C77A, ${ouroEscuro})`
                  : `linear-gradient(175deg, #D8B478, ${ouroEscuro})`,
              }}
            >{l.pct}%</b>
            {/* ANEL de progresso: o mesmo número, em forma que se lê de relance */}
            <svg width={l.eu ? 26 : 21} height={l.eu ? 26 : 21} viewBox="0 0 36 36" aria-hidden className="-rotate-90 shrink-0">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(184,135,63,.16)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                stroke={l.eu ? ouro : "rgba(184,135,63,.4)"}
                strokeDasharray={`${(l.pct / 100) * 94.2} 94.2`}
              />
            </svg>
          </span>
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
}

function DisclaimerBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const d = layer.design || {};
  const revelarEm = Number(c.revealAt) || 0;
  const de = Number(c.vagasDe) || 0;
  const ate = Number(c.vagasAte) || 0;
  const conta = ate > 0;
  const fim = Math.max(revelarEm + 1, Number(c.vagasFimEm) || revelarEm + 60);

  /* No construtor a faixa já nasce visível: o canvas existe para conferir
     layout, e obedecer o relógio a esconderia atrás de 16 minutos de espera. */
  const [visivel, setVisivel] = useState(!!ctx.preview || revelarEm <= 0);
  const [n, setN] = useState(de);

  useEffect(() => {
    if (ctx.preview || revelarEm <= 0) return;
    const t = setTimeout(() => setVisivel(true), revelarEm * 1000);
    return () => clearTimeout(t);
  }, [revelarEm, ctx.preview]);

  useEffect(() => {
    if (!conta) return;
    const t0 = Date.now();
    const passo = () => {
      const seg = (Date.now() - t0) / 1000;
      const p = Math.min(1, Math.max(0, (seg - revelarEm) / (fim - revelarEm)));
      setN(Math.round(de + (ate - de) * p));
    };
    passo();
    // 5s: o número mexe enquanto se assiste, sem virar cronômetro
    const iv = setInterval(passo, 5000);
    return () => clearInterval(iv);
  }, [conta, de, ate, revelarEm, fim]);

  if (!visivel) return null;
  const html = interpHtml(String(c.text || ""), ctx).replace(/\[vagas\]/gi, String(conta ? n : de || ""));
  /* Fundo escuro por padrão: a faixa costuma pousar sobre a VSL, e sobre fundo
     claro o texto branco sumiria. `backgroundColor` sobrescreve. */
  return (
    <div
      className="w-full text-center text-[15px] font-extrabold leading-snug"
      style={{
        // sangra até a borda anulando o padding do <main>
        width: "calc(100% + 2.5rem)", marginLeft: "-1.25rem", marginRight: "-1.25rem",
        padding: "14px 20px",
        background: (d.backgroundColor as string) || "rgba(0,0,0,.35)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        color: (d.color as string) || "#fff",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─────────────────────────────── CHECK ──────────────────────────────
/**
 * Selo de confirmação: disco colorido com o traço do ✓ SE DESENHANDO, e ondas
 * saindo de trás.
 *
 * O traço se desenha em vez de aparecer pronto porque é o GESTO de marcar que
 * comunica "feito" — um ✓ estático é só um ícone. E são duas ondas com atraso
 * entre si: uma só lê como piscada, duas leem como sinal repetindo, que é o que
 * uma confirmação precisa parecer.
 *
 * Nasceu dentro do `ResinaPosCaptura`; virou bloco porque confirmação acontece
 * em mais de um ponto do funil (pós-captura, pós-roleta, fim de formulário) e
 * copiar o desenho em cada um é como as divergências começam.
 */
function CheckBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const d = layer.design || {};
  const c = layer.content;
  const cor = (d.backgroundColor as string) || "#16A34A";
  const tam = Number(d.basis) || 64;
  const reduzido = prefereMenosMovimento();
  return (
    <div className={`flex w-full flex-col items-center gap-2 ${justifyOf(d)}`}>
      <motion.div
        initial={reduzido ? false : { scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
        className="relative"
        style={{ width: tam, height: tam }}
      >
        {!reduzido && [0, 0.6].map((atraso, i) => (
          <motion.div
            key={i} aria-hidden className="absolute inset-0 rounded-full" style={{ background: cor }}
            animate={{ scale: [1, i ? 1.6 : 1.4, 1], opacity: [i ? 0.3 : 0.45, 0, i ? 0.3 : 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: atraso }}
          />
        ))}
        <div
          className="relative grid h-full w-full place-items-center rounded-full"
          style={{ background: `linear-gradient(135deg, ${cor} 0%, ${escurecerHex(cor, 0.18)} 100%)`, boxShadow: `0 10px 30px -10px ${cor}` }}
        >
          {/* Com emoji o bloco vira MEDALHÃO (o 🎁 do hero); sem, é o selo de
              confirmação com o ✓ se desenhando. Mesmo bloco, dois papéis — o
              que muda é só o campo Ícone. */}
          {c.icone ? (
            <motion.span
              style={{ fontSize: tam * 0.46, lineHeight: 1 }}
              animate={reduzido ? {} : { scale: [1, 1.12, 1], rotateZ: [0, -5, 5, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            >{String(c.icone)}</motion.span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" style={{ width: tam * 0.5, height: tam * 0.5 }} aria-hidden>
              <motion.path
                d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"
                initial={reduzido ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
              />
            </svg>
          )}
        </div>
      </motion.div>
      {c.text ? (
        <Html html={interpHtml(String(c.text), ctx)} className="text-center" style={{ fontSize: `${remContent(ctx)}px` }} />
      ) : null}
    </div>
  );
}

// ─────────────────────── EMBED / VÍDEO (VTurb) ──────────────────────
/** Injeta o embed do player (seta innerHTML + RE-EXECUTA os <script>). */
function EmbedBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
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
    const detach = attachVslWatch({ funnelSlug: ctx.funnelSlug, html, disabled: ctx.preview });
    return () => { el.innerHTML = ""; detach(); };
  }, [html, ctx.funnelSlug, ctx.preview]);
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
/**
 * Sombra do card SELECIONADO, conforme o efeito escolhido.
 *  none  → anel fino, o de sempre
 *  glow  → halo colorido em volta (o "neon" dos quizzes de fitness)
 *  blur  → halo mais largo e difuso, sem o anel duro
 * Só o estado selecionado muda: o card em repouso continua com a sombra comum,
 * senão a tela inteira brilha e nada se destaca.
 */
function sombraFx(cor: string, fx: string): string {
  if (fx === "glow") return `0 0 0 2px ${cor}, 0 0 18px -2px ${cor}, 0 0 34px -6px ${cor}`;
  if (fx === "blur") return `0 0 24px 2px ${cor}99, 0 0 48px 8px ${cor}4d`;
  return `0 0 0 2px ${cor}`;
}

function OptionsBlock({ layer, ctx, question }: { layer: Layer; ctx: LayersCtx; question: string }) {
  const c = layer.content;
  const d = layer.design || {};
  const opts = c.options || [];
  const obasis = Number(d.basis) || 100;
  const theme = ctx.design.themeColor || "#ea580c";
  // colunas: o inlead usa content.cols (quase sempre grid-cols-1 = empilhado);
  // design.grid é resíduo e NÃO deve ser usado (gerava 2/3 colunas espremidas).
  const cols = Math.max(1, parseInt(String(c.cols || "grid-cols-1").replace(/\D/g, "")) || 1);
  // multi-coluna: card vira COLUNA (emoji em cima, texto embaixo, centralizado) —
  // senão o texto é espremido numa coluna estreita e quebra letra a letra.
  const multi = cols > 1;
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
  // Estilo do card: "lista" (padrão de sempre) ou "foto" (a imagem É o card,
  // rótulo em cápsula por cima). `fx` controla o brilho do selecionado.
  const cardFoto = d.cardStyle === "foto";
  const fx = (d.fx as string) || "none";
  /* Preset da referência (artedaresina.com.br): borda de 1,5px, raio 16, sombra
     preta a 8% em repouso e check redondo com miolo em radial-gradient. Os
     números vêm de `lib/quiz/resina.ts`, medidos no código-fonte, não de olho.
     É opt-in por bloco — ausente, os 17 funis em produção seguem idênticos. */
  const presetResina = d.preset === "resina";

  // pergunta/introdução do próprio bloco (alguns steps guardam o texto aqui)
  const intro = c.introduction && plain(c.introduction) ? c.introduction : "";
  const q = intro ? plain(intro) : plain(question);

  const pick = (o: InleadOption) => {
    if (multiple) { setSel((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id])); return; }
    ctx.trackAnswer(ctx.stepId, q, plain(o.label));
    ctx.navigate(o.destination || "next");
  };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: `${obasis}%` }}>
    {intro ? (
      <div className="mb-3 w-full">
        <Html html={interpHtml(intro, ctx)} style={{ fontSize: `${remContent(ctx)}px`, color: ctx.design.contentColor || "#000" }} />
      </div>
    ) : null}
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: cardFoto ? ".7rem" : ".55rem" }}>
      {opts.map((o) => {
        const img = o.image?.type === "image" ? o.image?.src : null;
        const emoji = o.image?.type === "emoji" ? o.image?.src : o.emoji;
        const active = sel.includes(o.id);

        // ESTILO "FOTO": a imagem É o card e o rótulo flutua em cápsula sobre
        // ela, no rodapé. No estilo de lista a imagem vira miniatura de 48px —
        // serve para ícone, não para foto que precisa ser lida de longe.
        if (cardFoto && img) {
          return (
            <motion.button key={o.id} onClick={() => pick(o)} whileTap={{ scale: 0.98 }}
              className="relative overflow-hidden"
              style={{
                borderRadius: radius(ctx.design),
                aspectRatio: "3 / 4",
                border: `${Math.max(2, bw)}px solid ${active ? theme : "rgba(255,255,255,.10)"}`,
                boxShadow: active ? sombraFx(theme, fx) : shadow,
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              {/* véu embaixo: sem ele o rótulo some numa foto clara */}
              <span className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(to top, rgba(0,0,0,.72), transparent)" }} />
              {active ? (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[13px] font-black text-white" style={{ background: theme }}>✓</span>
              ) : null}
              <span className="absolute inset-x-0 bottom-2.5 flex justify-center px-2">
                <Html html={interpHtml(o.label, ctx)}
                  className="rounded-full px-3 py-1"
                  style={{ background: "rgba(20,20,22,.82)", color: "#fff", fontSize: `${Math.max(12, remContent(ctx) - 2)}px`, fontWeight: 700, lineHeight: 1.2, backdropFilter: "blur(3px)" }} />
              </span>
            </motion.button>
          );
        }

        return (
          <motion.button key={o.id} onClick={() => pick(o)} whileTap={{ scale: 0.98 }}
            className={`flex transition ${multi ? "flex-col items-center justify-center gap-2 text-center" : "flex-row items-center justify-start gap-3 text-left"}`}
            style={presetResina && !multi ? estiloOpcao(theme, active) : {
              borderRadius: radius(ctx.design), minHeight: ctx.design.elementSize || "64px",
              background: cardBg,
              border: `${bw}px solid ${active ? theme : contrast ? `color-mix(in srgb, ${theme} 55%, #ffffff)` : "#e5e7eb"}`,
              boxShadow: active ? sombraFx(theme, fx) : shadow,
              padding: multi ? ".9rem .65rem" : ".75rem 1rem",
            }}>
            {showIcon && iconStart ? <Chevron color={theme} /> : null}
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" loading="lazy" decoding="async" className={`rounded-lg object-cover ${multi ? "h-12 w-12" : "h-10 w-10"}`} />
            ) : emoji ? (
              // tamanho do emoji configurável: na referência ele é o peso visual
              // da opção, não um enfeite ao lado do texto
              <span style={{ fontSize: `${Number(d.emojiSize) || (multi ? 30 : 24)}px`, lineHeight: 1 }}>{emoji}</span>
            ) : null}
            <Html html={interpHtml(o.label, ctx)} className={multi ? "w-full" : "flex-1"} style={{ fontSize: `${remContent(ctx)}px`, fontWeight: 600, lineHeight: 1.25, color: ctx.design.contentColor || "#000" }} />
            {/* CHECK REDONDO — o círculo da referência, que enche ao ser
                escolhido. A seta (Chevron) diz "vai avançar"; o círculo diz
                "isto é uma escolha" — e em múltipla escolha essa diferença é o
                que faz o visitante entender que pode marcar mais de um. */}
            {d.icon === "check" || presetResina ? (
              presetResina ? (
                // O da referência: 18px, sem ✓ dentro — o miolo é um
                // radial-gradient que para em 40%, deixando um anel de respiro
                // entre o preenchimento e a borda.
                <span className="shrink-0" style={estiloCheck(theme, active)} />
              ) : (
                <span
                  className="grid shrink-0 place-items-center rounded-full transition-all"
                  style={{
                    width: 22, height: 22,
                    border: `2px solid ${active ? theme : `${theme}59`}`,
                    background: active ? theme : "transparent",
                    color: "#fff", fontSize: 12, fontWeight: 900,
                  }}
                >{active ? "✓" : ""}</span>
              )
            ) : showIcon && !iconStart ? <Chevron color={theme} /> : null}
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
    </div>
  );
}

// ─────────────────────────────── FIELD ──────────────────────────────
function maskPhoneBr(v: string): string {
  let raw = v.replace(/\D/g, "");
  // o +55 já é fixo no campo: se o lead digitou 55 de novo (total 12-13 díg.),
  // tira o país duplicado. DDD 55 (RS) tem só 10-11 díg. → não é afetado.
  if (raw.length >= 12 && raw.startsWith("55")) raw = raw.slice(2);
  const d = raw.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function FieldBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const key = c.name || c.id || "campo";
  const isPhone = c.mask === "phone_br" || c.type === "phone";
  const val = ctx.fields[key] || "";
  const onChange = (raw: string) => {
    const v = isPhone ? maskPhoneBr(raw) : raw;
    ctx.setField(key, v);
    if (key === "nome") ctx.setName(v);
  };
  const boxStyle = { borderRadius: radius(ctx.design), borderColor: "#e5e7eb", fontSize: `${remContent(ctx)}px` };
  return (
    <div className="mx-auto w-full text-left">
      {/* `label` vem primeiro: é o campo que as telas de preset leem, e enquanto
          este bloco olhava só para `title` o construtor mostrava um rótulo e o
          site mostrava outro. `title` continua valendo para os funis antigos. */}
      {(c.label || c.title) ? (
        <label className="mb-1.5 block text-sm font-semibold" style={{ color: ctx.design.contentColor || "#000" }}>
          {String(c.label || c.title)}
        </label>
      ) : null}
      {isPhone ? (
        // Prefixo configurável (o lead digita só DDD+número). Guardamos o valor
        // nacional; o +55 é colado no webhook — assim o lead nunca soma um 55 a
        // mais. Vazio esconde o prefixo.
        <div className="flex w-full items-stretch overflow-hidden border bg-white focus-within:ring-2" style={boxStyle}>
          {((layer.design?.prefixo as string | undefined) ?? "+55") ? (
            <span className="flex select-none items-center border-r border-neutral-200 bg-neutral-50 px-3 font-semibold text-neutral-500" style={{ fontSize: `${remContent(ctx)}px` }}>
              {String((layer.design?.prefixo as string | undefined) ?? "+55")}
            </span>
          ) : null}
          <input
            value={val} onChange={(e) => onChange(e.target.value)}
            placeholder={c.placeholder || "(00) 00000-0000"} inputMode="tel" type="tel"
            className="w-full border-0 bg-transparent px-4 py-3.5 outline-none"
            style={{ fontSize: `${remContent(ctx)}px` }}
          />
        </div>
      ) : (
        <input
          value={val} onChange={(e) => onChange(e.target.value)}
          placeholder={c.placeholder} inputMode="text"
          className="w-full border bg-white px-4 py-3.5 outline-none focus:ring-2"
          style={boxStyle}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── LOADING ────────────────────────────
function LoadingBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  // No CONSTRUTOR o bloco não navega. Ele conta o tempo e pula para a lâmina
  // seguinte — o que no runtime é o comportamento certo, mas no canvas tira a
  // lâmina de baixo de quem está editando: seleciona o card, ele roda e some.
  // Vale para o diagnóstico e para a barra, que tinha o mesmo problema.
  const editando = !!useContext(LayersEditContext);
  // DIAGNÓSTICO: outra tela, não outra skin da barra. Sai antes de qualquer
  // estado da barra ser montado — os dois só compartilham o campo `seconds`. A
  // tela mora em `quiz/ResinaDiagnostico.tsx`, dividida com o LayersRunner.
  if (c.style === "diagnostico") {
    const limpo = (s: unknown) => interpHtml(String(s), ctx).replace(/<[^>]+>/g, "").trim();
    /* MESMA TELA no construtor e no site. Antes daqui o bloco renderizava o
       `Diagnostico.tsx` enquanto o runner renderizava o `ResinaDiagnostico` —
       o construtor mostrava caixas e aros, o site mostrava pílulas e arcos, e
       não havia como conferir o resultado sem abrir a URL pública.
       O `ResinaDiagnostico` faz os dois desenhos, então serve aos dois lados.

       O PADRÃO preserva os funis existentes: sem campo gravado, `anel` cai em
       "antigo" — que reproduz o desenho que eles sempre tiveram. Só o funil que
       escolher "novo" no construtor muda. */
    const msgs = ((c.bars as string[]) ?? []).map((b, i) => ({
      texto: limpo(b),
      icone: (c.icons as string[] | undefined)?.[i] || undefined,
    }));
    return (
      <ResinaDiagnostico
        // por prop, não por CSS var: `paletteVars` só é aplicado no ramo de
        // bloco-hero do LayersRunner, e aqui isto renderiza como bloco comum —
        // o anel saía desenhado e sem cor
        cor={ctx.design.themeColor || "#ea580c"}
        mensagens={msgs.length ? msgs : [{ texto: limpo(c.title) || "Processando…", icone: "🔎" }]}
        legenda={c.description ? limpo(c.description) : undefined}
        duracaoMs={(Number(c.seconds) || 5) * 1000}
        anel={((c as { anel?: "novo" | "antigo" }).anel) ?? "antigo"}
        pilulas={((c as { pilulas?: boolean }).pilulas) ?? false}
        caixas={((c as { caixas?: boolean }).caixas) ?? true}
        // type "none" = a lâmina segue no lugar depois da análise (igual à barra)
        onFim={c.type === "none" || editando ? undefined : () => ctx.navigate(String(c.destination || "next"))}
      />
    );
  }
  // CHECKLIST: barras rotuladas, com pausa em micro-pergunta. Só a barra lisa
  // existia aqui — uma lâmina vinda do motor tipado com `bars` perdia os
  // rótulos, e o `checkpoint` (que GRAVA resposta do lead) sumia sem aviso.
  // Mesma tela nos dois motores, em `quiz/Checklist.tsx`.
  const barras = (c.bars as string[]) ?? [];
  const cps = c.checkpoints as { at: number; question: string; options: string[] }[] | undefined;
  if (barras.length || cps?.length) {
    const limpo = (s: unknown) => interpHtml(String(s), ctx).replace(/<[^>]+>/g, "").trim();
    return (
      <Checklist
        titulo={c.title ? interpHtml(String(c.title), ctx) : undefined}
        barras={barras.map(limpo)}
        checkpoints={cps}
        duracaoMs={(Number(c.seconds) || 4) * 1000}
        logo={c.logo as string | undefined}
        legenda={c.description ? limpo(c.description) : undefined}
        cor={ctx.design.themeColor || "#ea580c"}
        onFim={c.type === "none" || editando ? undefined : () => ctx.navigate(String(c.destination || "next"))}
        onResponder={(i, cp, opt) => ctx.trackAnswer?.(`${layer.id}:cp${i}`, cp.question, opt)}
      />
    );
  }

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
      // type "none" = loading só anima e revela o resto da lâmina (não auto-avança).
      else if (!done.current && c.type !== "none" && !editando) { done.current = true; setTimeout(() => ctx.navigate(c.destination || "next"), 300); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      {c.show_title && c.title ? <p className="mb-2 font-bold" style={{ fontSize: `${remContent(ctx) + 2}px` }}>{c.title}</p> : null}
      {c.show_progress !== false ? (
        <div className="mx-auto h-2.5 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ctx.design.themeColor || "#ea580c" }} />
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
// ──────────────────────────────── CARD ─────────────────────────────
/**
 * Caixa que separa um trecho do resto da lâmina.
 *
 * Os valores saem da referência que o Luca mandou (artedaresina.com.br),
 * medidos no navegador: raio ~20, borda 1px do tema a ~15%, sombra do tema a
 * ~8% em 0 4px 24px, fundo em degradê de 160° partindo do tema a ~6%. Tudo
 * derivado de UMA cor — é o que torna isto aplicável a qualquer paleta, em vez
 * de virar um tema azul chumbado no código.
 *
 * Carrega texto rico próprio em vez de aninhar blocos: o editor já formata
 * pílula, cor e tamanho dentro do HTML, e aninhamento exigiria arrastar bloco
 * para dentro no construtor — três vezes o trabalho para o mesmo resultado.
 */
function CardBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const d = layer.design || {};
  const tema = ctx.design.themeColor || "#ea580c";
  const variante = (d.variant as string) || "suave";

  const estilos: Record<string, React.CSSProperties> = {
    // padrão: quase branco com um véu do tema — separa sem competir com o texto
    suave: {
      background: `linear-gradient(160deg, ${tema}0f 0%, ${tema}08 100%)`,
      border: `1px solid ${tema}26`,
      boxShadow: `0 4px 24px 0 ${tema}14, 0 2px 6px 0 rgba(0,0,0,.04)`,
    },
    // só contorno: para quando já existe outro card por perto e dois fundos
    // empilhados deixariam a tela pesada
    contorno: {
      background: "transparent",
      border: `1.5px solid ${tema}40`,
      boxShadow: "none",
    },
    // escuro: o "presente de boas-vindas" da referência — inverte o contraste
    // e o bloco vira o ponto de atenção da lâmina
    escuro: {
      background: "linear-gradient(160deg, #111827 0%, #0b1220 100%)",
      border: "1px solid rgba(255,255,255,.08)",
      boxShadow: "0 18px 40px -18px rgba(0,0,0,.55)",
      color: "#f8fafc",
    },
    // destaque: o tema cheio, para o card que carrega a promessa
    destaque: {
      background: `linear-gradient(160deg, ${tema} 0%, ${tema}d9 100%)`,
      border: "none",
      boxShadow: `0 16px 38px -14px ${tema}8c`,
      color: "#ffffff",
    },
  };

  return (
    <div
      className="mx-auto w-full"
      style={{
        ...(estilos[variante] || estilos.suave),
        borderRadius: radius(ctx.design),
        padding: `${Number(d.padding) || 20}px ${Math.round((Number(d.padding) || 20) * 0.8)}px`,
      }}
    >
      {c.text ? (
        <Html html={interpHtml(c.text, ctx)} style={{ fontSize: `${remContent(ctx)}px` }} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────── NÍVEL ─────────────────────────────
/**
 * Régua de níveis com o do visitante em destaque ("você está aqui").
 * Serve para devolver um diagnóstico logo depois do quiz, antes da oferta.
 * A barra anima do zero até a posição, senão o resultado aparece pronto e não
 * se lê como algo que foi calculado.
 */
function LevelBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const niveis = (c.levels as { label: string; pct?: number }[]) || [];
  const atual = Math.min(Math.max(0, Number(c.atual) || 0), Math.max(0, niveis.length - 1));
  const theme = ctx.design.themeColor || "#ea580c";
  const alvo = Number(niveis[atual]?.pct ?? ((atual + 1) / Math.max(1, niveis.length)) * 100);
  const [w, setW] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (n: number) => { const p = Math.min(alvo, ((n - t0) / 1200) * alvo); setW(p); if (p < alvo) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  if (!niveis.length) return null;
  return (
    <div className="mx-auto w-full">
      {c.title ? <Html html={interpHtml(String(c.title), ctx)} className="mb-2 text-center" /> : null}
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.08)" }}>
        <div className="h-full rounded-full transition-none" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${theme}, ${theme}bb)` }} />
      </div>
      <div className="mt-2 flex justify-between gap-1">
        {niveis.map((n, i) => (
          <span key={i} className="flex-1 text-center text-[11px] font-semibold"
            style={{ color: i === atual ? theme : "var(--q-text-muted, #9ca3af)", fontWeight: i === atual ? 800 : 600 }}>
            {i === atual ? "▲ " : ""}{n.label}
          </span>
        ))}
      </div>
      {c.description ? <Html html={interpHtml(String(c.description), ctx)} className="mt-3 text-center" /> : null}
    </div>
  );
}

// ──────────────────────────── ANTES / DEPOIS ───────────────────────
/**
 * Prova social em pares antes→depois, com setas para percorrer vários casos —
 * o carrossel que o Luca pediu. Sem ele cada prova viraria uma lâmina, e o
 * funil ficaria comprido só para mostrar cinco fotos.
 */
function BeforeAfterBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const pares = (c.pairs as { antes?: string; depois?: string; legenda?: string }[]) || [];
  const [i, setI] = useState(0);
  const n = pares.length;
  if (!n) return null;
  const p = pares[Math.min(i, n - 1)];
  const rot = radius(ctx.design);
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <div className="mx-auto w-full select-none">
      <div className="grid grid-cols-2 gap-2">
        {([["ANTES", p.antes], ["DEPOIS", p.depois]] as const).map(([rot2, src]) => (
          <div key={rot2} className="relative overflow-hidden" style={{ borderRadius: rot, aspectRatio: "3 / 4", background: "rgba(0,0,0,.06)" }}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide text-white"
              style={{ background: rot2 === "DEPOIS" ? (ctx.design.themeColor || "#ea580c") : "rgba(20,20,22,.75)" }}>
              {rot2}
            </span>
          </div>
        ))}
      </div>
      {p.legenda ? <Html html={interpHtml(p.legenda, ctx)} className="mt-2 text-center" style={{ fontSize: `${remContent(ctx) - 2}px` }} /> : null}
      {n > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button onClick={() => go(-1)} aria-label="Anterior" className="grid h-7 w-7 place-items-center rounded-full border border-black/10 text-sm">‹</button>
          <div className="flex gap-1.5">
            {pares.map((_, k) => (
              <span key={k} className="h-1.5 rounded-full transition-all"
                style={{ width: k === i ? 16 : 6, background: k === i ? (ctx.design.themeColor || "#ea580c") : "rgba(0,0,0,.2)" }} />
            ))}
          </div>
          <button onClick={() => go(1)} aria-label="Próximo" className="grid h-7 w-7 place-items-center rounded-full border border-black/10 text-sm">›</button>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────── GRÁFICOS ──────────────────────────
/**
 * Barras verticais para projeção ("onde você chega em 3 meses"). Diferente do
 * `graphics`, que é UM anel de porcentagem: aqui a leitura é a evolução entre
 * pontos, não um número só.
 */
function ChartsBlock({ layer, ctx }: { layer: Layer; ctx: LayersCtx }) {
  const c = layer.content;
  const barras = (c.bars as { label: string; value: number }[]) || [];
  const theme = ctx.design.themeColor || "#ea580c";
  const [f, setF] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (n: number) => { const p = Math.min(1, (n - t0) / 1100); setF(p); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!barras.length) return null;
  const max = Math.max(...barras.map((b) => Number(b.value) || 0), 1);
  return (
    <div className="mx-auto w-full">
      {c.title ? <Html html={interpHtml(String(c.title), ctx)} className="mb-3 text-center" /> : null}
      <div className="flex items-end justify-between gap-2" style={{ height: 150 }}>
        {barras.map((b, i) => {
          const v = Number(b.value) || 0;
          const h = (v / max) * 100 * f;
          const ultima = i === barras.length - 1;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
              <span className="text-[11px] font-bold" style={{ color: ultima ? theme : "var(--q-text-muted, #9ca3af)" }}>
                {Math.round(v * f)}{String(c.suffix || "")}
              </span>
              <div className="w-full rounded-t-md"
                style={{ height: `${h}%`, background: ultima ? theme : `${theme}59`, minHeight: 2 }} />
              <span className="text-[10px] font-semibold text-[var(--q-text-muted,#9ca3af)]">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ─────────────────── HERO SLIDER (layout dedicado) ──────────────────
/** Hero de slider 0–10 com foto full-bleed no rodapé + gradiente (estilo inlead). */
export function SliderHero({
  step, ctx, theme, bgColor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: any; ctx: LayersCtx; theme: string; bgColor: string;
}) {
  const min = Number(step.min) || 0;
  const max = Number(step.max) ?? 10;
  const stp = Number(step.step) || 1;
  const [v, setV] = useState(min);          // começa sempre no 0
  const [touched, setTouched] = useState(false);
  const advanced = useRef(false);
  const pct = ((v - min) / (max - min)) * 100;

  // título: ==trecho== ou **trecho** vira texto na cor do tema (sem fundo de pílula)
  const titleParts = String(step.question || "").split(/==(.+?)==|\*\*(.+?)\*\*/g).filter((p: string) => p !== undefined);

  // ao SOLTAR o slider: se arrastou pra qualquer valor > 0, avança sozinho (sem botão)
  const release = () => {
    if (advanced.current || v <= min) return;
    advanced.current = true;
    ctx.trackAnswer(ctx.stepId, String(step.question || "Nota 0–10").replace(/[*=]/g, "").trim(), String(v));
    setTimeout(() => ctx.navigate("next"), 280);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: bgColor, color: "#111" }}>
      <div className="flex flex-1 flex-col">
        {/* conteúdo */}
        <div className="px-6 pt-12">
          <h2 className="text-center text-[26px] font-extrabold leading-tight">
            {titleParts.map((p: string, i: number) =>
              i % 2 === 1 ? <span key={i} style={{ color: theme }}>{p}</span> : <span key={i}>{p}</span>,
            )}
          </h2>
          {step.help ? <p className="mt-2 text-center text-sm text-black/45">{step.help}</p> : null}

          <div className="relative mt-16">
            <input
              type="range" min={min} max={max} step={stp} value={v}
              onChange={(e) => { setV(Number(e.target.value)); setTouched(true); }}
              onPointerUp={release} onTouchEnd={release} onMouseUp={release}
              className="q-slider h-3 w-full cursor-pointer appearance-none rounded-full"
              style={{ accentColor: theme, background: `linear-gradient(90deg, ${theme} ${pct}%, #e7e1d8 ${pct}%)` }}
            />
            <div className="mt-2 flex justify-between px-0.5 text-xs font-semibold text-black/45">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => <span key={n}>{n}</span>)}
            </div>
            {/* dedo ABAIXO do controle — antes ficava em cima e brigava com o título */}
            <div className="relative h-9">
              <DedoArrasta visivel={!touched} />
            </div>
            <p className="mt-2 text-center text-sm font-semibold" style={{ color: theme }}>
              {touched ? "Solte para continuar" : "Arraste o seletor para responder"}
            </p>
          </div>
        </div>

        {/* foto full-bleed no rodapé + gradiente que funde com o fundo */}
        {step.image ? (
          <div className="relative mt-auto w-full">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28"
              style={{ background: `linear-gradient(to bottom, ${bgColor} 8%, transparent)` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.image} alt="" loading="lazy" decoding="async" className="block max-h-[46vh] w-full object-cover object-top" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────── DISPATCHER ─────────────────────────────
export function Block({ layer, ctx, question, indice = 0 }: { layer: Layer; ctx: LayersCtx; question: string; indice?: number }) {
  const inner = ((): React.ReactNode => {
    switch (layer.type) {
      case "text": return <TextBlock layer={layer} ctx={ctx} />;
      case "clear": return <ClearBlock layer={layer} ctx={ctx} />;
      case "check": return <CheckBlock layer={layer} ctx={ctx} />;
      case "disclaimer": return <DisclaimerBlock layer={layer} ctx={ctx} />;
      case "ranking": return <RankingBlock layer={layer} ctx={ctx} />;
      case "alert": return <AlertBlock layer={layer} ctx={ctx} />;
      case "image": return <ImageBlock layer={layer} ctx={ctx} />;
      case "button": return <ButtonBlock layer={layer} ctx={ctx} />;
      case "options": return <OptionsBlock layer={layer} ctx={ctx} question={question} />;
      case "field": return <FieldBlock layer={layer} ctx={ctx} />;
      case "loading": return <LoadingBlock layer={layer} ctx={ctx} />;
      case "timer": return <TimerBlock layer={layer} ctx={ctx} />;
      case "notification": return <NotificationBlock layer={layer} ctx={ctx} />;
      case "graphics": return <GraphicsBlock layer={layer} ctx={ctx} />;
      case "card": return <CardBlock layer={layer} ctx={ctx} />;
      case "level": return <LevelBlock layer={layer} ctx={ctx} />;
      case "beforeafter": return <BeforeAfterBlock layer={layer} ctx={ctx} />;
      case "charts": return <ChartsBlock layer={layer} ctx={ctx} />;
      case "embed": case "video": return <EmbedBlock layer={layer} ctx={ctx} />;
      case "carousel": return <CarouselBlock layer={layer} ctx={ctx} />;
      default: return null;
    }
  })();
  // opacidade (design.opacity) — genérica pra QUALQUER bloco
  const op = opacityOf(layer.design);
  const node = op !== undefined ? <div style={{ opacity: op }}>{inner}</div> : inner;
  // ── modo de edição: o EditBlock (LayersRunner) cuida de wrapper/seleção/drag ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const edit = useContext(LayersEditContext);
  const hidden = !!layer.design?.hidden;
  if (edit) return <>{node}</>;            // EditBlock provê o wrapper/toolbar/sortable
  if (hidden) return null;                 // runtime: bloco oculto não renderiza
  // revelação progressiva (effects.starts) — ex: botão Continuar da VAGAS só após o loading.
  if (layer.effects?.starts) return <Reveal delay={layer.effects.starts}>{node}</Reveal>;

  // ENTRADA: cada bloco chega com fade + leve subida, escalonado pela posição.
  // Antes tudo aparecia de uma vez e a lâmina "piscava" pronta — era o que dava
  // a sensação de página estática. `entradaBloco` respeita
  // `prefers-reduced-motion`: quem pediu menos movimento recebe só o fade.
  return <motion.div {...entradaBloco(indice)}>{node}</motion.div>;
}

/** Wrapper de edição no canvas: seleção + toolbar + arrastar (sortable).
 *  Usado SÓ pelo LayersRunner em modo editor (dentro de um SortableContext). */
// EditBlock foi movido para ./EditableBlocks (carregado só no construtor, fora
// do bundle do funil público — junto do @dnd-kit).
