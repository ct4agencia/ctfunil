"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, InleadDesign } from "@/lib/quiz/layers/types";
import { trackStep, trackAnswer } from "@/lib/quiz/track";
import { getSessionId, collectTrackingParams, fireMetaEvent } from "@/lib/tracking";
import { ScrollHint } from "../ui";
import { type StepCtx } from "../steps";
import { getPalette, paletteVars } from "@/lib/quiz/theme";
import type { RouletteStep } from "@/lib/quiz/types";
import dynamic from "next/dynamic";
import { Block, Reveal, SliderHero, LayersEditContext, type LayersCtx, type LayersEdit } from "./blocks";

// Modo editor (drag & drop com dnd-kit) carregado SÓ no construtor — mantém o
// @dnd-kit + EditBlock fora do bundle do funil público.
const EditableBlockList = dynamic(() => import("./EditableBlocks").then((m) => m.EditableBlockList), { ssr: false });

// RouletteStepView vive no steps.tsx (1270 linhas: roleta/raspadinha/gauge/quiz
// inteiro). Só é usado em hero tipo "roleta" — lazy-load pra NÃO puxar o steps.tsx
// pro bundle dos funis sem roleta (a maioria).
const RouletteStepView = dynamic(() => import("../steps").then((m) => m.RouletteStepView), { ssr: false });

/** rem da string container "max-w-[34rem]". */
function containerMax(c?: string): string {
  const m = (c || "").match(/([\d.]+)rem/);
  return m ? `${m[1]}rem` : "34rem";
}
const ALIGN: Record<string, string> = {
  "justify-start": "flex-start", "justify-center": "center", "justify-end": "flex-end",
};

export default function LayersRunner({ funnel, geo, startIndex = 0, preview = false, editor }: { funnel: Funnel; geo?: { estado?: string; cidade?: string }; startIndex?: number; preview?: boolean; editor?: LayersEdit }) {
  const allSteps = funnel.steps as unknown as InleadStep[];
  // runtime PULA lâminas desativadas; no preview do construtor mostra todas (pra editar)
  const steps = preview ? allSteps : allSteps.filter((s) => !s.disabled);
  const design = (funnel.settings?.design as InleadDesign) || {};
  const total = steps.length;

  const [idx, setIdx] = useState(startIndex);
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
    if (!preview) trackStep(funnel.slug, idx, step.id, "layers");
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

  // A3: reenvia leads que falharam num envio anterior (ao montar o funil)
  useEffect(() => {
    if (preview) return;
    let pend: unknown[] = [];
    try { pend = JSON.parse(localStorage.getItem("ctf_pending_leads") || "[]"); } catch { pend = []; }
    if (!Array.isArray(pend) || !pend.length) return;
    Promise.allSettled(
      pend.map((p) => fetch("/api/funnel-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then((r) => (r.ok ? null : Promise.reject(new Error("fail"))))),
    ).then((res) => {
      const still = pend.filter((_, i) => res[i].status !== "fulfilled");
      try { localStorage.setItem("ctf_pending_leads", JSON.stringify(still)); } catch { /* noop */ }
    });
  }, []);

  const submitFields = async () => {
    if (submitting) return;
    if (preview) { const btn = (step.layers || []).find((l) => l.type === "button"); navigate(btn?.content.destination || "next"); return; }
    const fls = (step.layers || []).filter((l) => l.type === "field");
    const keyOf = (l?: typeof fls[number]) => (l ? (l.content.name || l.content.id || "") : "");
    const PHONE_RE = /tel|whats|phone|celular|wpp|fone/i;
    const EMAIL_RE = /e-?mail/i;
    const phoneL = fls.find((l) => l.content.type === "phone" || l.content.mask === "phone_br" || PHONE_RE.test(l.content.name || ""));
    const emailL = fls.find((l) => l.content.type === "email" || EMAIL_RE.test(l.content.name || ""));
    const nameL = fls.find((l) => l !== phoneL && l !== emailL && (l.content.type === "text" || l.content.type == null));

    // A2: telefone guardado LIMPO (só dígitos). A máscara fica só na tela.
    const phone = (phoneL ? (fields[keyOf(phoneL)] || "") : (fields["telefone"] || fields["whatsapp"] || "")).replace(/\D/g, "");
    const nome = (nameL ? fields[keyOf(nameL)] : "") || name || "";
    const email = emailL ? (fields[keyOf(emailL)] || "") : "";

    // nome e telefone são OBRIGATÓRIOS pra continuar (quando os campos existem na lâmina)
    if (nameL && nome.trim().length < 2) {
      alert("Por favor, preencha seu nome 🙂");
      return;
    }
    if (phoneL && phone.length < 10) {
      alert("Confere seu número de Whatsapp com DDD 🙂");
      return;
    }
    setSubmitting(true);
    const payload = {
      funnelSlug: funnel.slug,
      name: nome,
      phone,
      email: email || undefined,
      componentId: "captura",
      session_id: `${getSessionId()}::${funnel.slug}`,
      estado: geo?.estado || "",
      cidade: geo?.cidade || "",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      platform: navigator.platform,
      user_agent: navigator.userAgent,
      tracking: collectTrackingParams() as unknown as Record<string, string>,
    };
    let ok = false;
    try {
      const res = await fetch("/api/funnel-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      ok = res.ok;
    } catch { ok = false; }

    if (ok) {
      // C1: avisa a Meta da conversão (esse era o evento que NUNCA disparava no motor layers)
      if (phone) fireMetaEvent("Lead", { content_name: "lead_capture" });
    } else {
      // A3: NÃO perde o lead — guarda pra reenviar na próxima navegação
      try {
        const pend = JSON.parse(localStorage.getItem("ctf_pending_leads") || "[]");
        pend.push(payload);
        localStorage.setItem("ctf_pending_leads", JSON.stringify(pend.slice(-20)));
      } catch { /* noop */ }
    }
    setSubmitting(false);
    const btn = (step.layers || []).find((l) => l.type === "button");
    navigate(btn?.content.destination || "next");
  };

  const ctx: LayersCtx = {
    design, name, setName,
    fields, setField: (k, v) => setFields((p) => ({ ...p, [k]: v })),
    estado: geo?.estado, cidade: geo?.cidade,
    funnelSlug: funnel.slug, stepId: step.id, preview,
    hasFields, submitting, submitFields,
    navigate,
    // guarda de preview: sem isso, editar/testar no construtor gravava resposta
    // real em quiz_answers e contaminava a aba Resultados.
    trackAnswer: (stepId, q, a) => { if (!preview) trackAnswer(funnel.slug, stepId, q, a); },
  };

  const bgImg = step.design?.backgroundImage?.src || null;
  const bgOpacity = Number(step.design?.backgroundOpacity ?? 100) / 100;
  // ajuste do fundo: cover (tela inteira) | none (original) | contain (adequar) | fill (esticar)
  const bgFit = ({ cover: "cover", auto: "none", contain: "contain", fill: "fill" } as const)[(step.design?.backgroundSize as string) || "cover"] || "cover";
  const bgPos = (step.design?.backgroundPosition as string) || "center";
  const pageBg = step.design?.backgroundColor || design.backgroundColor || "#ffffff";
  const question = step.title || "";

  // ── Heros TIPADOS (roleta/slider) — reaproveitam os StepView do motor antigo ──
  // Renderizam em tela cheia com as CSS-vars de paleta. Roleta = fundo escuro;
  // slider = fundo claro (combina com o resto do funil inlead).
  const hero = (step.layers || []).find((l) => l.type === "roulette" || l.type === "slider");
  if (hero) {
    const palette = getPalette(funnel.paletteId);
    // SLIDER hero: layout dedicado (foto full-bleed no rodapé + gradiente, botão acima).
    if (hero.type === "slider") {
      return <SliderHero step={hero.content} ctx={ctx} theme={design.themeColor || palette.primary || "#ea580c"} bgColor={pageBg} />;
    }
    // ROLETA hero: tela cheia escura, reaproveita o RouletteStepView do /cdb-r.
    const stepCtx: StepCtx = {
      name, setName, advance: () => navigate("next"),
      // `preview` da prop (era `false` fixo): no construtor o hero de roleta
      // gravava resposta REAL em quiz_answers a cada teste interno.
      funnelSlug: funnel.slug, palette, preview,
      estado: geo?.estado, cidade: geo?.cidade,
    };
    const rbg = (hero.content.background as string) ||
      "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)";
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col overflow-x-hidden"
        style={{
          ...paletteVars(palette),
          ["--q-bg"]: "#160a22", ["--q-text"]: "#ffffff", ["--q-text-muted"]: "rgba(255,255,255,.72)",
          background: rbg, color: "#ffffff",
        } as React.CSSProperties}
      >
        <main className="flex flex-1 flex-col">
          <RouletteStepView step={hero.content as unknown as RouletteStep} ctx={stepCtx} />
        </main>
        <ScrollHint dep={idx} />
      </div>
    );
  }

  return (
    <LayersEditContext.Provider value={editor ?? null}>
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden" style={{ background: pageBg, color: design.contentColor || "#000" }}>
      <style>{`
        .lyr-html{line-height:1.45;overflow-wrap:break-word}
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
        .lyr-html p{margin:0}
        .lyr-html font{line-height:1.05}
        .lyr-html p br{display:block;content:"";height:0;padding-bottom:.5rem;margin-bottom:.5rem}
        .lyr-html a{color:${design.themeColor || "#ea580c"};text-decoration:underline}
      `}</style>

      {/* fundo personalizado da lâmina */}
      {bgImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgImg} alt="" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: bgOpacity, objectFit: bgFit, objectPosition: bgPos }} />
      ) : null}

      {/* header GLOBAL (settings.header): logo + progresso + voltar.
          Aparece em TODAS as lâminas exceto o HERO (idx 0) e a VSL (lâmina com vídeo). */}
      {(() => {
        const g = ((funnel.settings as { header?: Record<string, boolean> })?.header || {}) as Record<string, boolean | undefined>;
        const ov = (step.headerOverride || {}) as Record<string, boolean | undefined>;
        const eff = (k: string) => (ov[k] !== undefined ? ov[k] : g[k]) || false;
        const hdr = { show_logo: eff("show_logo"), show_progress: eff("show_progress"), show_back: eff("show_back") };
        const hasOverride = ["show_logo", "show_progress", "show_back", "go_to_top"].some((k) => ov[k] !== undefined);
        const isVslStep = (step.layers || []).some((l) => l.type === "embed" || l.type === "video");
        if (idx === 0) return null;                  // hero nunca tem header
        if (isVslStep && !hasOverride) return null;   // VSL sem header por padrão (salvo override por lâmina)
        if (!hdr.show_logo && !hdr.show_progress && !hdr.show_back) return null;
        return (
          <header className="relative z-10 mx-auto flex w-full flex-col items-center gap-2 px-5 pt-5" style={{ maxWidth: containerMax(design.container) }}>
            {hdr.show_back && history.current.length ? <button onClick={back} className="self-start text-sm opacity-60">← Voltar</button> : null}
            {hdr.show_logo && design.logo?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={design.logo.src} alt="" decoding="async" className="w-auto object-contain"
                style={{ height: `${Number(design.logoSize) || 36}px`, opacity: (Number(design.logoOpacity ?? 100) || 100) / 100 }} />
            ) : null}
            {hdr.show_progress ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full transition-[width]" style={{ width: `${((idx + 1) / total) * 100}%`, background: design.themeColor || "#ea580c" }} />
              </div>
            ) : null}
          </header>
        );
      })()}

      {/* botão "Ir ao topo" (override por lâmina ou global) */}
      {(() => {
        const g = ((funnel.settings as { header?: Record<string, boolean> })?.header || {}) as Record<string, boolean | undefined>;
        const ov = (step.headerOverride || {}) as Record<string, boolean | undefined>;
        const goTop = (ov.go_to_top !== undefined ? ov.go_to_top : g.go_to_top) || false;
        if (!goTop || idx === 0) return null;
        return (
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Ir ao topo"
            className="fixed bottom-4 right-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-lg text-white shadow-lg backdrop-blur">↑</button>
        );
      })()}

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
              const ls = step.layers || [];
              // ── modo editor: cada bloco arrastável (⠿) p/ reordenar; sem agrupar imagens ──
              if (editor) {
                return <EditableBlockList layers={ls} ctx={ctx} question={question} editor={editor} />;
              }
              // agrupa IMAGENS consecutivas numa linha (igual inlead: 3 fotos 33% lado a lado)
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
                            <img src={g.content.image?.src || ""} alt="" loading="lazy" decoding="async" className="h-auto w-full rounded-2xl object-contain" />
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
    </LayersEditContext.Provider>
  );
}
