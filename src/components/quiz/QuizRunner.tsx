"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Funnel, Step, RouletteStep } from "@/lib/quiz/types";
import { getPalette, paletteVars } from "@/lib/quiz/theme";
import { trackStep } from "@/lib/quiz/track";
import { playClick, startMusic, stopMusic } from "@/lib/quiz/sound";
import { TopBar, ScrollHint } from "./ui";
import {
  wheelChrome,
  RouletteStepView, ScratchStepView, MeasureStepView, SliderStepView, HeroStepView, NameStepView, ConfirmStepView, QuestionStepView, LoadingStepView, GaugeStepView,
  ResultStepView, OfferStepView, CaptureStepView, PostStepView, BridgeStepView,
  VslStepView, type StepCtx,
} from "./steps";

const SHOW_BAR: Record<Step["type"], boolean> = {
  roulette: false, scratch: false, measure: true, slider: true, hero: false, name: true, confirm: true, question: true, loading: false, gauge: true,
  result: false, offer: true, capture: true, post_capture: true, bridge: true, vsl: false,
};
const DARK: Record<Step["type"], boolean> = {
  roulette: false, scratch: false, measure: false, slider: false, hero: false, name: false, confirm: false, question: false, loading: false, gauge: false,
  result: false, offer: false, capture: false, post_capture: false, bridge: false, vsl: true,
};

/** Estima se um fundo CSS (gradiente/cor) é escuro, pela luminância média dos #hex. */
function bgIsDark(css: string): boolean {
  const hexes = css.match(/#[0-9a-fA-F]{6}/g);
  if (!hexes || !hexes.length) return false;
  const avg = hexes.reduce((sum, h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return sum + (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }, 0) / hexes.length;
  return avg < 0.5;
}

export default function QuizRunner({ funnel, vslId, startIndex = 0, preview = false }: { funnel: Funnel; vslId?: string; startIndex?: number; preview?: boolean }) {
  const palette = getPalette(funnel.paletteId);
  const [index, setIndex] = useState(startIndex);
  const [name, setName] = useState("");

  const steps = funnel.steps;
  const step = steps[index];
  const rChrome = step.type === "roulette" ? wheelChrome((step as RouletteStep).style, palette) : null;
  const percent = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0;
  const dark = DARK[step.type] || (step.type === "loading" && step.variant === "dark") || (rChrome?.dark ?? false);
  // fundo personalizado por lâmina (roleta/vsl) tem prioridade
  const customBg = (step as { background?: string }).background;
  const rootBg = customBg
    ? customBg
    : rChrome?.bg
      ? rChrome.bg
      : dark
        ? "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)"
        : "var(--q-bg)";
  // texto adapta ao fundo: se o fundo aplicado for escuro, texto claro
  const effectiveDark = dark || bgIsDark(rootBg);

  const musicStarted = useRef(false);

  // tracking do avanço de etapa (funnel_sessions + step_events) — NUNCA no preview do construtor
  useEffect(() => {
    if (!preview) trackStep(funnel.slug, index, step.id, step.type);
    window.scrollTo({ top: 0 });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // trilha sonora para ao desmontar o runner
  useEffect(() => () => stopMusic(), []);

  const advance = () => {
    if (!preview && funnel.clickSound) playClick();
    if (!preview && funnel.music && !musicStarted.current) {
      startMusic(funnel.music);
      musicStarted.current = true;
    }
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const ctx: StepCtx = { name, setName, advance, funnelSlug: funnel.slug, vslId, palette, preview };

  const render = (s: Step) => {
    switch (s.type) {
      case "roulette": return <RouletteStepView step={s} ctx={ctx} />;
      case "scratch": return <ScratchStepView step={s} ctx={ctx} />;
      case "measure": return <MeasureStepView step={s} ctx={ctx} />;
      case "slider": return <SliderStepView step={s} ctx={ctx} />;
      case "hero": return <HeroStepView step={s} ctx={ctx} />;
      case "name": return <NameStepView step={s} ctx={ctx} />;
      case "confirm": return <ConfirmStepView step={s} ctx={ctx} />;
      case "question": return <QuestionStepView step={s} ctx={ctx} />;
      case "loading": return <LoadingStepView step={s} ctx={ctx} />;
      case "gauge": return <GaugeStepView step={s} ctx={ctx} />;
      case "result": return <ResultStepView step={s} ctx={ctx} />;
      case "offer": return <OfferStepView step={s} ctx={ctx} />;
      case "capture": return <CaptureStepView step={s} ctx={ctx} />;
      case "post_capture": return <PostStepView step={s} ctx={ctx} />;
      case "bridge": return <BridgeStepView step={s} ctx={ctx} />;
      case "vsl": return <VslStepView step={s} ctx={ctx} />;
    }
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{
        ...paletteVars(palette),
        ...(effectiveDark ? { ["--q-bg"]: "#160a22", ["--q-text"]: "#ffffff", ["--q-text-muted"]: "rgba(255,255,255,.72)" } : {}),
        background: rootBg,
        color: "var(--q-text)",
      } as React.CSSProperties}
    >
      {SHOW_BAR[step.type] ? (
        <TopBar percent={percent} logo={funnel.logo} onBack={back} showBack={index > 0} />
      ) : null}
      <main className="flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <div key={index} className="flex flex-1 flex-col">{render(step)}</div>
        </AnimatePresence>
      </main>
      {funnel.settings?.footer && step.type === "vsl" ? (
        <footer className="px-5 pb-6 pt-2 text-center text-xs text-white/55">{funnel.settings.footer}</footer>
      ) : null}
      <ScrollHint dep={index} />
    </div>
  );
}
