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
import { estiloPilulaPergunta } from "@/lib/quiz/resina";
import ResinaQuiz from "../ResinaQuiz";

/** Tira tags e entidades: o `ResinaQuiz` recebe texto puro, não HTML. */
const semHtml = (h?: string) =>
  String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
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

/**
 * Blocos-hero herdados do motor tipado. Ocupam a lâmina inteira e reaproveitam
 * os componentes de components/quiz/ — mesmo mecanismo da roleta, que já fazia
 * isso desde sempre. Todos em `dynamic`: funil que não usa o bloco não baixa
 * uma linha a mais (o steps.tsx sozinho tem 1270 linhas).
 */
const ScratchGrid = dynamic(() => import("../ScratchGrid"), { ssr: false });
const MeasureStepView = dynamic(() => import("../steps").then((m) => m.MeasureStepView), { ssr: false });
const GaugeStepView = dynamic(() => import("../steps").then((m) => m.GaugeStepView), { ssr: false });
const VslStepView = dynamic(() => import("../steps").then((m) => m.VslStepView), { ssr: false });
const ConfirmStepView = dynamic(() => import("../steps").then((m) => m.ConfirmStepView), { ssr: false });

/** Tipos de bloco que tomam a lâmina inteira (não empilham com outros). */
const HERO_TIPADO = new Set(["roulette", "slider", "scratch", "measure", "gauge", "vsl", "confirm"]);

/**
 * Tipo que representa a lâmina no relatório. Bloco-hero manda (ele É a lâmina);
 * senão, o bloco mais significativo da pilha. Sem isso, `step_events.step_type`
 * recebia "layers" para tudo e não dava pra saber onde a lead parava por TIPO.
 */
const PESO_TIPO = ["options", "field", "embed", "video", "button", "loading", "carousel"];
function tipoDaLamina(s: InleadStep): string {
  const ls = (s.layers || []);
  const hero = ls.find((l) => HERO_TIPADO.has(l.type));
  if (hero) return hero.type;
  for (const t of PESO_TIPO) if (ls.some((l) => l.type === t)) return t;
  return "layers";
}

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
  // Setinha "role pra baixo". Nasce LIGADA; o Design define o global e cada
  // lâmina pode sobrescrever (mesmo headerOverride de logo/progresso/voltar).
  const scrollHintGlobal =
    ((funnel.settings as { header?: Record<string, boolean> })?.header || {}).show_scroll_hint !== false;

  const [idx, setIdx] = useState(startIndex);
  const history = useRef<number[]>([]);

  /**
   * PRIMEIRA pintura não anima — as trocas de lâmina continuam animando.
   *
   * O `motion.div` da lâmina usava `initial={{ opacity: 0, y: 14 }}` sempre. A
   * doc do motion (motion.dev/docs/react-motion-component) é explícita: "motion
   * components are fully compatible with server-side rendering, meaning the
   * INITIAL STATE of the component will be reflected in the server-generated
   * output". Ou seja, o funil inteiro era servido com `opacity: 0` e só ficava
   * visível quando o JS hidratava e rodava a animação de 0,28 s.
   *
   * Medido em produção (cdb-01, Pixel 7 / 4G lento / CPU 4x, visita fria):
   * o HTML chegava em 37 ms com todo o conteúdo dentro, e o LCP só marcava aos
   * 9.860 ms. O navegador tinha os pixels e estava proibido de pintá-los.
   *
   * `initial={false}` faz o servidor emitir direto o estado de `animate` — a
   * mesma doc: "`initial` can be set as `false` to disable the enter animation
   * and initially render as the values found in `animate`".
   *
   * Por que uma ref e não `idx === 0`: com `idx === 0` a lâmina 1 perderia a
   * animação para SEMPRE, inclusive ao voltar para ela no meio do funil. A ref
   * marca só o primeiro render — e como ela é lida durante o render e só muda
   * no efeito, servidor e hidratação enxergam o MESMO valor (`true`), então não
   * há divergência de hidratação.
   */
  const primeiroPaint = useRef(true);
  useEffect(() => { primeiroPaint.current = false; }, []);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const step = steps[idx];
  // override por lâmina vence o global; ausente nos dois = ligada
  const scrollHintLigado = (() => {
    const ov = (step?.headerOverride || {}) as Record<string, boolean | undefined>;
    return ov.show_scroll_hint !== undefined ? !!ov.show_scroll_hint : scrollHintGlobal;
  })();
  const idById = useMemo(() => {
    const m: Record<string, number> = {};
    steps.forEach((s, i) => (m[s.id] = i));
    return m;
  }, [steps]);

  useEffect(() => {
    // tipo REAL da lâmina, não a string fixa "layers". Enquanto ia "layers"
    // para tudo, qualquer relatório por tipo de lâmina era inútil neste motor
    // (que é o de 12 dos 18 funis). Só afeta eventos NOVOS.
    if (!preview) trackStep(funnel.slug, idx, step.id, tipoDaLamina(step));
    window.scrollTo({ top: 0 });
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => {
    if (n < 0 || n >= total || n === idx) return;
    history.current.push(idx);
    setIdx(n);
  };
  const navigate = (dest?: string) => {
    if (!dest || dest === "next") {
      // "próxima" pode ter destino próprio (`nextStep`), definido arrastando a
      // bolinha do rodapé no mapa de fluxo. Sem o campo, segue por posição.
      const padrao = step?.nextStep;
      if (padrao && idById[padrao] != null) return go(idById[padrao]);
      return go(idx + 1);
    }
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
  const hero = (step.layers || []).find((l) => HERO_TIPADO.has(l.type));
  if (hero) {
    const palette = getPalette(funnel.paletteId);
    // SLIDER hero: layout dedicado (foto full-bleed no rodapé + gradiente, botão acima).
    if (hero.type === "slider") {
      return <SliderHero step={hero.content} ctx={ctx} theme={design.themeColor || palette.primary || "#ea580c"} bgColor={pageBg} />;
    }
    const stepCtx: StepCtx = {
      ...ctx,
      // `preview` da prop (era `false` fixo): no construtor o hero de roleta
      // gravava resposta REAL em quiz_answers a cada teste interno.
      name, setName, advance: () => navigate("next"),
      funnelSlug: funnel.slug, palette, preview,
      estado: geo?.estado, cidade: geo?.cidade,
    };

    // Só a roleta tem fundo escuro próprio; os demais herdam o design do funil.
    const escuro = hero.type === "roulette";
    const fundo = (hero.content.background as string) ||
      (escuro ? "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)" : pageBg);

    // O `content` destes blocos É o Step tipado — mesmo contrato que a roleta
    // já usava. Por isso reaproveitamos os StepView em vez de reimplementar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conteudo = hero.content as any;

    // Enquadramento e aparência vinham sendo DESCARTADOS aqui. O motor tipado
    // trata os dois desde sempre (QuizRunner:120-134); este ramo nasceu depois e
    // não herdou o tratamento, então a MESMA lâmina ficava certa num motor e
    // errada no outro.
    //
    // Fundo de imagem sem enquadramento: o CSS assume `auto` + `repeat` e a arte
    // vira mosaico — a foto 9:16 do prêmio da Sônia se repetia na tela.
    // `appearance`: sem as variáveis, o título perde a cor configurada e some
    // contra um fundo escuro.
    const fundoEhImagem = /\burl\(/i.test(fundo);
    const ap = conteudo.appearance as
      | { align?: string; titleSize?: number; titleWeight?: number | string; titleColor?: string }
      | undefined;
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col overflow-x-hidden"
        style={{
          ...paletteVars(palette),
          ...(escuro ? { ["--q-bg"]: "#160a22", ["--q-text"]: "#ffffff", ["--q-text-muted"]: "rgba(255,255,255,.72)" } : {}),
          ...(ap?.align ? { ["--q-title-align"]: ap.align } : {}),
          ...(ap?.titleSize ? { ["--q-title-size"]: `${ap.titleSize}px` } : {}),
          ...(ap?.titleWeight ? { ["--q-title-weight"]: String(ap.titleWeight) } : {}),
          ...(ap?.titleColor ? { ["--q-title-color"]: ap.titleColor } : {}),
          background: fundo,
          ...(fundoEhImagem
            ? {
                backgroundSize: (conteudo.bgSize as string) ?? "cover",
                backgroundPosition: (conteudo.bgPosition as string) ?? "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
          color: escuro ? "#ffffff" : (design.contentColor || "#000"),
        } as React.CSSProperties}
      >
        <main className="flex flex-1 flex-col">
          {hero.type === "roulette" ? <RouletteStepView step={conteudo as RouletteStep} ctx={stepCtx} />
            : hero.type === "scratch" ? <ScratchGrid step={conteudo} ctx={stepCtx} />
              : hero.type === "measure" ? <MeasureStepView step={conteudo} ctx={stepCtx} />
                : hero.type === "gauge" ? <GaugeStepView step={conteudo} ctx={stepCtx} />
                  : hero.type === "vsl" ? <VslStepView step={conteudo} ctx={stepCtx} />
                    : hero.type === "confirm" ? <ConfirmStepView step={conteudo} ctx={stepCtx} />
                      : null}
        </main>
        <ScrollHint dep={idx} enabled={scrollHintLigado} />
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
        // Na PRIMEIRA lâmina esta imagem é o elemento LCP — medido no cdb-01,
        // onde ela sozinha responde por ~4 s do carregamento. `fetchPriority
        // high` tira ela da fila comum; `eager` impede que algum heurístico do
        // navegador a trate como abaixo da dobra. Nas demais lâminas o padrão
        // continua, porque ali ela não bloqueia nada.
        <img
          src={bgImg}
          alt=""
          fetchPriority={idx === 0 ? "high" : "auto"}
          loading={idx === 0 ? "eager" : "lazy"}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: bgOpacity, objectFit: bgFit, objectPosition: bgPos }}
        />
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
            {hdr.show_progress ? (() => {
              /* A barra conta só as lâminas que TÊM barra, não o funil inteiro.
                 Antes era (idx+1)/total sobre todas as lâminas: num funil de 14
                 a primeira pergunta já nascia em 28% e a última fechava em 64% —
                 a barra nunca enchia e o visitante não sabia quanto faltava.
                 O conjunto sai do próprio `show_progress` (global + override),
                 então quem liga/desliga a barra no construtor já define o
                 denominador. Sem campo novo, sem migration. */
              const comBarra = steps
                .map((s, i) => [i, ((s.headerOverride || {}) as Record<string, boolean | undefined>).show_progress] as const)
                .filter(([, v]) => (v !== undefined ? v : g.show_progress))
                .map(([i]) => i);
              const pos = comBarra.indexOf(idx);
              const quantas = comBarra.length;
              const pct = quantas && pos >= 0 ? ((pos + 1) / quantas) * 100 : ((idx + 1) / total) * 100;
              return (
                <div className="w-full">
                  {/* Pílula, não texto solto: é a forma da referência
                      (StepQuiz.tsx:60) — caixa alta, tracking largo, fundo e
                      borda claros derivados do tema. */}
                  {quantas > 1 && pos >= 0 ? (
                    <p className="mb-2 text-center">
                      <span style={estiloPilulaPergunta(design.themeColor || "#ea580c")}>
                        Pergunta {pos + 1} de {quantas}
                      </span>
                    </p>
                  ) : null}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: design.themeColor || "#ea580c" }} />
                  </div>
                </div>
              );
            })() : null}
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
            // `false` só na primeira pintura: é o que tira o opacity:0 do HTML
            // servido. Da 2ª lâmina em diante o fade/slide de entrada continua.
            initial={primeiroPaint.current ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
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
              /* LÂMINA DE PERGUNTA no formato da referência.
                 Aqui a TELA inteira troca, não só o bloco de opções: voltar em
                 chevron, pílula de posição, título responsivo com destaque,
                 subtítulo e o respiro de 320 ms ao marcar. Empilhar blocos não
                 chega nesse arranjo — foi o que eu tentei antes e não bateu.
                 Só entra quando o bloco pede `preset: "resina"`; sem isso, cai
                 no caminho de sempre e nenhum funil em produção muda. */
              const opt = ls.find((l) => l.type === "options");
              if (opt?.design?.preset === "resina" && !opt.content?.multiple) {
                const idsComBarra = steps
                  .map((s, i) => [i, ((s.headerOverride || {}) as Record<string, boolean | undefined>).show_progress] as const)
                  .filter(([, v]) => (v !== undefined ? v : ((funnel.settings as { header?: Record<string, boolean> })?.header || {}).show_progress))
                  .map(([i]) => i);
                const titulo = semHtml(opt.content?.introduction || question);
                return (
                  <ResinaQuiz
                    cor={design.themeColor || "#0284c7"}
                    pergunta={titulo}
                    /* destaque = a palavra mais longa do título. Mesma regra do
                       script que monta o funil, para os dois concordarem. */
                    destaque={titulo.split(/\s+/).filter((p) => p.length > 4).sort((a, b) => b.length - a.length)[0]}
                    opcoes={(opt.content?.options || []).map((o) => ({
                      id: o.id,
                      label: semHtml(o.label),
                      // `?? undefined`: no banco esses campos vêm `null`, e a
                      // prop é opcional — `null` não satisfaz `string | undefined`.
                      emoji: (o.image?.type === "emoji" ? o.image?.src : o.emoji) ?? undefined,
                      imagem: (o.image?.type === "image" ? o.image?.src : undefined) ?? undefined,
                    }))}
                    posicao={idsComBarra.indexOf(idx) + 1 || undefined}
                    total={idsComBarra.length || undefined}
                    onVoltar={history.current.length ? back : undefined}
                    onEscolha={(o) => {
                      const orig = (opt.content?.options || []).find((x) => x.id === o.id);
                      ctx.trackAnswer(step.id, titulo, o.label);
                      ctx.navigate(orig?.destination || "next");
                    }}
                  />
                );
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
                  // `out.length` e não `k`: o índice conta o que já foi
                  // EMPILHADO na tela — senão um grupo de imagens (que vira um
                  // item só) deixa buracos na cascata de entrada.
                  out.push(<Block key={l.id} layer={l} ctx={ctx} question={question} indice={out.length} />);
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

      {/* setinha pulsante "role pra baixo" — liga/desliga em Design → Header.
          Chave ausente = ligada (é o estado de todos os funis publicados). */}
      <ScrollHint dep={idx} enabled={scrollHintLigado} />
    </div>
    </LayersEditContext.Provider>
  );
}
