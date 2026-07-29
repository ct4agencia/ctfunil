"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ScratchStep, ScratchCard } from "@/lib/quiz/types";
import { StepShell, StickyCta, CtaButton, RichText } from "./ui";
import { interp, type StepCtx } from "./steps";
import { playWin, playUrl } from "@/lib/quiz/sound";

/**
 * Raspadinha em GRADE (N cards) — espelha o painel de prêmios da roleta.
 *
 * Mecânica (decisão do Luca, 2026-07):
 *  - cada card tem copy, cor, PESO e popup próprio;
 *  - o prêmio é sorteado por PESO (100 = "viciado", sempre cai nele) e
 *    atribuído ao card que a lead raspar — igual à roleta, que sempre para na
 *    fatia escolhida. Ela decide QUAL raspar; o prêmio é o sorteado;
 *  - raspou `revealPct` da capa → revela aquele card e abre o POPUP;
 *  - fechando o popup, os demais cards se revelam com os prêmios restantes;
 *  - o botão final vai pro `ctaUrl` (WhatsApp) ou avança a lâmina se vazio.
 */

const CW = 300, CH = 150;             // resolução do canvas de cada card
const COLS_GRID = 12, ROWS_GRID = 8;  // grade de cobertura (não usa getImageData)

/** Sorteio por peso. Peso 100 num card e 0 nos outros = sempre esse card. */
function pickByWeight(cards: ScratchCard[]): number {
  const w = cards.map((c) => Math.max(0, Number(c.weight ?? 0)));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * cards.length); // sem peso = sorteio justo
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i;
  }
  return w.findIndex((x) => x > 0);
}

/** Um card raspável. Avisa o pai quando passa do limiar. */
function Card({
  card, cover, coverText, revealPct, revealed, disabled, onReveal,
}: {
  card: ScratchCard;
  cover: string;
  coverText: string;
  revealPct: number;
  revealed: boolean;
  disabled: boolean;
  onReveal: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const cells = useRef<Set<number>>(new Set());
  const fired = useRef(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const grad = g.createLinearGradient(0, 0, CW, CH);
    grad.addColorStop(0, cover);
    grad.addColorStop(1, "#9c9c9c");
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = "rgba(0,0,0,.38)";
    g.textAlign = "center";
    g.font = "26px serif";
    g.fillText("👆", CW / 2, CH / 2 - 14);
    g.font = "bold 15px Poppins, system-ui, sans-serif";
    g.fillText(coverText, CW / 2, CH / 2 + 20);
  }, [cover, coverText]);

  // revelado por fora (os "outros" cards, depois do popup): limpa a capa
  useEffect(() => {
    if (revealed) ref.current?.getContext("2d")?.clearRect(0, 0, CW, CH);
  }, [revealed]);

  const at = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return [((t.clientX - r.left) * CW) / r.width, ((t.clientY - r.top) * CH) / r.height];
  };

  const erase = (x: number, y: number) => {
    if (fired.current || disabled) return;
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.fill();
    const gx = Math.floor((x / CW) * COLS_GRID), gy = Math.floor((y / CH) * ROWS_GRID);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = gx + dx, cy = gy + dy;
        if (cx >= 0 && cx < COLS_GRID && cy >= 0 && cy < ROWS_GRID) cells.current.add(cy * COLS_GRID + cx);
      }
    }
    if (cells.current.size / (COLS_GRID * ROWS_GRID) >= revealPct) {
      fired.current = true;
      onReveal();
    }
  };

  const down = (e: React.MouseEvent | React.TouchEvent) => { drawing.current = true; const [x, y] = at(e); erase(x, y); };
  const move = (e: React.MouseEvent | React.TouchEvent) => { if (!drawing.current) return; const [x, y] = at(e); erase(x, y); };
  const up = () => { drawing.current = false; };

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${CW} / ${CH}` }}>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center"
        style={{ background: "var(--q-bg-soft)", border: `2px solid ${card.color || "var(--q-primary)"}` }}
      >
        {card.emoji ? <span className="text-2xl leading-none">{card.emoji}</span> : null}
        <span className="mt-0.5 text-base font-black leading-tight" style={{ color: card.color || "var(--q-primary)" }}>
          {card.label}
        </span>
      </div>
      {!revealed ? (
        <canvas
          ref={ref}
          width={CW}
          height={CH}
          className="absolute inset-0 h-full w-full touch-none rounded-xl"
          style={{ cursor: disabled ? "not-allowed" : "grab" }}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
        />
      ) : null}
    </div>
  );
}

export default function ScratchGrid({ step, ctx }: { step: ScratchStep; ctx: StepCtx }) {
  // Lâmina legada (sem `cards`) continua funcionando com prize/prizeEmoji.
  const cards = useMemo<ScratchCard[]>(() => {
    if (step.cards?.length) return step.cards;
    return [{
      label: step.prize ?? "PRÊMIO",
      emoji: step.prizeEmoji,
      popupTitle: step.winTitle,
      popupBody: step.winBody,
    }];
  }, [step]);

  const revealPct = Math.min(0.9, Math.max(0.05, Number(step.revealPct ?? 25) / 100));
  const cols = Math.min(4, Math.max(1, Number(step.columns ?? 2)));
  const lockKey = `ctf_scratch_${ctx.funnelSlug}_${step.id}`;

  /** Estado único da lâmina: qual prêmio saiu, em qual card, e em que fase.
   *  Consolidado num state só pra não disparar setStates em cascata. */
  type Estado = { prize: number; pos: number; fase: "popup" | "todos" };
  const [estado, setEstado] = useState<Estado | null>(null);
  const prizeIdx = estado?.prize ?? null;
  const openedPos = estado?.pos ?? null;
  const popup = estado?.fase === "popup";
  const revealAll = estado?.fase === "todos";

  // 1 raspagem por dispositivo: restaura o estado já revelado (nunca no preview).
  // Precisa ser em effect (ler localStorage no render divergiria do SSR e
  // quebraria a hidratação) — mesmo padrão do lockReplay da roleta, steps.tsx:205.
  useEffect(() => {
    if (ctx.preview || !step.oncePerDevice) return;
    try {
      const raw = localStorage.getItem(lockKey);
      if (!raw) return;
      const s = JSON.parse(raw) as { prize: number; pos: number };
      if (typeof s?.prize === "number" && typeof s?.pos === "number") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurar estado persistido; roda 1x
        setEstado({ prize: s.prize, pos: s.pos, fase: "todos" });
      }
    } catch { /* storage bloqueado: segue normal */ }
  }, [lockKey, step.oncePerDevice, ctx.preview]);

  const onReveal = useCallback((pos: number) => {
    if (openedPos !== null) return;
    const idx = pickByWeight(cards);
    setEstado({ prize: idx, pos, fase: "popup" });
    if (!ctx.preview) {
      if (step.sound?.enabled) { if (step.sound.winUrl) playUrl(step.sound.winUrl); else playWin(); }
      import("canvas-confetti").then((m) => m.default({ particleCount: 160, spread: 90, origin: { y: 0.4 } })).catch(() => {});
      if (step.oncePerDevice) {
        try { localStorage.setItem(lockKey, JSON.stringify({ prize: idx, pos })); } catch { /* noop */ }
      }
    }
  }, [openedPos, cards, ctx.preview, step.sound, step.oncePerDevice, lockKey]);

  /** O card raspado mostra o prêmio SORTEADO; os demais, os prêmios restantes. */
  const cardAt = useCallback((pos: number): ScratchCard => {
    if (openedPos === null || prizeIdx === null) return cards[pos];
    if (pos === openedPos) return cards[prizeIdx];
    const restantes = cards.filter((_, i) => i !== prizeIdx);
    const outrasPos = cards.map((_, i) => i).filter((i) => i !== openedPos);
    return restantes[outrasPos.indexOf(pos)] ?? cards[pos];
  }, [cards, openedPos, prizeIdx]);

  const premio = prizeIdx !== null ? cards[prizeIdx] : null;
  const destino = premio?.redeemUrl || step.ctaUrl || "";

  const seguir = () => {
    if (destino) { window.location.href = destino; return; }
    ctx.advance();
  };

  /** fecha o popup e revela o que tinha nos OUTROS cards */
  const fecharPopup = () => setEstado((e) => (e ? { ...e, fase: "todos" } : e));

  return (
    <>
      <StepShell center>
        <div className="text-center">
          <h1 className="text-[26px] font-extrabold leading-tight text-[var(--q-text)]">
            <RichText text={interp(step.title, ctx)} />
          </h1>
        </div>
        {step.subtitle ? (
          <p className="mt-2 text-center text-sm text-[var(--q-text-muted)]">
            <RichText text={interp(step.subtitle, ctx)} />
          </p>
        ) : null}

        <div
          className="mx-auto mt-6 grid w-full gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: 460 }}
        >
          {cards.map((_, pos) => (
            <Card
              key={pos}
              card={cardAt(pos)}
              cover={step.coverColor ?? "#b8b8b8"}
              coverText={step.coverText ?? "RASPE AQUI"}
              revealPct={revealPct}
              revealed={revealAll || pos === openedPos}
              disabled={openedPos !== null}
              onReveal={() => onReveal(pos)}
            />
          ))}
        </div>
      </StepShell>

      <StickyCta bare>
        {openedPos !== null ? (
          <CtaButton onClick={seguir}>{step.winCta}</CtaButton>
        ) : (
          <p className="text-center text-sm font-medium text-[var(--q-text-muted)]">
            👆 Raspe um card para revelar seu prêmio
          </p>
        )}
      </StickyCta>

      {/* POPUP de premiação — cores configuráveis, copy própria do prêmio */}
      <AnimatePresence>
        {popup && premio ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,.6)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={fecharPopup}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl p-7 text-center shadow-2xl"
              style={{ background: step.popupBg || "#16a34a", color: step.popupText || "#ffffff" }}
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl">{premio.emoji || "🎉"}</div>
              <p className="mt-2 text-2xl font-black leading-tight">
                <RichText text={interp(premio.popupTitle || step.winTitle || "Parabéns!", ctx)} />
              </p>
              <p className="mt-2 text-base font-semibold opacity-95">
                <RichText text={interp(premio.popupBody || step.winBody || premio.label, ctx)} />
              </p>
              <button
                type="button"
                onClick={fecharPopup}
                className="mt-6 w-full rounded-full px-6 py-3.5 text-base font-extrabold shadow-lg"
                style={{ background: step.popupBtnBg || "#ffffff", color: step.popupBg || "#16a34a" }}
              >
                {step.cta || "Resgatar"}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
