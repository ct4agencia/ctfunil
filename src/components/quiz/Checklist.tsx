"use client";

/**
 * CHECKLIST — barras rotuladas que enchem em sequência, pausando em
 * micro-perguntas ("Preparando seu plano").
 *
 * POR QUE EM ARQUIVO PRÓPRIO
 * Mesma história do `Diagnostico.tsx`: os dois motores precisam desta tela. Ela
 * vivia dentro do `steps.tsx`, então o motor layers não a alcançava sem puxar
 * 1.500 linhas de roleta/raspadinha/medidor para o bundle de `/q/[slug]`.
 *
 * O preço apareceu na conversão do `cdb-rr`: a lâmina de loading de lá tem três
 * barras rotuladas e uma micro-pergunta, e o layers só sabia desenhar uma barra
 * lisa. A pergunta — que GRAVA resposta do lead — sumiria sem ninguém notar.
 *
 * Puro de propósito: recebe texto, devolve `onFim` e `onResponder`. Não conhece
 * `StepCtx`, `LayersCtx`, tracking nem navegação — quem chama grava a resposta
 * no formato do seu próprio motor.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/components/referencias/beui/lib/reduced-motion-seguro";

export interface ChecklistCheckpoint {
  /** percentual (0–100) em que a barra pausa e abre o modal */
  at: number;
  question: string;
  options: string[];
}

export interface ChecklistProps {
  titulo?: string;
  /** rótulo de cada barra, na ordem em que enchem */
  barras: string[];
  checkpoints?: ChecklistCheckpoint[];
  duracaoMs?: number;
  logo?: string;
  legenda?: string;
  escuro?: boolean;
  /** cor das barras e dos ✓ — ver a mesma nota em Diagnostico.tsx */
  cor?: string;
  /** chamado uma vez, quando a última barra fecha */
  onFim?: () => void;
  /** chamado quando o visitante responde uma micro-pergunta */
  onResponder?: (indice: number, cp: ChecklistCheckpoint, opcao: string) => void;
}

export default function Checklist({
  titulo, barras, checkpoints: cps, duracaoMs = 4200, logo, legenda, escuro = false, cor, onFim, onResponder,
}: ChecklistProps) {
  const acento = cor || "var(--q-primary)";
  const trilho = cor ? `${cor}22` : "var(--q-bg-soft)";
  const bars = barras.length ? barras : ["Processando…"];
  const checkpoints = useMemo(() => (cps ?? []).slice().sort((a, b) => a.at - b.at), [cps]);
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const questionId = useId();

  const [pct, setPct] = useState(0);
  const [pausado, setPausado] = useState<number | null>(null);
  const respondidos = useRef<Set<number>>(new Set());
  const inicio = useRef<number | null>(null);
  const decorridoAntes = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let parado = false;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = (ts: number) => {
      if (parado) return;
      if (inicio.current == null) inicio.current = ts;
      const p = Math.min(100, ((decorridoAntes.current + (ts - inicio.current)) / duracaoMs) * 100);

      // pausa no primeiro checkpoint ainda não respondido
      const cp = checkpoints.findIndex((c, i) => !respondidos.current.has(i) && p >= c.at);
      if (cp !== -1) {
        setPct(checkpoints[cp].at);
        setPausado(cp);
        decorridoAntes.current = (checkpoints[cp].at / 100) * duracaoMs;
        inicio.current = null;
        return;
      }
      setPct(p);
      if (p >= 100) { if (onFim) finishTimer = setTimeout(onFim, 350); return; }
      raf.current = requestAnimationFrame(tick);
    };
    if (pausado == null) raf.current = requestAnimationFrame(tick);
    return () => {
      parado = true;
      if (raf.current) cancelAnimationFrame(raf.current);
      if (finishTimer !== undefined) clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausado]);

  const responder = (i: number, opcao: string) => {
    onResponder?.(i, checkpoints[i], opcao);
    respondidos.current.add(i);
    setPausado(null);
  };

  const fatia = 100 / bars.length;
  const ativa = Math.min(bars.length - 1, Math.floor(pct / fatia));
  const cp = pausado != null ? checkpoints[pausado] : null;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!cp || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [cp]);

  return (
    <div className={`relative flex w-full flex-1 flex-col items-center justify-center px-7 ${escuro ? "text-white" : ""}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="mb-6 h-9 w-auto object-contain" />
      ) : null}
      {titulo ? (
        <h2
          className="mb-7 text-center font-[var(--q-display)] text-[22px] font-bold leading-tight text-[var(--q-text)]"
          dangerouslySetInnerHTML={{ __html: titulo }}
        />
      ) : null}

      <div className="w-full max-w-sm space-y-4">
        {bars.map((label, i) => {
          const feita = i < ativa || pct >= 100;
          const rodando = i === ativa && pct < 100;
          const enche = feita ? 100 : rodando ? Math.max(0, ((pct - i * fatia) / fatia) * 100) : 0;
          return (
            <div key={i}>
              <div className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">
                <span className={feita || rodando ? "text-[var(--q-text)]" : "text-[var(--q-text-muted)] opacity-60"}>{label}</span>
                <span className="tabular-nums text-[var(--q-text-muted)]">
                  {feita ? <span style={{ color: acento }}>✓</span> : rodando ? `${Math.round(enche)}%` : ""}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: trilho }}>
                <motion.div className="h-full rounded-full" style={{ background: acento }}
                  animate={{ width: `${enche}%` }} transition={{ ease: "linear", duration: reducedMotion ? 0 : 0.15 }} />
              </div>
            </div>
          );
        })}
      </div>

      {legenda ? <p className="mt-7 text-center text-sm text-[var(--q-text-muted)]">{legenda}</p> : null}

      <dialog ref={dialogRef} aria-labelledby={questionId} closedby="none" onCancel={(event) => event.preventDefault()}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-3rem)] max-w-sm overflow-auto rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-sm">
        {cp && pausado !== null ? (
          <motion.div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            initial={reducedMotion ? false : { scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 }}>
            <p id={questionId} className="mb-4 text-center text-[17px] font-bold leading-snug text-neutral-900">{cp.question}</p>
            <div className="space-y-2">
              {cp.options.map((o, k) => (
                <button key={k} type="button" onClick={() => responder(pausado, o)}
                  className="w-full rounded-xl border-2 border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-current">
                  {o}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </dialog>
    </div>
  );
}
