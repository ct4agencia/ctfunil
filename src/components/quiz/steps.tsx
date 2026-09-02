"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { prefereMenosMovimento } from "@/lib/quiz/motion";
import { comRastreio } from "@/lib/quiz/rastreio";
import type {
  RouletteStep, RouletteStyle, ScratchStep, MeasureStep, SliderStep, Palette, HeroStep, NameStep, ConfirmStep, QuestionStep, LoadingStep, GaugeStep, ResultStep,
  OfferStep, CaptureStep, PostStep, BridgeStep, VslStep, QuizOption,
} from "@/lib/quiz/types";
import { CtaButton, OptionButton, StepShell, StickyCta, RichText, RICH_RE, useEdit, DedoArrasta } from "./ui";
import { submitLead, submitFunnelLead, fireMetaEvent } from "@/lib/tracking";
import { attachVslWatch } from "@/lib/quiz/vsl-watch";
import { trackAnswer } from "@/lib/quiz/track";
import { interpEstado } from "@/lib/quiz/estado";
import { playSpinTicks, playWin, playUrl } from "@/lib/quiz/sound";
import { ajustarRotulo } from "@/lib/quiz/roleta-texto";
import dynamic from "next/dynamic";
// Motor alternativo da roleta. `dynamic` de propósito: funil que usa a roleta
// clássica (todos os de hoje) não baixa uma linha da simulação.
const RoletaInterativa = dynamic(() => import("./RoletaInterativa"), { ssr: false });
// mesmo tratamento: canvas + AudioContext só existem no navegador, e carregar
// sob demanda mantém o bundle de `/q/[slug]` fora do peso de dois motores
const RoletaFisicaV3 = dynamic(() => import("./RoletaFisicaV3"), { ssr: false });
// Mesma tela usada pelo motor layers; mora fora daqui para os dois a
// compartilharem sem que o layers importe este arquivo inteiro.
const Diagnostico = dynamic(() => import("./Diagnostico"), { ssr: false });
// Idem: barras rotuladas + micro-perguntas, divididas com o motor layers.
const Checklist = dynamic(() => import("./Checklist"), { ssr: false });

/** Contexto passado a cada lâmina pelo QuizRunner. */
export interface StepCtx {
  name: string;
  setName: (n: string) => void;
  advance: () => void;
  funnelSlug: string;
  vslId?: string;
  palette: Palette;
  /** geolocalização do lead (Vercel) — {estado}/{cidade} no interp */
  estado?: string;
  cidade?: string;
  /** override de {estado}/{cidade} pela resposta do lead (seguro no 4G) */
  setVar?: (key: "estado" | "cidade", value: string) => void;
  /** preview do construtor: desliga tracking, leads/webhook e sons */
  preview?: boolean;
}

/** Grava resposta do quiz — no-op no preview do construtor. */
function logAnswer(ctx: StepCtx, stepId: string, question: string, ans: string) {
  if (!ctx.preview) trackAnswer(ctx.funnelSlug, stepId, question, ans);
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
type InterpVars = { name?: string; estado?: string; cidade?: string };
export function interp(s: string | undefined, vars: string | InterpVars): string {
  if (!s) return "";
  const v: InterpVars = typeof vars === "string" ? { name: vars } : (vars ?? {});
  const cap = (x?: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : "");
  const out = s.replace(/\{nome\}/g, cap(v.name) || "você");
  // {estado} com concordância de preposição (da Bahia / do Paraná / de São Paulo)
  return interpEstado(out, v.estado).replace(/\{cidade\}/g, v.cidade || "sua cidade");
}

function Title({ children }: { children: React.ReactNode }) {
  const { editing, onEdit } = useEdit();
  return (
    <h2 className={`font-[var(--q-display)] leading-tight tracking-tight ${editing ? "cursor-pointer rounded-md ring-2 ring-transparent transition hover:bg-blue-50/40 hover:ring-blue-400/60" : ""}`}
      onClick={editing ? (e) => { e.stopPropagation(); onEdit?.("title"); } : undefined}
      title={editing ? "Clique para editar no painel" : undefined}
      style={{
        fontSize: "var(--q-title-size, 26px)",
        fontWeight: "var(--q-title-weight, 700)" as React.CSSProperties["fontWeight"],
        color: "var(--q-title-color, var(--q-text))",
        textAlign: "var(--q-title-align)" as React.CSSProperties["textAlign"],
      }}>
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
  text.split(RICH_RE).filter(Boolean).forEach((seg) => {
    if (seg.startsWith("==") && seg.endsWith("==")) tokens.push({ t: seg.slice(2, -2), kind: "pill" });
    else if (seg.startsWith("**") && seg.endsWith("**")) tokens.push({ t: seg.slice(2, -2), kind: "bold" });
    else if (seg.startsWith("*") && seg.endsWith("*")) tokens.push({ t: seg.slice(1, -1), kind: "bold" });
    else seg.split(" ").filter(Boolean).forEach((w) => tokens.push({ t: w, kind: "word" }));
  });
  return (
    <h2 className="font-[var(--q-display)] leading-tight tracking-tight"
      style={{
        fontSize: "var(--q-title-size, 26px)",
        fontWeight: "var(--q-title-weight, 700)" as React.CSSProperties["fontWeight"],
        color: "var(--q-title-color, var(--q-text))",
        textAlign: "var(--q-title-align)" as React.CSSProperties["textAlign"],
      }}>
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

/** Texto escuro ou branco conforme a luminância da cor de fundo da fatia. */
function contrastText(hex?: string): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "#3a2410";
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#3a2410" : "#ffffff";
}

// ── Roleta ────────────────────────────────────────────────────────
export function RouletteStepView({ step, ctx }: { step: RouletteStep; ctx: StepCtx }) {
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const N = step.segments.length;
  const seg = 360 / N;
  // rotação inicial: mostra a fatia `initialIndex` sob o ponteiro antes de girar
  const [rotation, setRotation] = useState(() => -((step.initialIndex ?? 0) * seg));
  const [instant, setInstant] = useState(false); // restaura prêmio travado sem animar o giro
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
  const ch = wheelChrome(step.style, ctx.palette);
  const pegCount = ch.peg === "bulb" ? 16 : 24;
  const pegR = ch.peg === "bulb" ? 95 : 93;
  const pegs = Array.from({ length: pegCount }, (_, k) => polar(pegR, (k * 360) / pegCount));

  // Motor "interativa": a roda é simulada quadro a quadro e avisa quando parou.
  // A clássica segue sendo o padrão — `engine` ausente é o caminho de sempre.
  const interativa = step.engine === "interativa";
  /* Motor v3: o pino vira um morro de energia e o construtor decide se a roda
     tem força para vencê-lo. Compartilha com a `interativa` tudo o que está
     FORA da roda — sorteio, trava de 24h, confete, popup — e só troca a
     simulação. Por isso as duas entram juntas nas guardas de som e de fim. */
  const fisica3 = step.engine === "fisica3";
  const simulada = interativa || fisica3;
  const [vencedor, setVencedor] = useState(step.winningIndex);

  // Popup de prêmio: AUSENTE = desligado, para as roletas que já rodam não
  // ganharem uma tela nova sem ninguém ter pedido.
  const popupOn = !!step.popupEnabled;
  // mesma guarda do bloco `check`: quem pediu menos movimento vê o emoji parado
  const reduzMovimento = prefereMenosMovimento();
  const premio = step.segments[vencedor];

  /** Vitória: som, confete e liberação do botão. Um só lugar para os dois motores. */
  const celebrar = () => {
    setDone(true); setSpinning(false);
    if (step.sound?.enabled) {
      if (step.sound.winUrl) playUrl(step.sound.winUrl);
      else playWin();
    }
    import("canvas-confetti").then((m) => m.default({ particleCount: 170, spread: 95, origin: { y: 0.4 } })).catch(() => {});
  };

  const spin = () => {
    if (spinning || done) return;
    setSpinning(true);

    const win = step.mode === "random" ? Math.floor(Math.random() * N) : step.winningIndex;
    setVencedor(win);
    // trava 24h: registra o prêmio no aparelho (fixa no reload + bloqueia novo giro).
    // NUNCA no preview: ali a trava sobrevive à remontagem do componente, então
    // o "Reiniciar" do construtor remontava a lâmina e a roleta voltava já
    // ganha. Mesma guarda que a raspadinha usa no `oncePerDevice`.
    if (step.lockReplay && !ctx.preview && typeof window !== "undefined") {
      try { localStorage.setItem(`cdb-rl-${step.id}`, JSON.stringify({ w: win, ts: Date.now() })); } catch { /* noop */ }
    }

    // Na interativa o som dos pinos nasce da própria simulação, então NÃO se
    // agenda `playSpinTicks` — seriam duas trilhas concorrentes, uma por tempo
    // e outra pelo movimento. O som customizado (tickUrl) vale nos dois motores.
    if (step.sound?.enabled) {
      if (step.sound.tickUrl) playUrl(step.sound.tickUrl);
      else if (!simulada) playSpinTicks(4200);
    }
    if (simulada) return; // o fim chega pelo callback do componente

    setRotation(360 * 6 - win * seg); // win=0 → 6 voltas exatas, labels terminam retas
    setTimeout(celebrar, 4300);
  };

  // após vencer, avança sozinho (sem 2º clique) quando autoAdvance.
  // Com o popup ligado o avanço automático NÃO roda: o popup existe para ser
  // lido e clicado, e um timer o arrancaria da tela no meio da leitura.
  useEffect(() => {
    if (!done || !step.autoAdvance || popupOn) return;
    const t = setTimeout(() => ctx.advance(), step.autoAdvanceMs ?? 2600);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // trava 24h: se já girou e ganhou nas últimas 24h, restaura o prêmio FIXADO
  // (sem animar) e bloqueia novo giro. localStorage = por aparelho/navegador.
  useEffect(() => {
    if (!step.lockReplay || ctx.preview || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`cdb-rl-${step.id}`);
      if (!raw) return;
      const { w, ts } = JSON.parse(raw);
      if (typeof w === "number" && Date.now() - Number(ts) < 24 * 3600 * 1000) {
        setTimeout(() => {
          setInstant(true);
          setRotation(360 * 6 - w * seg);
          setDone(true);
        }, 0);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.subtitle, ctx)} /></p> : null}

        {/* MOTOR INTERATIVO — só quando escolhido no construtor. A roda é
            simulada quadro a quadro; o som dos pinos nasce do próprio giro e o
            fim avisa por callback. O sorteio, a trava de 24 h e o confete
            continuam aqui fora, iguais para os dois motores. */}
        {fisica3 ? (
          <div className="mt-7">
            <RoletaFisicaV3
              segments={step.segments}
              vencedor={vencedor}
              girando={spinning}
              /* o índice que chega é o REALMENTE entregue: no modo "não passa"
                 a roda para no prêmio anterior, e celebrar o alvo seria mentir
                 sobre o que está debaixo do ponteiro */
              onFim={(real) => { setVencedor(real); celebrar(); }}
              som={!!step.sound?.enabled && !step.sound?.tickUrl}
              centerImage={step.centerImage}
              // o corpo do texto vem do painel, como nos outros motores
              labelSize={step.labelSize}
              // "Fatia parada": mesma conta do motor interativa
              anguloInicial={-((step.initialIndex ?? 0) * seg)}
              quasePassa={step.quasePassa !== false}
              hesitacao={step.hesitacao ?? 0}
            />
          </div>
        ) : interativa ? (
          <div className="mt-7">
            <RoletaInterativa
              segments={step.segments}
              labelSize={step.labelSize}
              vencedor={vencedor}
              girando={spinning}
              onFim={celebrar}
              som={!!step.sound?.enabled && !step.sound?.tickUrl}
              preset={step.preset}
              intensidade={step.intensidade ?? 0}
              // só o modo Personalizado grava valores crus; nos demais é undefined
              params={step.preset === "Personalizado" ? step.paramsRoleta : undefined}
              chrome={{ rim: ch.rim, rimInner: ch.rimInner, pegColor: ch.pegColor, pointer: ch.pointer, dark: ch.dark }}
              centerImage={step.centerImage}
              hubR={ch.hubR}
              hub={ch.hub}
              hubInner={ch.hubInner}
              anguloInicial={-((step.initialIndex ?? 0) * seg)}
            />
          </div>
        ) : (
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
            <motion.div className="h-full w-full" initial={false} animate={{ rotate: rotation }}
              transition={{ duration: instant ? 0 : 4.2, ease: [0.16, 1, 0.3, 1] }}>
              <svg viewBox="0 0 200 200" className="h-full w-full" style={{ filter: "drop-shadow(0 10px 22px rgba(0,0,0,.22))" }}>
                <circle cx={c} cy={c} r={97} fill={ch.rim} />
                <circle cx={c} cy={c} r={88.5} fill="none" stroke={ch.rimInner} strokeWidth={3} />
                {pegs.map(([x, y], k) => (
                  <circle key={`p${k}`} cx={x} cy={y} r={ch.peg === "bulb" ? 3.2 : ch.peg === "peg" ? 2.6 : 2.1}
                    fill={ch.pegColor} style={ch.peg === "bulb" ? { filter: `drop-shadow(0 0 3px ${ch.pegColor})` } : undefined} />
                ))}
                {step.segments.map((s, i) => (
                  <path key={i} d={slicePath(i)} fill={s.color}
                    stroke={ch.dark ? "rgba(0,0,0,.28)" : "#fffaf2"} strokeWidth="2" />
                ))}
                {step.segments.map((s, i) => {
                  // raio 62 e não 56: mais para fora a fatia é mais larga, e o
                  // texto ganha espaço sem precisar encolher
                  const [tx, ty] = polar(62, i * seg);
                  // tamanho DESTA fatia > tamanho da lâmina > 11. Definido à
                  // mão, o valor é respeitado; automático, encolhe até caber.
                  const fixo = s.labelSize != null;
                  const { linhas: ls, fontSize: fs } = ajustarRotulo(
                    s.label, N, 62, s.labelSize ?? step.labelSize ?? 11, fixo,
                  );
                  const fill = contrastText(s.color);
                  // pilha de N linhas centralizada: sobe metade da altura total
                  const dy0 = ls.length === 1 ? "0" : `${-((ls.length - 1) * 0.55)}em`;
                  return (
                    <text key={`t${i}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${i * seg} ${tx} ${ty})`}
                      fontSize={fs} fontWeight={800} fill={fill} style={{ letterSpacing: ".2px" }}>
                      {ls.length === 1 ? ls[0] : ls.map((l, j) => <tspan key={j} x={tx} dy={j === 0 ? dy0 : "1.1em"}>{l}</tspan>)}
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
          )}
          {ch.stand === "trapezoid" ? (
            <div className="mx-auto -mt-2" style={{ width: 96, height: 48, background: "linear-gradient(#333,#0a0a0a)", clipPath: "polygon(26% 0,74% 0,100% 100%,0 100%)" }} />
          ) : ch.stand === "podium" ? (
            <div className="mx-auto -mt-1 h-3.5 w-44 rounded-[50%] bg-white/85" style={{ boxShadow: "0 8px 18px rgba(0,0,0,.45)" }} />
          ) : null}

        {/* Card de vitória INLINE. Com o popup ligado ele sai de cena: os dois
            carregam a mesma copy (winTitle/winBody), e exibir ambos faria o
            visitante ler o prêmio duplicado na mesma tela. */}
        <AnimatePresence>
          {done && !popupOn ? (
            <motion.div key="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl bg-white p-5 text-center shadow-xl">
              <p className="text-lg font-bold text-[var(--q-primary-dark)]"><RichText text={interp(step.winTitle ?? "🎉 Você ganhou!", ctx)} /></p>
              {step.winBody ? <p className="mt-1 text-sm text-neutral-600"><RichText text={interp(step.winBody, ctx)} /></p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Botão LOGO ABAIXO da roleta (ctaBelow). Some na vitória quando há
            autoAdvance — ou quando o popup está ligado, porque ele traz o
            próprio botão com a MESMA copy (winCta) e a tela ficava com dois
            "PEGAR MEU PRÊMIO", um atrás do fundo escuro. */}
        {step.ctaBelow ? (
          <div className="mx-auto mt-6 w-full max-w-xs">
            {!done ? (
              <CtaButton onClick={spin} disabled={spinning} pulse={!spinning} cor={step.ctaCor}>{spinning ? "Girando..." : step.cta}</CtaButton>
            ) : !step.autoAdvance && !popupOn ? (
              <CtaButton onClick={ctx.advance}>{step.winCta ?? "Continuar →"}</CtaButton>
            ) : null}
          </div>
        ) : null}
      </StepShell>

      {/* Rodapé sticky (padrão, quando não é ctaBelow). Mesma regra: com o popup
          ligado, quem leva adiante é o botão dele. */}
      {!step.ctaBelow ? (
        <StickyCta bare>
          {done ? (
            popupOn ? null : <CtaButton onClick={ctx.advance}>{step.winCta ?? "Continuar →"}</CtaButton>
          ) : (
            <CtaButton onClick={spin} disabled={spinning} pulse={!spinning} cor={step.ctaCor}>{spinning ? "Girando..." : step.cta}</CtaButton>
          )}
        </StickyCta>
      ) : null}

      {/* POPUP DE PRÊMIO — central e com botão, ao contrário do da raspadinha
          (faixa no topo, informativa). Lá a grade precisa continuar à vista; aqui
          o giro já acabou e o clique é o próximo passo do funil.
          O fundo escuro fecha o resto da tela para o prêmio ser a única coisa
          legível no momento em que o visitante decide continuar. */}
      <AnimatePresence>
        {popupOn && done ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[330px] rounded-3xl px-6 py-7 text-center shadow-2xl"
              style={{ background: step.popupBg || "var(--q-primary)", color: step.popupText || "#ffffff" }}
              initial={{ scale: 0.82, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              {/* EMOJI com o motion do bloco `check`: entra girando em mola,
                  duas ondas saindo de trás e um balanço contínuo. É o momento
                  mais alto do funil — o emoji parado deixava a cena morta.
                  As ondas são brancas translúcidas, não coloridas como no
                  bloco: aqui o fundo do popup já é a cor do prêmio, e um disco
                  da mesma cor sumiria dentro dele. */}
              {premio?.emoji !== "" ? (
                <motion.div
                  className="relative mx-auto grid h-14 w-14 place-items-center"
                  initial={reduzMovimento ? false : { scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
                >
                  {!reduzMovimento && [0, 0.6].map((atraso, i) => (
                    <motion.span
                      key={i} aria-hidden className="absolute inset-0 rounded-full"
                      style={{ background: "rgba(255,255,255,.55)" }}
                      animate={{ scale: [1, i ? 1.6 : 1.4, 1], opacity: [i ? 0.3 : 0.45, 0, i ? 0.3 : 0.45] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: atraso }}
                    />
                  ))}
                  <motion.span
                    className="relative text-4xl leading-none"
                    animate={reduzMovimento ? {} : { scale: [1, 1.12, 1], rotateZ: [0, -5, 5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
                  >{premio?.emoji || "🎉"}</motion.span>
                </motion.div>
              ) : null}
              {/* MIOLO na ordem gravada. Emoji e botão são a moldura e ficam
                  fixos; a arte e a copy trocam de lugar conforme o arraste do
                  painel. Sem `popupOrdem`, a arte vem antes — que é como o
                  popup nasceu. */}
              {(step.popupOrdem?.length ? step.popupOrdem : ["imagem", "texto"]).map((peca) =>
                peca === "imagem" ? (
                  step.popupImagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key="imagem" src={step.popupImagem} alt="" loading="lazy" decoding="async"
                      className="mx-auto mt-4 h-auto w-full max-w-[210px] rounded-xl object-contain"
                      style={{ filter: "drop-shadow(0 10px 22px rgba(0,0,0,.28))" }}
                    />
                  ) : null
                ) : (
                  <div key="texto">
                    <p className="mt-3 text-xl font-black uppercase leading-tight tracking-tight">
                      <RichText text={interp(premio?.popupTitle || step.winTitle || "Parabéns!", ctx)} />
                    </p>
                    <p className="mt-2 text-sm font-medium leading-snug opacity-95">
                      <RichText text={interp(premio?.popupBody || step.winBody || "Você ganhou...", ctx)} />
                    </p>
                  </div>
                )
              )}
              <button
                onClick={ctx.advance}
                className="mt-5 w-full rounded-2xl px-5 py-3.5 text-[15px] font-black uppercase leading-none tracking-tight shadow-lg transition active:scale-[.97]"
                style={{ background: step.popupBtnBg || "#ffffff", color: step.popupBg || "var(--q-primary)" }}
              >
                {step.winCta ?? "Pegar meu prêmio"}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.subtitle, ctx)} /></p> : null}
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
            <p className="text-lg font-bold text-[var(--q-primary)]"><RichText text={interp(step.winTitle ?? "🎉 Você ganhou!", ctx)} /></p>
            {step.winBody ? <p className="mt-1 text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.winBody, ctx)} /></p> : null}
          </motion.div>
        ) : null}
      </StepShell>
      <StickyCta bare>
        {revealed ? (
          <CtaButton onClick={ctx.advance}>{step.winCta}</CtaButton>
        ) : (
          <p className="text-center text-sm font-medium text-[var(--q-text-muted)]">👆 Raspe o card para revelar seu prêmio</p>
        )}
      </StickyCta>
    </>
  );
}

// ── "Pedida": régua/balança horizontal arrastável ─────────────────
/** Espaçamento entre marcas, em px. 14 é o menor valor que ainda dá pra mirar com o dedo. */
const REGUA_PX = 14;
/** Teto de marcas desenhadas. Acima disso a fita vira milhares de <div> e engasga
 *  no celular — então o passo VISUAL aumenta (o valor continua no passo pedido). */
const REGUA_MAX_MARCAS = 400;

export function MeasureStepView({ step, ctx }: { step: MeasureStep; ctx: StepCtx }) {
  const titulo = step.title ?? step.question ?? "";
  const ajuda = step.subtitle ?? step.help;
  const min = step.min ?? 0;
  const max = Math.max(min + 1, step.max ?? 100);
  const passo = Math.max(0.01, step.step ?? 1);
  const inicial = step.value ?? step.defaultValue ?? Math.round((min + max) / 2);
  const majorEvery = Math.max(1, step.majorEvery ?? 5);
  const units = step.units ?? [];

  // Se a régua ficar densa demais, desenha 1 marca a cada `saltoVisual` passos.
  const saltoVisual = Math.max(1, Math.ceil((max - min) / passo / REGUA_MAX_MARCAS));
  const marcas = useMemo(() => {
    const out: number[] = [];
    for (let x = min; x <= max + 1e-9; x += passo * saltoVisual) out.push(Math.round(x * 100) / 100);
    return out;
  }, [min, max, passo, saltoVisual]);

  const fita = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(() => {
    const i = Math.round((inicial - min) / (passo * saltoVisual));
    return Math.max(0, Math.min(marcas.length - 1, i));
  });
  const [unit, setUnit] = useState(0);
  const ultimoIdx = useRef(idx);

  /**
   * Largura do espaçador que põe a primeira e a última marca no centro.
   * Medida em PX, não em `calc(50%)`: com o flex em `max-content` uma
   * porcentagem dependeria da largura que ela mesma define (circular), e com o
   * flex em largura automática o estouro dos itens não entra no `scrollWidth` —
   * a fita ficava travada sem rolagem nenhuma.
   * O ResizeObserver já dispara uma vez ao observar, então não medimos à mão
   * (chamada síncrona dentro do efeito dispararia render em cascata).
   */
  const [pad, setPad] = useState(0);
  useEffect(() => {
    const el = fita.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      setPad(Math.max(0, el.clientWidth / 2 - REGUA_PX / 2));
      // Mudar a largura muda o espaçador e desloca a fita: sem reposicionar, a
      // régua pulava para outro número ao girar o celular ou abrir o teclado.
      requestAnimationFrame(() => { el.scrollLeft = ultimoIdx.current * REGUA_PX; });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // posiciona a fita no valor inicial assim que o espaçador existe (uma vez só)
  const posicionado = useRef(false);
  useEffect(() => {
    const el = fita.current;
    if (!el || pad <= 0 || posicionado.current) return;
    posicionado.current = true;
    el.scrollLeft = ultimoIdx.current * REGUA_PX;
  }, [pad]);

  const aoRolar = () => {
    const el = fita.current; if (!el) return;
    const i = Math.max(0, Math.min(marcas.length - 1, Math.round(el.scrollLeft / REGUA_PX)));
    if (i === ultimoIdx.current) return;
    ultimoIdx.current = i;
    setIdx(i);
    // vibração curta a cada marca — é o que dá a sensação de "catraca" da balança
    if (step.haptic !== false) navigator.vibrate?.(6);
  };

  /**
   * Arraste com MOUSE. O `overflow-x` nativo só responde a toque ou a scroll
   * horizontal (shift+roda) — de mouse, arrastar não fazia nada. Restrito a
   * `pointerType === "mouse"`: no toque o navegador já rola sozinho, e mexer no
   * `scrollLeft` junto faria a fita andar em dobro.
   */
  const puxada = useRef<{ x: number; s: number } | null>(null);
  const [tocou, setTocou] = useState(false);
  // O dedo é uma dica de "arraste aqui" — tem que voltar em cada lâmina. Sem
  // isto, um clique no preview do construtor o matava até remontar o componente,
  // e parecia que o emoji simplesmente não existia ali.
  //
  // Comparação durante o RENDER (padrão do React para reajustar estado quando
  // uma prop muda), não `useEffect`: com effect o React renderiza uma vez com o
  // valor velho e só então corrige, em cascata.
  const [laminaDoDedo, setLaminaDoDedo] = useState(step.id);
  if (laminaDoDedo !== step.id) { setLaminaDoDedo(step.id); setTocou(false); }
  const pegarFita = (e: React.PointerEvent) => {
    const el = fita.current;
    if (!el || e.pointerType !== "mouse") { setTocou(true); return; }
    puxada.current = { x: e.clientX, s: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    setTocou(true);
  };
  const moverFita = (e: React.PointerEvent) => {
    const a = puxada.current, el = fita.current;
    if (!a || !el) return;
    el.scrollLeft = a.s - (e.clientX - a.x);
  };
  const soltarFita = () => { puxada.current = null; };

  const valor = marcas[idx] ?? inicial;
  const sufixo = units[unit] ?? step.suffix ?? "";
  const go = () => {
    logAnswer(ctx, step.id, titulo, `${valor} ${sufixo}`.trim());
    ctx.advance();
  };

  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(titulo, ctx)}</Title></div>
        {ajuda ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(ajuda, ctx)} /></p> : null}
        {units.length > 1 ? (
          <div className="mx-auto mt-5 inline-flex rounded-full bg-[var(--q-bg-soft)] p-1">
            {units.map((u, i) => (
              <button key={i} onClick={() => setUnit(i)} className="rounded-full px-5 py-1.5 text-sm font-bold transition"
                style={{ background: unit === i ? "var(--q-primary)" : "transparent", color: unit === i ? "#fff" : "var(--q-text-muted)" }}>{u}</button>
            ))}
          </div>
        ) : null}

        {/* leitura grande */}
        <div className="mt-7 flex items-end justify-center gap-2">
          <span className="text-6xl font-black leading-none text-[var(--q-text)] tabular-nums">{valor}</span>
          {sufixo ? <span className="pb-2 text-xl font-semibold text-[var(--q-text-muted)]">{sufixo.toLowerCase()}</span> : null}
        </div>

        {/* fita */}
        <div className="relative mt-6 select-none">
          {/* Affordance de arraste, no lugar dos botões ‹ ›: o degradê apaga a
              fita nas bordas (sinal de "tem mais coisa pros lados") e as setas
              são DECORATIVAS — `pointer-events-none` para não roubarem o toque
              de quem está arrastando a régua. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-10 bg-gradient-to-r from-[var(--q-bg,#fff)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-10 bg-gradient-to-l from-[var(--q-bg,#fff)] to-transparent" />
          <span className="pointer-events-none absolute left-1 top-1/2 z-[3] -translate-y-1/2 text-lg text-[var(--q-text-muted)] opacity-40">‹</span>
          <span className="pointer-events-none absolute right-1 top-1/2 z-[3] -translate-y-1/2 text-lg text-[var(--q-text-muted)] opacity-40">›</span>

          {/* marcador central: seta no topo + haste da altura da marca alta */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-[2] h-0 w-0 -translate-x-1/2"
            style={{ borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "9px solid var(--q-primary)" }} />
          <div className="pointer-events-none absolute left-1/2 top-[9px] z-[2] h-[34px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ background: "var(--q-primary)" }} />

          {/* altura fixa: marca alta (34) + respiro (4) + número (16) = 54 */}
          <div ref={fita} onScroll={aoRolar}
            onPointerDown={pegarFita} onPointerMove={moverFita}
            onPointerUp={soltarFita} onPointerCancel={soltarFita}
            className="qf-regua overflow-x-auto overflow-y-hidden"
            style={{ height: 63, paddingTop: 9, cursor: "grab", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {/* `w-max` faz o scrollWidth medir a fita inteira; os espaçadores em
                px (meia tela menos meia marca) fazem scrollLeft = i * REGUA_PX. */}
            <div className="flex w-max items-start">
              <div className="shrink-0" style={{ width: pad }} />
              {marcas.map((m, i) => {
                const alta = i % majorEvery === 0;
                return (
                  <div key={i} className="shrink-0" style={{ width: REGUA_PX, scrollSnapAlign: "center" }}>
                    <div className="mx-auto rounded-full"
                      style={{ width: alta ? 2 : 1, height: alta ? 34 : 20, background: "var(--q-text)", opacity: alta ? 0.55 : 0.22 }} />
                    {alta ? (
                      <div className="mt-1 text-center text-[11px] font-semibold leading-none tabular-nums text-[var(--q-text-muted)]">{m}</div>
                    ) : null}
                  </div>
                );
              })}
              <div className="shrink-0" style={{ width: pad }} />
            </div>
          </div>
          {/* dedo ABAIXO da fita: acima ele encostava no número grande */}
          <div className="relative h-9">
            <DedoArrasta visivel={!tocou} />
          </div>
          <style>{".qf-regua::-webkit-scrollbar{width:0;height:0;display:none}"}</style>
        </div>
      </StepShell>
      <StickyCta><CtaButton onClick={go}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Slider (0–10) ─────────────────────────────────────────────────
export function SliderStepView({ step, ctx }: { step: SliderStep; ctx: StepCtx }) {
  const min = step.min ?? 0, max = step.max ?? 10, st = step.step ?? 1;
  const [v, setV] = useState(step.defaultValue ?? Math.round((min + max) / 2));
  const [tocou, setTocou] = useState(false);
  // mesmo padrão do MeasureStepView: reajuste no render, sem effect
  const [laminaDoDedo, setLaminaDoDedo] = useState(step.id);
  if (laminaDoDedo !== step.id) { setLaminaDoDedo(step.id); setTocou(false); }
  const scale = max - min <= 12;
  const go = () => {
    logAnswer(ctx, step.id, step.question, `${v}${step.suffix ?? ""}`);
    ctx.advance();
  };
  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.question, ctx)}</Title></div>
        {step.help ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.help, ctx)} /></p> : null}
        <div className="mt-8">
          <div className="mb-2 text-center text-2xl font-black text-[var(--q-primary)]">{v}{step.suffix ?? ""}</div>
          <input type="range" min={min} max={max} step={st} value={v}
            onChange={(e) => { setV(Number(e.target.value)); setTocou(true); }}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: "var(--q-primary)", background: `linear-gradient(90deg, var(--q-primary) ${((v - min) / (max - min)) * 100}%, var(--q-bg-soft) ${((v - min) / (max - min)) * 100}%)` }} />
          {step.showScale ? (
            <div className="mt-2 flex justify-between px-0.5 text-xs font-semibold text-[var(--q-text-muted)]">
              {scale
                ? Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => <span key={n}>{n}</span>)
                : <><span>{min}</span><span>{Math.round((min + max) / 2)}</span><span>{max}</span></>}
            </div>
          ) : null}
          {/* mesma dica da régua — este slider não tinha nenhuma */}
          <div className="relative h-9">
            <DedoArrasta visivel={!tocou} />
          </div>
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
            src={step.image} alt="" className="mx-auto mb-5 max-h-72 w-auto rounded-2xl object-contain"
          />
        ) : null}
        <AnimatedTitle text={interp(step.title, ctx)} />
        {step.subtitle ? (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]">
            <RichText text={interp(step.subtitle, ctx)} />
          </p>
        ) : null}
        {step.gallery?.length ? (
          <div className="mt-4 overflow-hidden">
            <div className="q-marquee flex w-max gap-2.5" style={{ animationDuration: `${step.gallerySpeed ?? 20}s` }}>
              {[...step.gallery, ...step.gallery].map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={g} alt="" className="shrink-0 rounded-2xl object-cover"
                  style={{ width: step.gallerySize ?? 96, height: step.gallerySize ?? 96 }} />
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
  const go = () => { if (!ok) return; ctx.setName(v.trim()); if (!ctx.preview) fireMetaEvent("Lead", { content_name: "name_capture" }); ctx.advance(); };
  return (
    <>
      <StepShell center>
        {step.emoji ? <div className="mb-3 text-center text-4xl">{step.emoji}</div> : null}
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.subtitle, ctx)} /></p> : null}
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

/**
 * Medidor em arco, compacto — o "gauge" que aparece no topo do parabéns.
 *
 * Escrito à mão de propósito: esta lâmina roda em `/q/[slug]`, o bundle dos
 * funis pagos, e uma biblioteca de gráfico aqui pesaria em todos eles.
 *
 * Duas sutilezas herdadas do `GaugeStepView`, que custaram depuração:
 *  - o ponteiro gira por transição CSS, NÃO por `motion`: o motion impõe
 *    `transform-origin: 50% 50%` do viewBox e o eixo sai do lugar;
 *  - por isso `transformBox: "view-box"` + origem explícita no centro.
 */
function MedidorArco({ valor, max, zonas, sufixo, rotulo }: {
  valor: number; max: number; sufixo?: string; rotulo?: string;
  zonas?: { label: string; color: string; upTo?: number }[];
}) {
  const R = 64, CX = 80, CY = 76;
  const faixas = zonas?.length ? zonas : [{ label: "", color: "var(--q-primary)" }];
  const razao = Math.max(0, Math.min(1, valor / (max || 100)));

  const [angulo, setAngulo] = useState(-90);
  useEffect(() => {
    const t = setTimeout(() => setAngulo(-90 + razao * 180), 220);
    return () => clearTimeout(t);
  }, [razao]);

  const pt = (deg: number, r = R) => {
    const rad = (deg - 180) * (Math.PI / 180);
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };

  // `upTo` dá a fatia real da escala; sem ele, fatias iguais
  const temUpTo = faixas.some((z) => typeof z.upTo === "number");
  const bordas: number[] = [0];
  faixas.forEach((z, i) => {
    bordas.push(temUpTo
      ? Math.max(bordas[i], Math.min(180, ((z.upTo ?? max) / (max || 100)) * 180))
      : ((i + 1) / faixas.length) * 180);
  });
  bordas[faixas.length] = 180;

  const zonaAtual = faixas.findIndex((_, i) => razao * 180 <= bordas[i + 1] + 1e-6);
  const nomeZona = rotulo ?? faixas[zonaAtual < 0 ? faixas.length - 1 : zonaAtual]?.label ?? "";

  const [f0x, f0y] = pt(0), [f1x, f1y] = pt(180);
  return (
    <div className="mx-auto w-full max-w-[240px]">
      <svg viewBox="0 0 160 96" className="w-full" role="img" aria-label={`Medidor: ${valor}${sufixo ?? ""}`}>
        <path d={`M ${f0x} ${f0y} A ${R} ${R} 0 0 1 ${f1x} ${f1y}`}
          fill="none" stroke="var(--q-text)" strokeWidth={11} opacity={0.08} strokeLinecap="round" />
        {faixas.map((z, i) => {
          if (bordas[i + 1] - bordas[i] < 0.5) return null;
          const [ax, ay] = pt(bordas[i]);
          const [bx, by] = pt(bordas[i + 1]);
          return (
            <path key={i} d={`M ${ax} ${ay} A ${R} ${R} 0 0 1 ${bx} ${by}`}
              fill="none" stroke={z.color} strokeWidth={11} strokeLinecap="butt" opacity={0.92} />
          );
        })}
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 14} stroke="var(--q-text)" strokeWidth={3.5} strokeLinecap="round"
          style={{
            transformBox: "view-box",
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${angulo}deg)`,
            transition: "transform .9s cubic-bezier(.2,.8,.2,1)",
          }} />
        <circle cx={CX} cy={CY} r={6.5} fill="var(--q-text)" />
        <circle cx={CX} cy={CY} r={3} fill="var(--q-surface, #fff)" />
      </svg>
      <div className="-mt-1 text-center">
        <span className="text-3xl font-black leading-none text-[var(--q-primary)] tabular-nums">
          {valor}{sufixo ?? ""}
        </span>
        {nomeZona ? (
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--q-text-muted)]">{nomeZona}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmStepView({ step, ctx }: { step: ConfirmStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-full rounded-3xl bg-[var(--q-surface)] p-7 text-center shadow-xl">
          {step.gaugeValue != null ? (
            <div className="mb-4">
              <MedidorArco valor={step.gaugeValue} max={step.gaugeMax ?? 100}
                zonas={step.gaugeZones} sufixo={step.gaugeSuffix} rotulo={step.gaugeLabel} />
            </div>
          ) : null}
          {step.emoji ? <div className="mb-2 text-4xl">{step.emoji}</div> : null}
          <Title>{interp(step.title, ctx)}</Title>
          {step.body ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx)} /></p> : null}
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
    logAnswer(ctx, step.id, step.question, opt.label);
    if (step.captures) ctx.setVar?.(step.captures, opt.value || opt.label); // resposta vira {estado}/{cidade}
    if (step.insight || step.loadingText) {
      setPhase("loading");
      setTimeout(() => setPhase("insight"), 1400);
    } else {
      setTimeout(ctx.advance, 220);
    }
  };

  const confirmMulti = () => {
    sel.forEach((i) => logAnswer(ctx, step.id, step.question, step.options[i].label));
    if (step.insight || step.loadingText) { setPhase("loading"); setTimeout(() => setPhase("insight"), 1400); }
    else ctx.advance();
  };

  return (
    <>
      <StepShell>
        <Title>{interp(step.question, ctx)}</Title>
        {step.help ? <p className="mt-2 text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.help, ctx)} /></p> : null}
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
              <p className="font-semibold text-[var(--q-primary)]">{interp(step.loadingText, ctx) || "Analisando..."}</p>
            </motion.div>
          ) : (
            <motion.div key="insight" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border-l-4 border-[var(--q-primary)] bg-[var(--q-bg-soft)] p-5">
              <p className="text-[15px] font-medium leading-relaxed text-[var(--q-text)]">{interp(step.insight, ctx)}</p>
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
  if (step.style === "diagnostico") return <LoadingDiagnostico step={step} ctx={ctx} />;
  if (step.style === "checklist") return <LoadingChecklist step={step} ctx={ctx} />;
  return <LoadingSimple step={step} ctx={ctx} />;
}

/**
 * DIAGNÓSTICO — casca fina sobre `Diagnostico.tsx`.
 *
 * A tela mora em arquivo próprio porque o motor layers precisa dela sem
 * arrastar este arquivo (1.500+ linhas) para o bundle público. Aqui só se
 * traduz `LoadingStep` → props e se liga o fim ao `ctx.advance`.
 */
function LoadingDiagnostico({ step, ctx }: { step: LoadingStep; ctx: StepCtx }) {
  return (
    <Diagnostico
      titulo={step.title ? interp(step.title, ctx) : undefined}
      subtitulo={step.slides?.[0] ? interp(step.slides[0], ctx) : undefined}
      caixas={(step.bars ?? []).map((b) => interp(b, ctx))}
      icones={step.icons}
      duracaoMs={step.durationMs ?? 5000}
      escuro={step.variant === "dark"}
      onFim={ctx.advance}
    />
  );
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
          {interp(step.slides[i], ctx)}
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
  // Casca fina sobre `Checklist.tsx`. A tela mora fora daqui porque o motor
  // layers precisa dela sem arrastar este arquivo para o bundle publico.
  return (
    <Checklist
      titulo={step.title ? interp(step.title, ctx) : undefined}
      barras={(step.bars ?? []).map((b) => interp(b, ctx))}
      checkpoints={step.checkpoints}
      duracaoMs={step.durationMs ?? 4200}
      logo={step.logo}
      legenda={step.slides?.[0] ? interp(step.slides[0], ctx) : undefined}
      escuro={step.variant === "dark"}
      onFim={ctx.advance}
      // grava no MESMO formato de sempre: step_id "<lamina>:cp<n>"
      onResponder={(i, cp, opt) => logAnswer(ctx, `${step.id}:cp${i}`, cp.question, opt)}
    />
  );
}

// ── Medidor / projeção (gauge) ────────────────────────────────────
export function GaugeStepView({ step, ctx }: { step: GaugeStep; ctx: StepCtx }) {
  const sMin = step.scaleMin ?? 0, sMax = Math.max((step.scaleMin ?? 0) + 1, step.scaleMax ?? 100);
  /**
   * `mode:"fixed"` (o padrão do construtor) fixa o ponteiro em `value`.
   * `mode:"range"` mantém o sorteio teatral antigo — e a semente vem de um
   * `useState` inicializador, não de `Math.random()` solto no corpo do render:
   * no corpo, cada re-render sortearia um valor novo e o ponteiro tremeria.
   */
  const [seed] = useState(() => Math.random());
  const value = useMemo(() => {
    if (step.mode === "range" && step.range) {
      const [a, b] = step.range;
      return Math.round(a + seed * (b - a));
    }
    return Math.round(step.value ?? Math.round((sMin + sMax) / 2));
  }, [step.mode, step.range, step.value, sMin, sMax, seed]);

  const zones = step.zones && step.zones.length ? step.zones : [{ label: "", color: "var(--q-primary)" }];
  const ratio = Math.max(0, Math.min(1, (value - sMin) / (sMax - sMin)));
  // ponteiro: -90° (esquerda) → +90° (direita)
  const [angle, setAngle] = useState(-90);
  useEffect(() => {
    const t = setTimeout(() => setAngle(-90 + ratio * 180), 250);
    return () => clearTimeout(t);
  }, [ratio]);

  const R = 86, CX = 100, CY = 100;
  const pt = (deg: number, r = R) => {
    const rad = (deg - 180) * (Math.PI / 180);
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };

  /**
   * Fronteiras das zonas em GRAUS (0..180). Com `upTo` a zona ocupa a fatia real
   * da escala — sem ele, cai no comportamento antigo de fatias iguais. Isso é o
   * que faz "ideal 18,5–25" desenhar uma faixa estreita em vez de 1/3 do arco.
   */
  const temUpTo = zones.some((z) => typeof z.upTo === "number");
  const bordas: number[] = [0];
  zones.forEach((z, i) => {
    if (temUpTo) {
      const v = typeof z.upTo === "number" ? z.upTo : sMax;
      bordas.push(Math.max(bordas[i], Math.min(180, ((v - sMin) / (sMax - sMin)) * 180)));
    } else {
      bordas.push(((i + 1) / zones.length) * 180);
    }
  });
  bordas[zones.length] = 180;

  const arcs = zones.map((z, i) => {
    const [x1, y1] = pt(bordas[i]);
    const [x2, y2] = pt(bordas[i + 1]);
    return { d: `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`, color: z.color, vazio: bordas[i + 1] - bordas[i] < 0.5 };
  });

  const zonaAtual = zones.findIndex((_, i) => ratio * 180 <= bordas[i + 1] + 1e-6);
  const zoneLabel = zones[zonaAtual < 0 ? zones.length - 1 : zonaAtual]?.label ?? "";

  // marcas numeradas no arco
  const nTicks = step.ticks ?? 5;
  const ticks = nTicks > 0
    ? Array.from({ length: nTicks + 1 }, (_, i) => {
        const deg = (i / nTicks) * 180;
        const [ax, ay] = pt(deg, R - 11);
        const [bx, by] = pt(deg, R - 17);
        const [tx, ty] = pt(deg, R - 28);
        return { ax, ay, bx, by, tx, ty, label: Math.round(sMin + (i / nTicks) * (sMax - sMin)) };
      })
    : [];

  return (
    <>
      <StepShell center>
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>
        {step.subtitle ? <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]"><RichText text={interp(step.subtitle, ctx)} /></p> : null}

        <div className="mx-auto mt-8 w-full max-w-xs">
          <svg viewBox="0 0 200 118" className="w-full">
            {/* trilho de fundo — dá o contorno do mostrador mesmo com 1 zona só */}
            <path d={`M ${pt(0)[0]} ${pt(0)[1]} A ${R} ${R} 0 0 1 ${pt(180)[0]} ${pt(180)[1]}`}
              fill="none" stroke="var(--q-text)" strokeWidth={14} opacity={0.08} strokeLinecap="round" />
            {arcs.filter((a) => !a.vazio).map((a, i) => (
              <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={14} strokeLinecap="butt" opacity={0.92} />
            ))}
            {/* marcas numeradas */}
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={t.ax} y1={t.ay} x2={t.bx} y2={t.by} stroke="var(--q-text)" strokeWidth={1.5} opacity={0.35} />
                <text x={t.tx} y={t.ty} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fontWeight={700} fill="var(--q-text)" opacity={0.45}>{t.label}</text>
              </g>
            ))}
            {/* ponteiro */}
            {/* Transição CSS, não `motion`: o motion impõe o próprio
                transform-origin (resolve 50%/50% do view-box = 100,59) e o
                ponteiro girava em torno do ponto errado — marcava ~60 com 82.
                Aqui a origem é o eixo do mostrador e o giro fica exato. */}
            <line x1={CX} y1={CY} x2={CX} y2={CY - R + 16} stroke="var(--q-text)" strokeWidth={4} strokeLinecap="round"
              style={{
                transformBox: "view-box",
                transformOrigin: `${CX}px ${CY}px`,
                transform: `rotate(${angle}deg)`,
                transition: "transform .9s cubic-bezier(.2,.8,.2,1)",
              }} />
            <circle cx={CX} cy={CY} r={8} fill="var(--q-text)" />
            <circle cx={CX} cy={CY} r={3.5} fill="var(--q-bg, #fff)" />
          </svg>
          <div className="mt-1 text-center">
            {step.showValue !== false ? (
              <div className="text-4xl font-black text-[var(--q-primary)]">
                {interp(step.verdict ?? `{valor}${step.suffix ?? ""}`, ctx).replace("{valor}", String(value))}
              </div>
            ) : null}
            {zoneLabel ? <div className="mt-1 text-sm font-bold uppercase tracking-wide text-[var(--q-text-muted)]">{zoneLabel}</div> : null}
          </div>
        </div>

        {step.caption ? <p className="mx-auto mt-5 max-w-xs text-center text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.caption, ctx)} /></p> : null}
      </StepShell>
      <StickyCta><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Resultado (teatral) ───────────────────────────────────────────
export function ResultStepView({ step, ctx }: { step: ResultStep; ctx: StepCtx }) {
  const [target] = useState(() => {
    const [a, b] = step.range;
    return Math.round(a + Math.random() * (b - a));
  });
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

  // anel SVG (verde sucesso, independente da paleta)
  const R = 78, C = 2 * Math.PI * R;
  const GREEN = "#16a34a";
  return (
    <>
      <StepShell center>
        <div className="text-center">
          {/* UAU! — gráfico 3D animado (gradiente + contorno + extrude), estilo vivadevelas */}
          <motion.div initial={{ scale: 0.3, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -5, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 11 }} className="mb-2 flex justify-center">
            <motion.span
              animate={{ rotate: [-5, 2, -5], y: [0, -4, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="inline-block text-6xl font-black italic leading-none tracking-tight"
              style={{
                background: "linear-gradient(180deg, #ffdf6b 0%, var(--q-primary) 75%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                WebkitTextStroke: "2.5px #ffffff",
                paintOrder: "stroke fill",
                filter: "drop-shadow(3px 4px 0 color-mix(in srgb, var(--q-primary) 78%, #000)) drop-shadow(0 12px 18px color-mix(in srgb, var(--q-primary) 45%, transparent))",
              } as React.CSSProperties}>
              {(interp(step.title, ctx).replace(/[^\wÀ-ÿ! ]/g, "").trim() || "UAU").toUpperCase()}
            </motion.span>
          </motion.div>

          {step.body ? (
            <p className="mx-auto max-w-xs text-[15px] leading-relaxed text-[var(--q-text-muted)]">
              <RichTextGreen text={interp(step.body, ctx)} />
            </p>
          ) : null}

          {/* anel de compatibilidade */}
          <div className="relative mx-auto my-6 h-44 w-44">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r={R} fill="none" stroke="#e8f5ee" strokeWidth="13" />
              <motion.circle cx="90" cy="90" r={R} fill="none" stroke={GREEN} strokeWidth="13" strokeLinecap="round"
                strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - n / 100) }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-[#15803d]">{n}<span className="text-2xl">%</span></span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#15803d]/70">{step.ringLabel ?? "Compatível"}</span>
            </div>
          </div>

          {step.subtitle ? (
            <p className="text-lg font-extrabold text-[var(--q-text)]">
              Sim, <span className="rounded-md bg-[#dcfce7] px-1.5 text-[#15803d]">{n}%</span>! <RichTextGreen text={interp(step.subtitle, ctx)} />
            </p>
          ) : null}
          {step.minShown ? (
            <p className="mt-2 text-sm text-[var(--q-text-muted)]">
              O mínimo necessário era <b className="text-[#15803d]">{step.minShown}%</b>, e você foi <b className="text-[#15803d]">muito além</b>!!!
            </p>
          ) : null}

          {/* card verde de aprovação */}
          {(step.approvedTitle || step.approvedBody) ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="mt-5 flex items-start gap-3 rounded-2xl border-2 border-[#bbf7d0] bg-[#f0fdf4] p-4 text-left">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#16a34a] text-sm text-white">✓</span>
              <div>
                {step.approvedTitle ? <p className="font-bold text-[#15803d]">{interp(step.approvedTitle, ctx)}</p> : null}
                {step.approvedBody ? <p className="mt-0.5 text-sm leading-relaxed text-[var(--q-text-muted)]">{interp(step.approvedBody, ctx)}</p> : null}
              </div>
            </motion.div>
          ) : null}
        </div>
      </StepShell>
      <StickyCta revealOnScroll><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

/** RichText com realce VERDE (lâmina de aprovação/compatibilidade do vivadevelas). */
function RichTextGreen({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(RICH_RE).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("==") && p.endsWith("==")) return <span key={i} className="rounded-md bg-[#dcfce7] px-1.5 font-bold text-[#15803d]">{p.slice(2, -2)}</span>;
        if (p.startsWith("**") && p.endsWith("**")) return <b key={i} className="font-bold text-[#15803d]">{p.slice(2, -2)}</b>;
        if (p.startsWith("*") && p.endsWith("*")) return <b key={i} className="font-bold text-[#15803d]">{p.slice(1, -1)}</b>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

// ── Oferta ────────────────────────────────────────────────────────
export function OfferStepView({ step, ctx }: { step: OfferStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell>
        {step.badge ? (
          <span className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#15803d]">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-[#16a34a] text-[9px] text-white">✓</span>{step.badge}
          </span>
        ) : null}
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>

        {step.image ? (
          <div className="relative mx-auto my-5 h-36 w-36">
            <motion.img initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160 }}
              src={step.image} alt="" className="h-36 w-36 rounded-full border-4 border-white object-cover shadow-[0_16px_30px_-12px_rgba(0,0,0,.3)]" />
            {step.verified ? (
              <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#1d9bf0] text-sm text-white shadow">✓</span>
            ) : null}
          </div>
        ) : null}

        {/* card da apresentação + stats */}
        <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--q-primary)_22%,transparent)] bg-[var(--q-surface)] p-4">
          {step.body ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx)} /></p> : null}
          {step.stats?.length ? (
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${step.stats.length}, minmax(0,1fr))` }}>
              {step.stats.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}
                  className="rounded-xl bg-[var(--q-bg-soft)] px-2 py-3 text-center">
                  <div className="text-lg font-black text-[var(--q-primary)]">{s.value}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--q-text-muted)]">{s.label}</div>
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>

        {/* card escuro do presente */}
        {(step.giftTitle || step.giftBody) ? (
          <div className="mt-4 rounded-2xl bg-[#3a241a] p-5 text-center text-white shadow-lg">
            {step.giftTitle ? (
              <span className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: "linear-gradient(95deg, var(--q-primary), color-mix(in srgb, var(--q-primary) 60%, #ffd9a8))" }}>{interp(step.giftTitle, ctx)}</span>
            ) : null}
            {step.giftBody ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-white/90"><RichText text={interp(step.giftBody, ctx)} /></p> : null}
          </div>
        ) : null}
      </StepShell>
      <StickyCta revealOnScroll><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

/** Aplica uma máscara (9 = dígito) sobre os dígitos digitados. Ex: "(99) 99999-9999". */
function applyMask(value: string, mask?: string): string {
  if (!mask) return value;
  const digits = value.replace(/\D/g, "");
  let out = "", di = 0;
  for (const ch of mask) {
    if (di >= digits.length) break;
    if (ch === "9") out += digits[di++];
    else out += ch;
  }
  return out;
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
    if (!ctx.preview) {
      fireMetaEvent("Lead", { content_name: "lead_capture" });
      if (ctx.vslId) await submitLead({ vslId: ctx.vslId, name: nm.trim(), phone: ph, componentId: step.componentId });
      else await submitFunnelLead({ funnelSlug: ctx.funnelSlug, name: nm.trim(), phone: ph, componentId: step.componentId });
    }
    ctx.advance();
  };

  return (
    <>
      <StepShell>
        <div className="text-center"><Title>{interp(step.title, ctx)}</Title></div>
        {step.body ? <p className="mt-2 text-center text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx)} /></p> : null}

        {step.image ? (
          <div className="relative mx-auto my-5 w-fit">
            {/* estrelinhas */}
            {[{ t: "-6%", l: "-4%", d: 0 }, { t: "8%", l: "98%", d: 0.6 }, { t: "78%", l: "-8%", d: 1.1 }, { t: "92%", l: "92%", d: 0.3 }].map((s, i) => (
              <motion.span key={i} className="absolute text-lg" style={{ top: s.t, left: s.l }}
                animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3], rotate: [0, 20, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: s.d }}>✨</motion.span>
            ))}
            {/* ebook com wave (flutua + balança) */}
            <motion.img
              animate={{ y: [0, -10, 0], rotate: [-1.5, 1.5, -1.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              src={step.image} alt="" className="max-h-52 w-auto rounded-xl object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,.22)]" />
            {/* selo GRÁTIS */}
            {step.freeBadge ? (
              <motion.span className="absolute -right-2 top-2 rounded-full bg-[#16a34a] px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg"
                animate={{ rotate: [8, 14, 8], scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity }}>{step.freeBadge}</motion.span>
            ) : null}
          </div>
        ) : null}

        {step.note ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm leading-relaxed text-[var(--q-text-muted)]">
            <span className="mt-0.5 text-base">🟢</span><span><RichText text={interp(step.note, ctx)} /></span>
          </div>
        ) : null}

        <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--q-primary)_18%,transparent)] bg-[var(--q-surface)] p-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-[var(--q-text-muted)]">{step.nameLabel}</label>
          <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={step.namePlaceholder}
            className="mt-1 w-full rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-[var(--q-text)] outline-none focus:border-[var(--q-primary)]" />
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--q-text-muted)]">{step.phoneLabel}</label>
          <input value={ph} onChange={(e) => setPh(applyMask(e.target.value, step.phoneMask))} inputMode="tel" placeholder={step.phonePlaceholder}
            className="mt-1 w-full rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-[var(--q-text)] outline-none focus:border-[var(--q-primary)]" />
        </div>
      </StepShell>
      <StickyCta revealOnScroll>
        <CtaButton onClick={submit} disabled={!ok || sending}>{sending ? "Enviando..." : step.cta}</CtaButton>
        {step.secure ? <p className="mt-2 text-center text-[11px] text-[var(--q-text-muted)]">{interp(step.secure, ctx)}</p> : null}
      </StickyCta>
    </>
  );
}

// ── Pós-captura ───────────────────────────────────────────────────
export function PostStepView({ step, ctx }: { step: PostStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <div className="text-center">
          {/* check verde que PULSA */}
          <div className="relative mx-auto mb-4 h-20 w-20">
            <motion.span className="absolute inset-0 rounded-full bg-[#16a34a]"
              animate={{ scale: [1, 1.35], opacity: [0.35, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
            <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.08, 1] }}
              transition={{ scale: { duration: 1.6, repeat: Infinity } }}
              className="relative grid h-20 w-20 place-items-center rounded-full bg-[#16a34a] text-4xl text-white shadow-[0_12px_28px_-8px_#16a34a]">✓</motion.div>
          </div>
          <Title>{interp(step.title, ctx)}</Title>
          {step.body ? <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx)} /></p> : null}

          {step.warn ? (
            <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-3 text-left text-sm font-medium leading-relaxed text-[#92400e]">
              🚨 <RichText text={interp(step.warn, ctx)} />
            </div>
          ) : null}
          {step.note ? (
            <div className="mt-3 rounded-2xl border-2 border-[color-mix(in_srgb,var(--q-primary)_20%,transparent)] bg-[var(--q-surface)] p-4 text-left text-sm leading-relaxed text-[var(--q-text-muted)]">
              <RichText text={interp(step.note, ctx)} />
            </div>
          ) : null}
        </div>
      </StepShell>
      <StickyCta revealOnScroll><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
    </>
  );
}

// ── Bridge ────────────────────────────────────────────────────────
export function BridgeStepView({ step, ctx }: { step: BridgeStep; ctx: StepCtx }) {
  return (
    <>
      <StepShell center>
        <Title>{interp(step.title, ctx)}</Title>
        {step.body ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--q-text-muted)]"><RichText text={interp(step.body, ctx)} /></p> : null}
        {step.warn ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            🚨 <RichText text={interp(step.warn, ctx)} />
          </div>
        ) : null}
      </StepShell>
      <StickyCta revealOnScroll><CtaButton onClick={ctx.advance}>{step.cta}</CtaButton></StickyCta>
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
    if (!ctx.preview) fireMetaEvent("InitiateCheckout");
    // checkout leva o rastreio da página junto — ver `rastreio.ts`
    if (step.checkoutUrl) window.open(comRastreio(step.checkoutUrl), "_blank");
  };

  const bar = step.headerBar;
  return (
    <div className="flex w-full flex-1 flex-col items-center">
      {bar?.enabled && bar.text ? (
        <div className="w-full px-4 py-2.5 text-center text-sm font-bold"
          style={{ background: bar.bg || "var(--q-primary)", color: bar.color || "#ffffff" }}>
          {interp(bar.text, ctx)}
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-md px-5 py-6">
        {step.title ? <h2 className="mb-4 text-center text-xl font-bold text-white"><RichText text={interp(step.title, ctx)} /></h2> : null}
        {step.embedHtml ? (
          <VturbEmbed html={step.embedHtml} slug={ctx.funnelSlug} preview={ctx.preview} />
        ) : (
          <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black/60 shadow-2xl">
            <div className="flex h-full w-full flex-col items-center justify-center text-center text-white/70">
              <span className="text-4xl">▶</span>
              <p className="mt-3 px-6 text-sm">Cole o embed do VTurb no campo &quot;Embed do player&quot; (no editor da lâmina).</p>
            </div>
          </div>
        )}
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

/**
 * Injeta o EMBED do player (VTurb/converteai): seta o HTML (o iframe com
 * onload inline dispara sozinho) e RE-EXECUTA os <script> (innerHTML não roda
 * script). Funciona com o embed v4 do smartplayer.
 */
function VturbEmbed({ html, slug, preview }: { html: string; slug: string; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    el.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      if (!old.src) s.textContent = old.textContent;
      s.async = true;
      document.head.appendChild(s);
      old.remove();
    });
    const detach = attachVslWatch({ funnelSlug: slug, html, disabled: preview });
    return () => { el.innerHTML = ""; detach(); };
  }, [html, slug, preview]);
  return <div ref={ref} className="vturb-embed mx-auto w-full overflow-hidden rounded-2xl shadow-2xl" />;
}
