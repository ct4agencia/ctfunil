"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type {
  RouletteStep, RouletteStyle, ScratchStep, MeasureStep, SliderStep, Palette, HeroStep, NameStep, ConfirmStep, QuestionStep, LoadingStep, GaugeStep, ResultStep,
  OfferStep, CaptureStep, PostStep, BridgeStep, VslStep, QuizOption,
} from "@/lib/quiz/types";
import { CtaButton, OptionButton, StepShell, StickyCta, RichText } from "./ui";
import { submitLead, submitFunnelLead, fireMetaEvent } from "@/lib/tracking";
import { trackAnswer } from "@/lib/quiz/track";
import { playSpinTicks, playWin, playUrl } from "@/lib/quiz/sound";

/** Contexto passado a cada lâmina pelo QuizRunner. */
export interface StepCtx {
  name: string;
  setName: (n: string) => void;
  advance: () => void;
  funnelSlug: string;
  vslId?: string;
  palette: Palette;
}

/**
 * Chrome visual da roleta por estilo. Cada estilo tem IDENTIDADE própria (cor +
 * BACKGROUND FULL-SCREEN distinto) inspirada nos prints: casino dourado, neon
 * roxo, vegas vinho. "soft" segue a paleta do funil. `bg` é o fundo de TELA CHEIA.
 */
export function wheelChrome(style: RouletteStyle | undefined, p: Palette) {
  switch (style) {
    case "casino": // vermelho + creme, aro dourado, raios dourados, pedestal preto
      return { rim: "#caa24a", rimInner: "#7a5e1f", rimW: 13, peg: "peg" as const, pegColor: "#fff4cf",
        alt: ["#c0392b", "#f7edd9"] as [string, string], hub: "#caa24a", hubInner: "#eed595", hubR: 92,
        bg: "radial-gradient(circle at 50% 32%, #ffe9b8 0%, #f2bd5e 42%, #cf8e2c 100%)", dark: false, star: true,
        pointerType: "tab" as const, pointer: "#caa24a", stand: "trapezoid" as const };
    case "neon": // roxo + laranja, aro escuro com lâmpadas douradas, glow roxo
      return { rim: "#241338", rimInner: "#4b2f7a", rimW: 11, peg: "bulb" as const, pegColor: "#ffd23f",
        alt: ["#6d28d9", "#f59e0b"] as [string, string], hub: "#2a1750", hubInner: "#f59e0b", hubR: 68,
        bg: "radial-gradient(circle at 50% 38%, #5a2da0 0%, #2a1456 46%, #120a26 100%)", dark: true, star: true,
        pointerType: "notch" as const, pointer: "#ffd23f", stand: "none" as const };
    case "bulbs": // vinho + branco, lâmpadas brilhando, pódio branco, glow vinho
      return { rim: "#3a0f22", rimInner: "#6b1d3c", rimW: 12, peg: "bulb" as const, pegColor: "#fff1a8",
        alt: ["#7a1733", "#fbeee4"] as [string, string], hub: "#240914", hubInner: "#e7b3c4", hubR: 60,
        bg: "radial-gradient(circle at 50% 40%, #6e1a36 0%, #3a0f20 50%, #160710 100%)", dark: true, star: false,
        pointerType: "notch" as const, pointer: "#fff1a8", stand: "podium" as const };
    default: // soft — segue a paleta do funil (fundo claro)
      return { rim: "#f3ead9", rimInner: "#e2d1b0", rimW: 10, peg: "dot" as const, pegColor: "#e2d1b0",
        alt: null, hub: "#fdf8ef", hubInner: p.bgSoft, hubR: 94,
        bg: "", dark: false, star: true,
        pointerType: "teardrop" as const, pointer: "var(--q-primary)", stand: "none" as const };
  }
}

/** Interpola {nome} (e cap. inicial) nas strings. */
export function interp(s: string | undefined, name: string): string {
  if (!s) return "";
  const n = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
  return s.replace(/\{nome\}/g, n || "você");
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[var(--q-display)] text-[26px] font-bold leading-tight tracking-tight text-[var(--q-text)]">
      {typeof children === "string" ? <RichText text={children} /> : children}
    </h2>
  );
}

/**
 * Título com revelação palavra a palavra (estilo animated-hero / 21st.dev).
 * Trata `==destaque==` como pílula gradiente âmbar (vivadevelas) — unidade única
 * que entra junto, e `**negrito**` como realce na cor primária.
 */
function AnimatedTitle({ text }: { text: string }) {
  // tokens: pílulas/negritos atômicos + palavras soltas
  const tokens: { t: string; kind: "pill" | "bold" | "word" }[] = [];
  text.split(/(==[^=]+==|\*\*[^*]+\*\*)/g).filter(Boolean).forEach((seg) => {
    if (seg.startsWith("==") && seg.endsWith("==")) tokens.push({ t: seg.slice(2, -2), kind: "pill" });
    else if (seg.startsWith("**") && seg.endsWith("**")) tokens.push({ t: seg.slice(2, -2), kind: "bold" });
    else seg.split(" ").filter(Boolean).forEach((w) => tokens.push({ t: w, kind: "word" }));
  });
  return (
    <h2 className="font-[var(--q-display)] text-[26px] font-bold leading-tight tracking-tight text-[var(--q-text)]">
      {tokens.map((tk, i) => (
        <motion.span key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mr-[0.25em] inline-block">
          {tk.kind === "pill" ? (
            <span className="inline-block rounded-xl px-2.5 py-0.5 font-extrabold text-white shadow-[0_8px_20px_-8px_var(--q-primary)]"
              style={{ background: "linear-gradient(95deg, var(--q-primary), color-mix(in srgb, var(--q-primary) 62%, #ffd9a8))" }}>{tk.t}</span>
          ) : tk.kind === "bold" ? (
            <b className="font-extrabold text-[var(--q-primary)]">{tk.t}</b>
          ) : tk.t}
        </motion.span>
      ))}
    </h2>
  );
}

// ── Roleta ────────────────────────────────────────────────────────
export function RouletteStepView({ step, ctx }: { step: RouletteStep; ctx: StepCtx }) {
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const [rotation, setRotation] = useState(0);
  const N = step.segments.length;
  const seg = 360 / N;
  const c = 100;

  const polar = (r: number, a: number): [number, number] => {
    const rad = ((a - 90) * Math.PI) / 180;
    const round = (n: number) => Math.round(n * 100) / 100; // evita mismatch de hydration (float server≠client)
    return [round(c + r * Math.cos(rad)), round(c + r * Math.sin(rad))];
  };
  // fatia i centrada em i*seg → fatia 0 fica no topo, sob o ponteiro
  const slicePath = (i: number) => {
    const [x0, y0] = polar(86, i * seg - seg / 2);
    const [x1, y1] = polar(86, i * seg + seg / 2);
    return `M${c},${c} L${x0.toFixed(2)},${y0.toFixed(2)} A86,86 0 ${seg > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
  };
  const labelLines = (label: string): string[] => {
    const w = label.split(" ");
    if (w.length <= 1) return [label];
    const half = Math.ceil(w.length / 2);
    return [w.slice(0, half).join(" "), w.slice(half).join(" ")];
  };
  const ch = wheelChrome(step.style, ctx.palette);
  const pegCount = ch.peg === "bulb" ? 16 : 24;
  const pegR = ch.peg === "bulb" ? 95 : 93;
  const pegs = Array.from({ length: pegCount }, (_, k) => polar(pegR, (k * 360) / pegCount));

  const spin = () => {
    if (spinning || done) return;
    setSpinning(true);
    if (step.sound?.enabled) {
      if (step.sound.tickUrl) playUrl(step.sound.tickUrl);
      else playSpinTicks(4200);
    }
    const win = step.mode === "random" ? Math.floor(Math.random() * N) : step.winningIndex;
    setRotation(360 * 6 - win * seg); // win=0 → 6 voltas exatas, labels terminam retas
    setTimeout(() => {
      setDone(true); setSpinning(false);
      if (step.sound?.enabled) {
        if (step.sound.winUrl) playUrl(step.sound.winUrl);
        else playWin();
      }
      import("canvas-confetti").then((m) => m.default({ particleCount: 170, spread: 95, origin: { y: 0.4 } })).catch(() => {});
    }, 4300);
  };

  return (
    <>
      <StepShell center>
        <h2 className="text-center font-[var(--q-display)] text-[26px] font-bold leading-tight tracking-tight"
          style={{ color: ch.dark ? "#ffffff" : "var(--q-text)" }}>{step.title}</h2>
        {step.subtitle ? <p className="mt-2 text-center text-sm" style={{ color: ch.dark ? "rgba(255,255,255,.82)" : "var(--q-text-muted)" }}>{step.subtitle}</p> : null}

        <div className="relative mx-auto mt-7 h-[300px] w-[300px] max-w-full">
            {/* ponteiro por estilo */}
            {ch.pointerType === "notch" ? (
              <div className="absolute left-1/2 top-[-7px] z-30 -translate-x-1/2"
                style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: `22px solid ${ch.pointer}`, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.45))" }} />
            ) : ch.pointerType === "tab" ? (
              <div className="absolute left-1/2 top-[-10px] z-30 -translate-x-1/2"
                style={{ width: 22, height: 27, background: ch.pointer, borderRadius: "7px 7px 50% 50%", border: "2px solid #fff7d6", boxShadow: "0 3px 6px rgba(0,0,0,.32)" }} />
            ) : (
              <div className="absolute left-1/2 top-[-3px] z-30 -translate-x-1/2"
                style={{ width: 26, height: 26, background: ch.pointer, border: "3px solid #fff", borderRadius: "50% 50% 0 50%", transform: "rotate(45deg)", boxShadow: "0 4px 9px rgba(0,0,0,.28)" }} />
            )}
            <motion.div className="h-full w-full" animate={{ rotate: rotation }}
              transition={{ duration: 4.2, ease: [0.16, 1, 0.3, 1] }}>
              <svg viewBox="0 0 200 200" className="h-full w-full" style={{ filter: "drop-shadow(0 10px 22px rgba(0,0,0,.22))" }}>
                <circle cx={c} cy={c} r={97} fill={ch.rim} />
                <circle cx={c} cy={c} r={88.5} fill="none" stroke={ch.rimInner} strokeWidth={3} />
                {pegs.map(([x, y], k) => (
                  <circle key={`p${k}`} cx={x} cy={y} r={ch.peg === "bulb" ? 3.2 : ch.peg === "peg" ? 2.6 : 2.1}
                    fill={ch.pegColor} style={ch.peg === "bulb" ? { filter: `drop-shadow(0 0 3px ${ch.pegColor})` } : undefined} />
                ))}
                {step.segments.map((s, i) => (
                  <path key={i} d={slicePath(i)} fill={ch.alt ? ch.alt[i % 2] : s.color}
                    stroke={ch.dark ? "rgba(0,0,0,.28)" : "#fffaf2"} strokeWidth="2" />
                ))}
                {step.segments.map((s, i) => {
                  const [tx, ty] = polar(56, i * seg);
                  const ls = labelLines(s.label);
                  const fill = ch.alt ? (i % 2 === 0 ? "#ffffff" : "#3a2410") : "#5b4632";
                  return (
                    <text key={`t${i}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                      fontSize={11} fontWeight={800} fill={fill} style={{ letterSpacing: ".2px" }}>
                      {ls.length === 1 ? ls[0] : ls.map((l, j) => <tspan key={j} x={tx} dy={j === 0 ? "-0.5em" : "1.1em"}>{l}</tspan>)}
                    </text>
                  );
                })}
                {ch.star ? (() => {
                  const [sx, sy] = polar(78, step.winningIndex * seg);
                  return <text x={sx} y={sy} textAnchor="middle" dominantBaseline="middle" fontSize={15} fill="#f4c430">★</text>;
                })() : null}
              </svg>
            </motion.div>
            {/* miolo (tamanho varia por estilo) */}
            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-md"
              style={{ width: ch.hubR, height: ch.hubR, background: ch.hub, border: `6px solid ${ch.hubInner}` }}>
              {step.centerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={step.centerImage} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          </div>
          {ch.stand === "trapezoid" ? (
            <div className="mx-auto -mt-2" style={{ width: 96, height: 48, background: "linear-gradient(#333,#0a0a0a)", clipPath: "polygon(26% 0,74% 0,100% 100%,0 100%)" }} />
          ) : ch.stand === "podium" ? (
            <div className="mx-auto -mt-1 h-3.5 w-44 rounded-[50%] bg-white/85" style={{ boxShadow: "0 8px 18px rgba(0,0,0,.45)" }} />
          ) : null}

        <AnimatePresence>
          {done ? (
            <motion.div key="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl bg-[var(--q-bg-soft)] p-5 text-center">
              <p className="text-lg font-bold text-[var(--q-primary)]">{step.winTitle ?? "🎉 Você ganhou!"}</p>
              {step.winBody ? <p className="mt-1 text-sm text-[var(--q-text-muted)]">{step.winBody}</p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </StepShell>
      <StickyCta>
        {done ? (
          <CtaButton onClick={ctx.advance}>{step.winCta ?? "Continuar →"}</CtaButton>
        ) : (
          <CtaButton onClick={spin} disabled={spinning} pulse={!spinning}>{spinning ? "Girando..." : step.cta}</CtaButton>
        )}
      </StickyCta>
    </>
  );
}

// ── Raspadinha (scratch-card) ─────────────────────────────────────
export function ScratchStepView({ step, ctx }: { step: ScratchStep; ctx: StepCtx }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const drawing = useRef(false);
  const scratched = useRef<Set<number>>(new Set());
  const W = 320, H = 200;
  const COLS = 16, ROWS = 10;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const g = cv.getContext("2d"); if (!g) return;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, step.coverColor ?? "#c9c9c9");
    grad.addColorStop(1, "#9c9c9c");
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,.4)"; g.font = "bold 19px Poppins, system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(step.coverText ?? "RASPE AQUI", W / 2, H / 2 + 6);
    g.font = "26px serif"; g.fillText("👆", W / 2, H / 2 - 22);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const cv = canvasRef.current!; const r = cv.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return [((t.clientX - r.left) * W) / r.width, ((t.clientY - r.top) * H) / r.height];
  };
  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
    if (step.sound?.enabled) { if (step.sound.winUrl) playUrl(step.sound.winUrl); else playWin(); }
    import("canvas-confetti").then((m) => m.default({ particleCount: 160, spread: 90, origin: { y: 0.4 } })).catch(() => {});
  };
  const erase = (x: number, y: number) => {
    const g = canvasRef.current?.getContext("2d");
    if (!g) return;
    g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.fill();
    // cobertura por GRADE (robusto, não depende de getImageData)
    const gx = Math.floor((x / W) * COLS), gy = Math.floor((y / H) * ROWS);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cx = gx + dx, cy = gy + dy;
      if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) scratched.current.add(cy * COLS + cx);
    }
    if (scratched.current.size / (COLS * ROWS) > 0.5) reveal();
  };
  const down = (e: React.MouseEvent | React.TouchEvent) => { drawing.current = true; const [x, y] = pos(e); erase(x, y); };
  const move = (e: React.MouseEvent | React.TouchEvent) => { if (!drawing.current) return; const [x, y] = pos(e); erase(x, y); };
  const up = () => { drawing.current = false; };

  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.title, ctx.name)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">{step.subtitle}</p> : null}
        <div className="relative mx-auto mt-7" style={{ width: W, height: H, maxWidth: "100%" }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl text-center"
            style={{ background: "var(--q-bg-soft)", border: "2px dashed var(--q-primary)" }}>
            {step.prizeEmoji ? <span className="text-4xl">{step.prizeEmoji}</span> : null}
            <span className="mt-1 text-3xl font-black text-[var(--q-primary)]">{step.prize}</span>
          </div>
          {!revealed ? (
            <canvas ref={canvasRef} width={W} height={H}
              className="absolute inset-0 h-full w-full touch-none rounded-2xl"
              style={{ cursor: "grab" }}
              onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
              onTouchStart={down} onTouchMove={move} onTouchEnd={up} />
          ) : null}
        </div>
        {revealed ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 text-center">
            <p className="text-lg font-bold text-[var(--q-primary)]">{interp(step.winTitle ?? "🎉 Você ganhou!", ctx.name)}</p>
            {step.winBody ? <p className="mt-1 text-sm text-[var(--q-text-muted)]">{interp(step.winBody, ctx.name)}</p> : null}
          </motion.div>
        ) : null}
      </StepShell>
      <StickyCta>
        {revealed ? (
          <CtaButton onClick={ctx.advance}>{step.winCta}</CtaButton>
        ) : (
          <p className="text-center text-sm font-medium text-[var(--q-text-muted)]">👆 Raspe o card para revelar seu prêmio</p>
        )}
      </StickyCta>
    </>
  );
}

// ── Medida (número + unidade) ─────────────────────────────────────
export function MeasureStepView({ step, ctx }: { step: MeasureStep; ctx: StepCtx }) {
  const [v, setV] = useState(String(step.defaultValue ?? 0));
  const [unit, setUnit] = useState(0);
  const units = step.units ?? [];
  const go = () => {
    trackAnswer(ctx.funnelSlug, step.id, step.question, `${v} ${units[unit] ?? step.suffix ?? ""}`.trim());
    ctx.advance();
  };
  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.question, ctx.name)}</Title></div>
        {step.help ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">{step.help}</p> : null}
        {units.length > 1 ? (
          <div className="mx-auto mt-5 inline-flex rounded-full bg-[var(--q-bg-soft)] p-1">
            {units.map((u, i) => (
              <button key={i} onClick={() => setUnit(i)} className="rounded-full px-5 py-1.5 text-sm font-bold transition"
                style={{ background: unit === i ? "var(--q-primary)" : "transparent", color: unit === i ? "#fff" : "var(--q-text-muted)" }}>{u}</button>
            ))}
          </div>
        ) : null}
        <div className="mt-7 flex items-end justify-center gap-2">
          <input value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" autoFocus
            className="w-36 border-b-2 border-[var(--q-primary)] bg-transparent text-center text-5xl font-black text-[var(--q-text)] outline-none" />
          <span className="pb-2 text-xl font-semibold text-[var(--q-text-muted)]">{(units[unit] ?? step.suffix ?? "").toLowerCase()}</span>
        </div>
      </StepShell>
      <StickyCta><CtaButton onClick={go} disabled={!v}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Slider (0–10) ─────────────────────────────────────────────────
export function SliderStepView({ step, ctx }: { step: SliderStep; ctx: StepCtx }) {
  const min = step.min ?? 0, max = step.max ?? 10, st = step.step ?? 1;
  const [v, setV] = useState(step.defaultValue ?? Math.round((min + max) / 2));
  const scale = max - min <= 12;
  const go = () => {
    trackAnswer(ctx.funnelSlug, step.id, step.question, `${v}${step.suffix ?? ""}`);
    ctx.advance();
  };
  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.question, ctx.name)}</Title></div>
        {step.help ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">{step.help}</p> : null}
        <div className="mt-8">
          <div className="mb-2 text-center text-2xl font-black text-[var(--q-primary)]">{v}{step.suffix ?? ""}</div>
          <input type="range" min={min} max={max} step={st} value={v} onChange={(e) => setV(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: "var(--q-primary)", background: `linear-gradient(90deg, var(--q-primary) ${((v - min) / (max - min)) * 100}%, var(--q-bg-soft) ${((v - min) / (max - min)) * 100}%)` }} />
          {step.showScale ? (
            <div className="mt-2 flex justify-between px-0.5 text-xs font-semibold text-[var(--q-text-muted)]">
              {scale
                ? Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => <span key={n}>{n}</span>)
                : <><span>{min}</span><span>{Math.round((min + max) / 2)}</span><span>{max}</span></>}
            </div>
          ) : null}
        </div>
        {step.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt="" className="mx-auto mt-6 max-h-56 w-auto rounded-2xl object-contain" />
        ) : null}
      </StepShell>
      <StickyCta><CtaButton onClick={go}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Hero ──────────────────────────────────────────────────────────
export function HeroStepView({ step, ctx }: { step: HeroStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell>
        {step.badge ? (
          [...(step.badge)].length <= 2 ? (
            // emoji → badge circular com glow âmbar (vivadevelas)
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl"
              style={{ background: "var(--q-bg-soft)", boxShadow: "0 0 0 6px color-mix(in srgb, var(--q-primary) 10%, transparent), 0 16px 30px -10px var(--q-primary)" }}>
              <span className="relative z-[2]">{step.badge}</span>
              <motion.span className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 28px 6px color-mix(in srgb, var(--q-primary) 35%, transparent)" }}
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity }} />
            </motion.div>
          ) : (
            <span className="mx-auto mb-3 rounded-full bg-[var(--q-bg-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--q-primary)]">
              {step.badge}
            </span>
          )
        ) : null}
        {step.image ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            // eslint-disable-next-line @next/next/no-img-element
            src={step.image} alt="" className="mx-auto mb-5 max-h-72 w-auto rounded-2xl object-contain"
          />
        ) : null}
        <AnimatedTitle text={interp(step.title, ctx.name)} />
        {step.subtitle ? (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]">
            <RichText text={interp(step.subtitle, ctx.name)} />
          </p>
        ) : null}
        {step.gallery?.length ? (
          <div className="mt-4 overflow-hidden">
            <div className="q-marquee flex w-max gap-2">
              {[...step.gallery, ...step.gallery].map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          </div>
        ) : null}
      </StepShell>
      <StickyCta>
        <CtaButton onClick={ctx.advance}>{step.cta}</CtaButton>
        {(step.social || step.time) ? (
          <p className="mt-3 text-center text-xs text-[var(--q-text-muted)]">
            {step.social ? <span className="font-semibold text-[var(--q-text)]">{step.social}</span> : null}
            {step.social && step.time ? " · " : null}
            {step.time}
          </p>
        ) : null}
      </StickyCta>
    </>
  );
}

// ── Captura de nome ───────────────────────────────────────────────
export function NameStepView({ step, ctx }: { step: NameStep; ctx: StepCtx }) {
  const [v, setV] = useState(ctx.name);
  const ok = v.trim().length >= 2;
  const go = () => { if (!ok) return; ctx.setName(v.trim()); fireMetaEvent("Lead", { content_name: "name_capture" }); ctx.advance(); };
  return (
    <>
      <StepShell center>
        {step.emoji ? <div className="mb-3 text-center text-4xl">{step.emoji}</div> : null}
        <div className="text-center"><Title>{interp(step.title, ctx.name)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">{step.subtitle}</p> : null}
        <input
          autoFocus value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder={step.placeholder ?? "Digite seu nome..."}
          className="mt-5 w-full rounded-2xl border-2 border-black/10 bg-[var(--q-surface)] px-5 py-4 text-center text-lg font-semibold text-[var(--q-text)] outline-none focus:border-[var(--q-primary)]"
        />
      </StepShell>
      <StickyCta><CtaButton onClick={go} disabled={!ok}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Confirmação ───────────────────────────────────────────────────
export function ConfirmStepView({ step, ctx }: { step: ConfirmStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-full rounded-3xl bg-[var(--q-surface)] p-7 text-center shadow-xl">
          {step.emoji ? <div className="mb-2 text-4xl">{step.emoji}</div> : null}
          <Title>{interp(step.title, ctx.name)}</Title>
          {step.body ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx.name)} /></p> : null}
          {step.seal ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--q-bg-soft)] px-4 py-2 text-xs font-semibold text-[var(--q-primary)]">
              🔒 {step.seal}
            </div>
          ) : null}
        </motion.div>
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Pergunta ──────────────────────────────────────────────────────
export function QuestionStepView({ step, ctx }: { step: QuestionStep; ctx: StepCtx }) {
  const [sel, setSel] = useState<number[]>([]);
  const [phase, setPhase] = useState<"ask" | "loading" | "insight">("ask");

  const choose = (i: number) => {
    if (step.multi) {
      setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
      return;
    }
    setSel([i]);
    const opt = step.options[i];
    trackAnswer(ctx.funnelSlug, step.id, step.question, opt.label);
    if (step.insight || step.loadingText) {
      setPhase("loading");
      setTimeout(() => setPhase("insight"), 1400);
    } else {
      setTimeout(ctx.advance, 220);
    }
  };

  const confirmMulti = () => {
    sel.forEach((i) => trackAnswer(ctx.funnelSlug, step.id, step.question, step.options[i].label));
    if (step.insight || step.loadingText) { setPhase("loading"); setTimeout(() => setPhase("insight"), 1400); }
    else ctx.advance();
  };

  return (
    <>
      <StepShell>
        <Title>{interp(step.question, ctx.name)}</Title>
        {step.help ? <p className="mt-2 text-sm text-[var(--q-text-muted)]">{step.help}</p> : null}
        {step.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt="" className="mx-auto mt-4 max-h-44 w-auto rounded-xl object-contain" />
        ) : null}

        <AnimatePresence mode="wait">
          {phase === "ask" ? (
            step.layout === "cards" ? (
              <motion.div key="ask" exit={{ opacity: 0 }} className="mt-5 grid grid-cols-2 gap-3">
                {step.options.map((o: QuizOption, i) => (
                  <button key={i} onClick={() => choose(i)}
                    className="overflow-hidden rounded-2xl border-2 bg-[var(--q-surface)] text-left transition"
                    style={{ borderColor: sel.includes(i) ? "var(--q-ring)" : "rgba(0,0,0,.06)", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
                    {o.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image} alt="" className="aspect-square w-full object-cover" />
                    ) : <div className="flex aspect-square items-center justify-center text-5xl">{o.emoji ?? "🙂"}</div>}
                    <div className="px-3 py-2 text-sm font-bold text-[var(--q-text)]">{o.label}</div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="ask" exit={{ opacity: 0 }} className="mt-5 flex flex-col gap-3">
                {step.options.map((o: QuizOption, i) => (
                  <OptionButton key={i} label={o.label} emoji={o.emoji} image={o.image}
                    selected={sel.includes(i)} onClick={() => choose(i)} disabled={phase !== "ask"} />
                ))}
              </motion.div>
            )
          ) : phase === "loading" ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-6 rounded-2xl bg-[var(--q-bg-soft)] p-6 text-center">
              <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--q-primary)] border-t-transparent" />
              <p className="font-semibold text-[var(--q-primary)]">{interp(step.loadingText, ctx.name) || "Analisando..."}</p>
            </motion.div>
          ) : (
            <motion.div key="insight" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border-l-4 border-[var(--q-primary)] bg-[var(--q-bg-soft)] p-5">
              <p className="text-[15px] font-medium leading-relaxed text-[var(--q-text)]">{interp(step.insight, ctx.name)}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </StepShell>

      {(step.multi && phase === "ask") ? (
        <StickyCta><CtaButton onClick={confirmMulti} disabled={!sel.length}>{step.cta ?? "Continuar →"}</CtaButton></StickyCta>
      ) : phase === "insight" ? (
        <StickyCta><CtaButton onClick={ctx.advance}>{step.cta ?? "Continuar →"}</CtaButton></StickyCta>
      ) : null}
    </>
  );
}

// ── Loading / transição ───────────────────────────────────────────
export function LoadingStepView({ step, ctx }: { step: LoadingStep; ctx: StepCtx }) {
  if (step.style === "checklist") return <LoadingChecklist step={step} ctx={ctx} />;
  return <LoadingSimple step={step} ctx={ctx} />;
}

function LoadingSimple({ step, ctx }: { step: LoadingStep; ctx: StepCtx }) {
  const [i, setI] = useState(0);
  const dur = step.durationMs ?? 1700;
  const dark = step.variant === "dark";
  useEffect(() => {
    if (i >= step.slides.length - 1) {
      const t = setTimeout(ctx.advance, dur);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), dur);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`flex w-full flex-1 flex-col items-center justify-center px-6 ${dark ? "text-white" : ""}`}>
      <div className="relative mb-8 h-24 w-24">
        <motion.div className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, var(--q-primary) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }} />
        <div className="absolute inset-[38%] rounded-full bg-white shadow-[0_0_30px_8px_var(--q-primary)]" />
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className={`max-w-xs text-center text-lg font-semibold ${dark ? "text-white" : "text-[var(--q-text)]"}`}>
          {interp(step.slides[i], ctx.name)}
        </motion.p>
      </AnimatePresence>
      <div className="mt-6 flex gap-2">
        {step.slides.map((_, k) => (
          <span key={k} className="h-1.5 rounded-full transition-all"
            style={{ width: k === i ? 22 : 7, background: k <= i ? "var(--q-primary)" : "rgba(150,150,170,.4)" }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading sofisticado estilo "Preparando seu plano": múltiplas barras rotuladas
 * que enchem em sequência (✓ ao concluir), pausando em micro-perguntas (modal).
 */
function LoadingChecklist({ step, ctx }: { step: LoadingStep; ctx: StepCtx }) {
  const dark = step.variant === "dark";
  const bars = step.bars && step.bars.length ? step.bars : ["Processando…"];
  const checkpoints = useMemo(
    () => (step.checkpoints ?? []).slice().sort((a, b) => a.at - b.at),
    [step.checkpoints],
  );
  const total = step.durationMs ?? 4200;
  const [pct, setPct] = useState(0);
  const [paused, setPaused] = useState<number | null>(null);
  const answered = useRef<Set<number>>(new Set());
  const start = useRef<number | null>(null);
  const elapsedBeforePause = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = (ts: number) => {
      if (stop) return;
      if (start.current == null) start.current = ts;
      const p = Math.min(100, ((elapsedBeforePause.current + (ts - start.current)) / total) * 100);

      // pausa em checkpoint não respondido
      const cp = checkpoints.findIndex((c, idx) => !answered.current.has(idx) && p >= c.at);
      if (cp !== -1) {
        setPct(checkpoints[cp].at);
        setPaused(cp);
        elapsedBeforePause.current = (checkpoints[cp].at / 100) * total;
        start.current = null;
        return;
      }
      setPct(p);
      if (p >= 100) { setTimeout(ctx.advance, 350); return; }
      raf.current = requestAnimationFrame(tick);
    };
    if (paused == null) raf.current = requestAnimationFrame(tick);
    return () => { stop = true; if (raf.current) cancelAnimationFrame(raf.current); };
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (cpIdx: number, opt: string) => {
    const cp = checkpoints[cpIdx];
    trackAnswer(ctx.funnelSlug, `${step.id}:cp${cpIdx}`, cp.question, opt);
    answered.current.add(cpIdx);
    setPaused(null);
  };

  // qual barra está ativa, conforme o progresso
  const per = 100 / bars.length;
  const activeBar = Math.min(bars.length - 1, Math.floor(pct / per));
  const cp = paused != null ? checkpoints[paused] : null;

  return (
    <div className={`relative flex w-full flex-1 flex-col items-center justify-center px-7 ${dark ? "text-white" : ""}`}>
      {step.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={step.logo} alt="" className="mb-6 h-9 w-auto object-contain" />
      ) : null}
      {step.title ? (
        <h2 className="mb-7 text-center font-[var(--q-display)] text-[22px] font-bold leading-tight text-[var(--q-text)]">
          {interp(step.title, ctx.name)}
        </h2>
      ) : null}

      <div className="w-full max-w-sm space-y-4">
        {bars.map((label, idx) => {
          const done = idx < activeBar || pct >= 100;
          const active = idx === activeBar && pct < 100;
          const fill = done ? 100 : active ? Math.max(0, ((pct - idx * per) / per) * 100) : 0;
          return (
            <div key={idx}>
              <div className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">
                <span className={done || active ? "text-[var(--q-text)]" : "text-[var(--q-text-muted)] opacity-60"}>{interp(label, ctx.name)}</span>
                <span className="tabular-nums text-[var(--q-text-muted)]">
                  {done ? <span className="text-[var(--q-primary)]">✓</span> : active ? `${Math.round(fill)}%` : ""}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--q-bg-soft)]">
                <motion.div className="h-full rounded-full" style={{ background: "var(--q-primary)" }}
                  animate={{ width: `${fill}%` }} transition={{ ease: "linear", duration: 0.15 }} />
              </div>
            </div>
          );
        })}
      </div>

      {step.slides?.[0] ? (
        <p className="mt-7 text-center text-sm text-[var(--q-text-muted)]">{interp(step.slides[0], ctx.name)}</p>
      ) : null}

      {/* modal de micro-pergunta */}
      <AnimatePresence>
        {cp ? (
          <motion.div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 px-6 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}>
              <p className="mb-4 text-center text-[17px] font-bold leading-snug text-neutral-900">{interp(cp.question, ctx.name)}</p>
              <div className="space-y-2">
                {cp.options.map((o, k) => (
                  <button key={k} onClick={() => answer(paused!, o)}
                    className="w-full rounded-xl border-2 border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-[var(--q-primary)] hover:bg-[var(--q-bg-soft)]">
                    {o}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Medidor / projeção (gauge) ────────────────────────────────────
export function GaugeStepView({ step, ctx }: { step: GaugeStep; ctx: StepCtx }) {
  const sMin = step.scaleMin ?? 0, sMax = step.scaleMax ?? 100;
  const value = useMemo(() => {
    const [a, b] = step.range ?? [sMin, sMax];
    return Math.round(a + Math.random() * (b - a));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const zones = step.zones && step.zones.length ? step.zones : [{ label: "", color: "var(--q-primary)" }];
  const ratio = Math.max(0, Math.min(1, (value - sMin) / (sMax - sMin)));
  // ponteiro: -90° (esquerda) → +90° (direita)
  const [angle, setAngle] = useState(-90);
  useEffect(() => {
    const t = setTimeout(() => setAngle(-90 + ratio * 180), 250);
    return () => clearTimeout(t);
  }, [ratio]);

  // arco SVG semicircular dividido em zonas
  const R = 86, CX = 100, CY = 100;
  const pt = (deg: number) => {
    const rad = (deg - 180) * (Math.PI / 180);
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
  };
  let acc = 0;
  const arcs = zones.map((z) => {
    const span = 180 / zones.length;
    const [x1, y1] = pt(acc);
    const [x2, y2] = pt(acc + span);
    acc += span;
    return { d: `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`, color: z.color };
  });
  const zoneLabel = zones[Math.min(zones.length - 1, Math.floor(ratio * zones.length))]?.label ?? "";

  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.title, ctx.name)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">{interp(step.subtitle, ctx.name)}</p> : null}

        <div className="mx-auto mt-8 w-full max-w-xs">
          <svg viewBox="0 0 200 118" className="w-full">
            {arcs.map((a, i) => (
              <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={14} strokeLinecap="butt" opacity={0.92} />
            ))}
            {/* ponteiro */}
            <motion.line x1={CX} y1={CY} x2={CX} y2={CY - R + 16} stroke="var(--q-text)" strokeWidth={4} strokeLinecap="round"
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              initial={{ rotate: -90 }} animate={{ rotate: angle }} transition={{ type: "spring", stiffness: 60, damping: 12 }} />
            <circle cx={CX} cy={CY} r={8} fill="var(--q-text)" />
          </svg>
          <div className="-mt-2 text-center">
            <div className="text-4xl font-black text-[var(--q-primary)]">
              {interp(step.verdict ?? `{valor}${step.suffix ?? ""}`, ctx.name).replace("{valor}", String(value))}
            </div>
            {zoneLabel ? <div className="mt-1 text-sm font-bold uppercase tracking-wide text-[var(--q-text-muted)]">{zoneLabel}</div> : null}
          </div>
        </div>

        {step.caption ? <p className="mx-auto mt-5 max-w-xs text-center text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.caption, ctx.name)} /></p> : null}
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Resultado (teatral) ───────────────────────────────────────────
export function ResultStepView({ step, ctx }: { step: ResultStep; ctx: StepCtx }) {
  const target = useMemo(() => {
    const [a, b] = step.range;
    return Math.round(a + Math.random() * (b - a));
  }, [step.range]);
  const [n, setN] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    let raf = 0; const start = performance.now(); const dur = 1600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else if (!fired.current) {
        fired.current = true;
        import("canvas-confetti").then((m) => m.default({ particleCount: 140, spread: 80, origin: { y: 0.4 } })).catch(() => {});
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <>
      <StepShell center>
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--q-primary)]">Análise concluída</span>
          <div className="mt-3"><Title>{interp(step.title, ctx.name)}</Title></div>
          <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 120 }}
            className="my-6 mx-auto flex h-40 w-40 items-center justify-center rounded-full"
            style={{ background: "conic-gradient(var(--q-primary) " + n + "%, var(--q-bg-soft) 0)" }}>
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[var(--q-surface)] shadow-inner">
              <span className="text-5xl font-black text-[var(--q-primary)]">{n}%</span>
              <span className="text-[11px] font-semibold uppercase text-[var(--q-text-muted)]">compatibilidade</span>
            </div>
          </motion.div>
          {step.subtitle ? <p className="text-lg font-bold text-[var(--q-text)]">{interp(step.subtitle, ctx.name)}</p> : null}
          {step.minShown ? (
            <p className="mt-2 text-sm text-[var(--q-text-muted)]">
              O mínimo necessário era <b className="text-[var(--q-primary)]">{step.minShown}%</b>, e você foi muito além.
            </p>
          ) : null}
          {step.body ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]">{interp(step.body, ctx.name)}</p> : null}
        </div>
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Oferta ────────────────────────────────────────────────────────
export function OfferStepView({ step, ctx }: { step: OfferStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell>
        {step.badge ? <span className="mx-auto mb-3 rounded-full bg-[var(--q-bg-soft)] px-3 py-1 text-xs font-bold uppercase text-[var(--q-primary)]">{step.badge}</span> : null}
        {step.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt="" className="mx-auto mb-5 max-h-60 w-auto rounded-2xl object-contain" />
        ) : null}
        <Title>{interp(step.title, ctx.name)}</Title>
        {step.body ? <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx.name)} /></p> : null}
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Captura (lead) ────────────────────────────────────────────────
export function CaptureStepView({ step, ctx }: { step: CaptureStep; ctx: StepCtx }) {
  const [nm, setNm] = useState(ctx.name);
  const [ph, setPh] = useState("");
  const [sending, setSending] = useState(false);
  const ok = nm.trim().length >= 2 && ph.replace(/\D/g, "").length >= 10;

  const submit = async () => {
    if (!ok || sending) return;
    setSending(true);
    ctx.setName(nm.trim());
    fireMetaEvent("Lead", { content_name: "lead_capture" });
    if (ctx.vslId) await submitLead({ vslId: ctx.vslId, name: nm.trim(), phone: ph, componentId: step.componentId });
    else await submitFunnelLead({ funnelSlug: ctx.funnelSlug, name: nm.trim(), phone: ph, componentId: step.componentId });
    ctx.advance();
  };

  return (
    <>
      <StepShell>
        <Title>{interp(step.title, ctx.name)}</Title>
        {step.body ? <p className="mt-2 text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx.name)} /></p> : null}
        {step.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt="" className="mx-auto my-4 max-h-44 w-auto rounded-xl object-contain" />
        ) : null}
        <label className="mt-4 block text-sm font-semibold text-[var(--q-text)]">{step.nameLabel}</label>
        <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={step.namePlaceholder}
          className="mt-1 w-full rounded-xl border-2 border-black/10 bg-[var(--q-surface)] px-4 py-3 text-[var(--q-text)] outline-none focus:border-[var(--q-primary)]" />
        <label className="mt-4 block text-sm font-semibold text-[var(--q-text)]">{step.phoneLabel}</label>
        <input value={ph} onChange={(e) => setPh(e.target.value)} inputMode="tel" placeholder={step.phonePlaceholder}
          className="mt-1 w-full rounded-xl border-2 border-black/10 bg-[var(--q-surface)] px-4 py-3 text-[var(--q-text)] outline-none focus:border-[var(--q-primary)]" />
      </StepShell>
      <StickyCta><CtaButton onClick={submit} disabled={!ok || sending}>{sending ? "Enviando..." : step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Pós-captura ───────────────────────────────────────────────────
export function PostStepView({ step, ctx }: { step: PostStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <div className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--q-primary)] text-3xl text-white">✓</motion.div>
          <Title>{interp(step.title, ctx.name)}</Title>
          {step.body ? <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--q-text-muted)]">{interp(step.body, ctx.name)}</p> : null}
        </div>
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Bridge ────────────────────────────────────────────────────────
export function BridgeStepView({ step, ctx }: { step: BridgeStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <Title>{interp(step.title, ctx.name)}</Title>
        {step.body ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]">{interp(step.body, ctx.name)}</p> : null}
        {step.warn ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            🚨 {step.warn}
          </div>
        ) : null}
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── VSL (etapa final) ─────────────────────────────────────────────
export function VslStepView({ step, ctx }: { step: VslStep; ctx: StepCtx }) {
  const [reveal, setReveal] = useState((step.pitchRevealAt ?? 0) <= 0);
  useEffect(() => {
    if (reveal) return;
    const t = setTimeout(() => setReveal(true), (step.pitchRevealAt ?? 0) * 1000);
    return () => clearTimeout(t);
  }, [reveal, step.pitchRevealAt]);

  const openCheckout = () => {
    fireMetaEvent("InitiateCheckout");
    if (step.checkoutUrl) window.open(step.checkoutUrl, "_blank");
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center px-5 py-6">
      <div className="mx-auto w-full max-w-md">
        {step.title ? <h2 className="mb-4 text-center text-xl font-bold text-white">{interp(step.title, ctx.name)}</h2> : null}
        <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black/60 shadow-2xl">
          {step.vturbPlayerId ? (
            <div id={`vid-${step.vturbPlayerId}`} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-center text-white/70">
              <span className="text-4xl">▶</span>
              <p className="mt-3 px-6 text-sm">Player da VSL (VTurb) entra aqui — configure no admin.</p>
            </div>
          )}
        </div>
        <AnimatePresence>
          {reveal ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <CtaButton onClick={openCheckout}>{step.ctaText ?? "QUERO GARANTIR MINHA VAGA"}</CtaButton>
            </motion.div>
          ) : (
            <p className="mt-6 text-center text-sm text-white/60">⏳ Assista o vídeo para liberar o acesso...</p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
