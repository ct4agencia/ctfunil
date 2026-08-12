"use client";

/**
 * DIAGNÓSTICO — anel de progresso + caixas que verificam uma coisa por vez.
 *
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO
 * Os dois motores precisam da mesma tela: o tipado a chama de `LoadingStepView`
 * (steps.tsx) e o layers de `LoadingBlock` (layers/blocks.tsx). Deixá-la no
 * steps.tsx obrigaria o blocks.tsx a importar aquele arquivo inteiro — 1.500+
 * linhas de roleta, raspadinha, medidor e quiz — para dentro do bundle de
 * `/q/[slug]`, que não pode crescer. Duplicar o componente resolveria o bundle e
 * criaria duas telas que divergem no primeiro ajuste. Um arquivo próprio, puro,
 * evita as duas coisas. Mesmo precedente do `RoletaInterativa.tsx`.
 *
 * POR QUE NÃO É O CHECKLIST COM OUTRO CSS
 * No checklist a métrica visual é QUANTO falta (barra enchendo). Aqui é O QUE
 * está sendo verificado agora (caixa rodando). A lâmina existe para estabelecer
 * que houve uma análise sobre o visitante antes de a roleta aparecer — a caixa
 * com spinner comunica isso; a barra comunica espera.
 *
 * Puro de propósito: recebe texto e devolve `onFim`. Não conhece `StepCtx`,
 * `LayersCtx`, tracking nem navegação — quem chama decide o que fazer no fim.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";

export interface DiagnosticoProps {
  titulo?: string;
  subtitulo?: string;
  /** uma verificação por caixa; lista vazia cai num rótulo genérico */
  caixas: string[];
  /** emojis na mesma ordem das caixas; faltando, usa 🔎 */
  icones?: string[];
  duracaoMs?: number;
  escuro?: boolean;
  /** chamado uma única vez, quando o anel fecha */
  onFim?: () => void;
  /** conteúdo extra abaixo das caixas (ex.: botão da lâmina) */
  children?: React.ReactNode;
}

export default function Diagnostico({
  titulo, subtitulo, caixas, icones, duracaoMs = 5000, escuro = false, onFim, children,
}: DiagnosticoProps) {
  const linhas = caixas.length ? caixas : ["Processando…"];
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0, parado = false, t0: number | null = null;
    const tick = (ts: number) => {
      if (parado) return;
      if (t0 == null) t0 = ts;
      const p = Math.min(100, ((ts - t0) / duracaoMs) * 100);
      setPct(p);
      if (p >= 100) {
        // 420 ms de respiro: sem isso o último ✓ aparece e some no mesmo quadro,
        // e o visitante não chega a ver a análise concluir.
        if (onFim) setTimeout(onFim, 420);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { parado = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada caixa ocupa uma fatia igual do tempo; a última fecha junto com o anel.
  const fatia = 100 / linhas.length;
  const ativa = Math.min(linhas.length - 1, Math.floor(pct / fatia));

  // Anel: raio 34 num viewBox de 80 deixa margem para a espessura do traço sem
  // clipar. O dasharray é o perímetro; o offset desenha a fração cumprida.
  const R = 34, PERIM = 2 * Math.PI * R;

  return (
    <div className={`flex w-full flex-1 flex-col items-center justify-center px-6 ${escuro ? "text-white" : ""}`}>
      {titulo ? (
        <h2
          className="text-center font-[var(--q-display)] text-[26px] font-bold leading-tight text-[var(--q-text)]"
          dangerouslySetInnerHTML={{ __html: titulo }}
        />
      ) : null}
      {subtitulo ? (
        <p className="mt-2 max-w-xs text-center text-sm leading-snug text-[var(--q-text-muted)]">{subtitulo}</p>
      ) : null}

      <div className="relative my-7 h-[92px] w-[92px] shrink-0">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="5" className="stroke-[var(--q-bg-soft)]" />
          <circle
            cx="40" cy="40" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
            stroke="var(--q-primary)"
            strokeDasharray={PERIM}
            strokeDashoffset={PERIM * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums text-[var(--q-primary)]">
          {Math.round(pct)}%
        </div>
      </div>

      <div className="w-full max-w-sm space-y-2.5">
        {linhas.map((label, i) => {
          const feita = i < ativa || pct >= 100;
          const rodando = i === ativa && pct < 100;
          return (
            <motion.div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[0_2px_10px_rgba(0,0,0,.06)]"
              animate={{ opacity: feita || rodando ? 1 : 0.45 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--q-bg-soft)] text-lg">
                {icones?.[i] ?? "🔎"}
              </div>
              <p className="flex-1 text-[13px] font-semibold leading-snug text-neutral-800">{label}</p>
              {feita ? (
                <span className="shrink-0 text-lg leading-none text-[var(--q-primary)]">✓</span>
              ) : rodando ? (
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-[var(--q-primary)]"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </span>
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-200" />
              )}
            </motion.div>
          );
        })}
      </div>

      {children}
    </div>
  );
}
