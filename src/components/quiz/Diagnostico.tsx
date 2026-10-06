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
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface DiagnosticoProps {
  titulo?: string;
  subtitulo?: string;
  /** uma verificação por caixa; lista vazia cai num rótulo genérico */
  caixas: string[];
  /** emojis na mesma ordem das caixas; faltando, usa 🔎 */
  icones?: string[];
  duracaoMs?: number;
  escuro?: boolean;
  /**
   * Cor do anel, do % e dos ✓. Vem por PROP, não por CSS var: `--q-primary` só
   * existe onde o motor aplica `paletteVars`, e no layers isso acontece apenas
   * no ramo de bloco-hero. Renderizado como bloco COMUM, o anel ficava sem cor
   * — desenhado e invisível.
   */
  cor?: string;
  /** chamado uma única vez, quando o anel fecha */
  onFim?: () => void;
  /** conteúdo extra abaixo das caixas (ex.: botão da lâmina) */
  children?: React.ReactNode;
}

export default function Diagnostico({
  titulo, subtitulo, caixas, icones, duracaoMs = 5000, escuro = false, cor, onFim, children,
}: DiagnosticoProps) {
  const acento = cor || "var(--q-primary)";
  const trilho = cor ? `${cor}22` : "var(--q-bg-soft)";
  // giro dos anéis e pulso do ícone desligam para quem pediu menos movimento
  const reduzido = prefereMenosMovimento();
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

      {/* MEDALHÃO — o do print de referência: ícone no miolo branco, dois anéis
          concêntricos girando em sentidos opostos e o arco de progresso por
          fora. O giro contínuo é o que faz a espera parecer trabalho sendo
          feito; um anel parado só informa quanto falta. */}
      {/* 132px era pequeno demais: na referência o medalhão é o elemento
          dominante da tela, e aqui ele competia com as caixas de checagem.
          172px o coloca como assunto principal e ainda cabe num 375px de
          largura com folga (172 + 2×24 de padding). */}
      <div className="relative my-7 h-[172px] w-[172px] shrink-0">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ border: `1px dashed ${acento}55` }}
          animate={reduzido ? {} : { rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-[13px] rounded-full"
          style={{ border: `2px solid ${acento}2e` }}
          animate={reduzido ? {} : { rotate: -360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
        <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="4" stroke={trilho} />
          <circle
            cx="40" cy="40" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
            stroke={acento}
            strokeDasharray={PERIM}
            strokeDashoffset={PERIM * (1 - pct / 100)}
          />
        </svg>
        {/* miolo branco elevado: separa o ícone dos anéis sem precisar de borda */}
        <div
          className="absolute inset-[34px] grid place-items-center rounded-full bg-white"
          style={{ boxShadow: `0 8px 24px -8px ${acento}66` }}
        >
          <motion.span
            className="text-[40px] leading-none"
            animate={reduzido ? {} : { scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {icones?.[ativa] ?? "🔍"}
          </motion.span>
        </div>
      </div>

      {/* BARRA com gradiente + rótulo, como no print */}
      <div className="w-full max-w-sm">
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: trilho }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${acento}, ${acento}b3)` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold tracking-wide">
          <span style={{ color: "var(--q-text-muted, #94a3b8)" }}>PROCESSANDO</span>
          <span className="tabular-nums" style={{ color: acento }}>{Math.round(pct)}%</span>
        </div>
      </div>

      {/* PÍLULAS DE ETAPA — a fase corrente acesa, as outras apagadas */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {linhas.map((label, i) => {
          const corrente = i === ativa && pct < 100;
          const feita = i < ativa || pct >= 100;
          const curto = label.replace(/[.…]+$/, "").split(" ")[0].toUpperCase();
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide transition-colors"
              style={{
                background: corrente ? `${acento}1a` : "transparent",
                color: corrente ? acento : feita ? `${acento}99` : "var(--q-text-muted, #cbd5e1)",
                border: `1px solid ${corrente ? `${acento}59` : "rgba(0,0,0,.07)"}`,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: corrente || feita ? acento : "rgba(0,0,0,.15)" }}
              />
              {curto}
            </span>
          );
        })}
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: trilho }}>
                {icones?.[i] ?? "🔎"}
              </div>
              <p className="flex-1 text-[13px] font-semibold leading-snug text-neutral-800">{label}</p>
              {feita ? (
                <span className="shrink-0 text-lg leading-none" style={{ color: acento }}>✓</span>
              ) : rodando ? (
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: acento }}
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
