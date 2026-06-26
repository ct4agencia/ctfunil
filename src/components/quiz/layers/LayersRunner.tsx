"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, InleadDesign } from "@/lib/quiz/layers/types";
import { trackStep, trackAnswer } from "@/lib/quiz/track";
import { getSessionId, collectTrackingParams } from "@/lib/tracking";
import { ScrollHint } from "../ui";
import { RouletteStepView, SliderStepView, type StepCtx } from "../steps";
import { getPalette, paletteVars } from "@/lib/quiz/theme";
import type { RouletteStep, SliderStep } from "@/lib/quiz/types";
import { Block, Reveal, type LayersCtx } from "./blocks";

/** rem da string container "max-w-[34rem]". */
function containerMax(c?: string): string {
  const m = (c || "").match(/([\d.]+)rem/);
  return m ? `${m[1]}rem` : "34rem";
}
const ALIGN: Record<string, string> = {
  "justify-start": "flex-start", "justify-center": "center", "justify-end": "flex-end",
};

export default function LayersRunner({ funnel, geo }: { funnel: Funnel; geo?: { estado?: string; cidade?: string } }) {
  const steps = funnel.steps as unknown as InleadStep[];
  const design = (funnel.settings?.design as InleadDesign) || {};
  const total = steps.length;

  const [idx, setIdx] = useState(0);
  const history = useRef<number[]>([]);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const step = steps[idx];
  const idById = useMemo(() => {
    const m: Record<string, number> = {};
    steps.forEach((s, i) => (m[s.id] = i));
    return m;
  }, [steps]);

  useEffect(() => {
    trackStep(funnel.slug, idx, step.id, "layers");
    window.scrollTo({ top: 0 });
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => {
    if (n < 0 || n >= total || n === idx) return;
    history.current.push(idx);
    setIdx(n);
  };
  const navigate = (dest?: string) => {
    if (!dest || dest === "next") return go(idx + 1);
    if (/^https?:\/\//i.test(dest)) { window.location.href = dest; return; }
    if (idById[dest] != null) return go(idById[dest]);
    go(idx + 1);
  };
  const back = () => {
    const prev = history.current.pop();
    if (prev != null) setIdx(prev);
  };

  const hasFields = (step.layers || []).some((l) => l.type === "field");

  const submitFields = async () => {
    if (submitting) return;
    const phone = fields["telefone"] || fields["whatsapp"] || "";
    const nome = fields["nome"] || name || "";
    // valida telefone obrigatório (se houver campo de telefone)
    const needsPhone = (step.layers || []).some((l) => l.type === "field" && (l.content.type === "phone" || l.content.mask === "phone_br"));
    if (needsPhone && phone.replace(/\D/g, "").length < 10) {
      alert("Confere seu número de Whatsapp com DDD 🙂");
      return;
    }
    setSubmitting(true);
    try {
      await fetch("/api/funnel-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelSlug: funnel.slug,
          name: nome,
          phone,
          componentId: "captura",
          session_id: getSessionId(),
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          screen: `${window.screen.width}x${window.screen.height}`,
          platform: navigator.platform,
          user_agent: navigator.userAgent,
          tracking: collectTrackingParams() as unknown as Record<string, string>,
        }),
      });
    } catch {
      /* best-effort: não bloqueia o avanço */
    }
    setSubmitting(false);
    // avança pelo destino do botão da lâmina
    const btn = (step.layers || []).find((l) => l.type === "button");
    navigate(btn?.content.destination || "next");
  };

  const ctx: LayersCtx = {
    design, name, setName,
    fields, setField: (k, v) => setFields((p) => ({ ...p, [k]: v })),
    estado: geo?.estado, cidade: geo?.cidade,
    funnelSlug: funnel.slug, stepId: step.id,
    hasFields, submitting, submitFields,
    navigate,
    trackAnswer: (stepId, q, a) => trackAnswer(funnel.slug, stepId, q, a),
  };

  const bgImg = step.design?.backgroundImage?.src || null;
  const bgOpacity = Number(step.design?.backgroundOpacity ?? 100) / 100;
  const pageBg = step.design?.backgroundColor || design.backgroundColor || "#ffffff";
  const question = step.title || "";

  // ── Heros TIPADOS (roleta/slider) — reaproveitam os StepView do motor antigo ──
  // Renderizam em tela cheia com as CSS-vars de paleta. Roleta = fundo escuro;
  // slider = fundo claro (combina com o resto do funil inlead).
  const hero = (step.layers || []).find((l) => l.type === "roulette" || l.type === "slider");
  if (hero) {
    const palette = getPalette(funnel.paletteId);
    const dark = hero.type === "roulette";
    const heroBg = (hero.content.background as string) ||
      (dark ? "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)" : (design.backgroundColor || "#ffffff"));
    const stepCtx: StepCtx = {
      name, setName, advance: () => navigate("next"),
      funnelSlug: funnel.slug, palette, preview: false,
      estado: geo?.estado, cidade: geo?.cidade,
    };
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col overflow-x-hidden"
        style={{
          ...paletteVars(palette),
          ...(dark ? { ["--q-bg"]: "#160a22", ["--q-text"]: "#ffffff", ["--q-text-muted"]: "rgba(255,255,255,.72)" } : {}),
          background: heroBg, color: dark ? "#ffffff" : (design.contentColor || "#000"),
        } as React.CSSProperties}
      >
        <main className="flex flex-1 flex-col">
          {hero.type === "roulette"
            ? <RouletteStepView step={hero.content as unknown as RouletteStep} ctx={stepCtx} />
            : <SliderStepView step={hero.content as unknown as SliderStep} ctx={stepCtx} />}
        </main>
        <ScrollHint dep={idx} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden" style={{ background: pageBg, color: design.contentColor || "#000" }}>
      <style>{`
        .lyr-html{line-height:1.45;overflow-wrap:break-word;word-break:break-word}
        .lyr-html p{margin:0}
        .lyr-html p+p,.lyr-html p+ul,.lyr-html p+ol,.lyr-html ul+p,.lyr-html h1+p,.lyr-html h2+p,.lyr-html h3+p{margin-top:.75rem}
        .lyr-html h1{font-size:2em}
        .lyr-html h2{font-size:1.5em}
        .lyr-html h3{font-size:1.17em}
        .lyr-html h1,.lyr-html h2,.lyr-html h3{margin:0;line-height:1.15;font-weight:700}
        .lyr-html .ql-size-huge{font-size:2.5em;line-height:1}
        .lyr-html .ql-size-large{font-size:1.5em}
        .lyr-html .ql-size-small{font-size:.75em}
        .lyr-html .ql-align-center{text-align:center}
        .lyr-html .ql-align-right{text-align:right}
        .lyr-html .ql-align-justify{text-align:justify}
        .lyr-html strong{font-weight:700}
        .lyr-html em{font-style:italic}
        .lyr-html u{text-decoration:underline}
        .lyr-html p br{display:block;content:"";height:0;padding-bottom:.5rem;margin-bottom:.5rem}
        .lyr-html a{color:${design.themeColor || "#ea580c"};text-decoration:underline}
      `}</style>

      {/* fundo personalizado da lâmina */}
      {bgImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: bgOpacity }} />
      ) : null}

      {/* header: logo + progresso */}
      {(step.options?.show_logo && design.logo?.src) || step.options?.show_progress ? (
        <header className="relative z-10 mx-auto flex w-full flex-col items-center gap-2 px-5 pt-5" style={{ maxWidth: containerMax(design.container) }}>
          {step.options?.show_back && history.current.length ? (
            <button onClick={back} className="self-start text-sm opacity-60">← Voltar</button>
          ) : null}
          {step.options?.show_logo && design.logo?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={design.logo.src} alt="" className="h-10 w-auto object-contain" />
          ) : null}
          {step.options?.show_progress ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${((idx + 1) / total) * 100}%`, background: design.themeColor || "#ea580c" }} />
            </div>
          ) : null}
        </header>
      ) : null}

      {/* conteúdo */}
      <main className="relative z-10 flex flex-1 flex-col px-5 py-6" style={{ justifyContent: ALIGN[design.verticalAlign || "justify-start"] || "flex-start" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="mx-auto flex w-full flex-col"
            style={{ maxWidth: containerMax(design.container), gap: `${Number(design.gap) || 0.6}rem` }}
          >
            {(() => {
              // agrupa IMAGENS consecutivas numa linha (igual inlead: 3 fotos 33% lado a lado)
              const ls = step.layers || [];
              const out: React.ReactNode[] = [];
              for (let k = 0; k < ls.length; k++) {
                const l = ls[k];
                if (l.type === "image" && ls[k + 1]?.type === "image") {
                  const grp = [l];
                  while (ls[k + 1]?.type === "image") grp.push(ls[++k]);
                  out.push(
                    <div key={l.id} className="flex w-full items-start justify-center gap-2">
                      {grp.map((g) => (
                        <div key={g.id} className="min-w-0 flex-1">
                          <Reveal delay={g.effects?.starts}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={g.content.image?.src || ""} alt="" className="h-auto w-full rounded-2xl object-contain" />
                          </Reveal>
                        </div>
                      ))}
                    </div>,
                  );
                } else {
                  out.push(<Block key={l.id} layer={l} ctx={ctx} question={question} />);
                }
              }
              return out;
            })()}
          </motion.div>
        </AnimatePresence>
      </main>

      {funnel.settings?.footer ? (
        <footer className="relative z-10 px-5 pb-6 pt-2 text-center text-xs opacity-50">{funnel.settings.footer}</footer>
      ) : null}

      {/* setinha pulsante "role pra baixo" (pedido do Luca) */}
      <ScrollHint dep={idx} />
    </div>
  );
}
