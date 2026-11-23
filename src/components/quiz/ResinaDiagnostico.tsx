"use client";

/**
 * DIAGNÓSTICO no formato da referência — a espera que parece trabalho.
 *
 * POR QUE NÃO É O `Diagnostico.tsx`
 * Aquele mostra uma LISTA de verificações que acendem uma a uma, com anéis
 * inteiros girando. Este mostra UMA mensagem por vez no centro, trocando junto
 * com o ícone, e os anéis são ARCOS (só uma borda colorida) — o que dá a
 * leitura de peça girando em vez de aro decorativo. São dois desenhos para o
 * mesmo momento, e o `Diagnostico.tsx` é usado pelos outros funis: reescrevê-lo
 * mudaria todos eles.
 *
 * O QUE FAZ A ESPERA NÃO PARECER TRAVADA
 * Três coisas trabalhando juntas: a mensagem trocando (algo novo está sendo
 * feito), o brilho varrendo a barra (há movimento mesmo quando o número não
 * mudou) e os arcos em velocidades e sentidos diferentes (nada está parado).
 * Uma barra sozinha com número parado lê como travamento.
 *
 * Puro: recebe as mensagens e devolve `onFim`.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepLoading.tsx`.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { tokensResina, rgbDe } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface MensagemDiag {
  texto: string;
  icone?: string;
}

export interface ResinaDiagnosticoProps {
  cor: string;
  mensagens: MensagemDiag[];
  duracaoMs?: number;
  legenda?: string;
  /**
   * Qual medalhão desenhar. "novo" são os ARCOS da referência (só uma borda
   * colorida, então o giro é visível); "antigo" são os anéis inteiros que os
   * outros funis usam. Os dois existem porque a escolha é do construtor, não
   * minha.
   */
  anel?: "novo" | "antigo";
  /** pílulas curtas com a fase corrente acesa */
  pilulas?: boolean;
  /** caixas com uma verificação por linha, marcando conforme avança */
  caixas?: boolean;
  onFim?: () => void;
}

export default function ResinaDiagnostico({
  cor, mensagens, duracaoMs = 5000, legenda = "Aguarde só um instante...",
  anel = "novo", pilulas = false, caixas = true, onFim,
}: ResinaDiagnosticoProps) {
  const t = tokensResina(cor);
  const rgb = rgbDe(cor);
  const reduzido = prefereMenosMovimento();
  const linhas = mensagens.length ? mensagens : [{ texto: "Processando…", icone: "🔎" }];

  const [pct, setPct] = useState(0);
  const atual = Math.min(linhas.length - 1, Math.floor((pct / 100) * linhas.length));

  useEffect(() => {
    let raf = 0, parado = false, t0: number | null = null;
    const passo = (ts: number) => {
      if (parado) return;
      if (t0 == null) t0 = ts;
      const p = Math.min(100, ((ts - t0) / duracaoMs) * 100);
      setPct(p);
      // 420ms de respiro: sem isso a barra chega a 100% e a tela troca no mesmo
      // quadro — o visitante não chega a ver a análise concluir.
      if (p >= 100) { if (onFim) setTimeout(onFim, 420); return; }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { parado = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-5 py-5 text-center" style={{ color: t.text, minHeight: "calc(100dvh - 48px)" }}>
      <motion.div
        initial={reduzido ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative mb-7 h-40 w-40"
      >
        {!reduzido && (
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute rounded-full"
            style={{ inset: -20, background: `radial-gradient(circle, rgba(${rgb},.3) 0%, transparent 70%)` }}
            aria-hidden
          />
        )}

        {/* ANEL NOVO: arcos — só uma borda recebe cor, então o giro é visível.
            Um aro INTEIRO girando é indistinguível de um aro parado, e é por
            isso que os dois desenhos comunicam coisas diferentes. */}
        {anel === "novo" ? (
          <>
            <motion.div
              animate={reduzido ? {} : { rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full"
              style={{ border: "3px solid transparent", borderTopColor: cor, borderRightColor: `rgba(${rgb},.4)` }}
              aria-hidden
            />
            <motion.div
              animate={reduzido ? {} : { rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute rounded-full"
              style={{ inset: 12, border: "2.5px solid transparent", borderBottomColor: t.primaryDark, borderLeftColor: `rgba(${rgb},.35)` }}
              aria-hidden
            />
            <div className="absolute rounded-full" style={{ inset: 6, border: `1.5px dashed rgba(${rgb},.15)` }} aria-hidden />
          </>
        ) : (
          /* ANEL ANTIGO: aros completos girando em sentidos opostos, mais o arco
             de progresso por fora. É o desenho que os outros funis usam. */
          <>
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ border: `1px dashed ${cor}55` }}
              animate={reduzido ? {} : { rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
            <motion.span
              className="absolute rounded-full"
              style={{ inset: 10, border: `2px solid ${cor}2e` }}
              animate={reduzido ? {} : { rotate: -360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
            <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="4" stroke={`${cor}22`} />
              <circle
                cx="40" cy="40" r="34" fill="none" strokeWidth="4" strokeLinecap="round" stroke={cor}
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - pct / 100)}
              />
            </svg>
          </>
        )}

        <div
          className="absolute grid place-items-center rounded-full"
          style={{
            inset: 24,
            background: `linear-gradient(145deg, #ffffff 0%, ${t.softBg} 100%)`,
            border: `2px solid rgba(${rgb},.25)`,
            boxShadow: `0 8px 24px rgba(${rgb},.25), inset 0 2px 0 rgba(255,255,255,.9), inset 0 -2px 6px rgba(${rgb},.08)`,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={atual}
              initial={reduzido ? false : { scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 45, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              style={{ fontSize: 48, lineHeight: 1 }}
            >
              {linhas[atual]?.icone ?? "🔎"}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* altura fixa: sem ela, mensagens de tamanhos diferentes empurram a barra
          para cima e para baixo a cada troca */}
      <div className="mb-6 w-full max-w-[380px]" style={{ minHeight: 92 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={atual}
            initial={reduzido ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <h2 style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.2, color: cor, marginBottom: 8, letterSpacing: ".01em" }}>
              {linhas[atual]?.texto}
            </h2>
            <p style={{ fontSize: 15, color: t.muted, fontWeight: 500 }}>{legenda}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div
        initial={reduzido ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-5 w-full max-w-[320px]"
      >
        <div
          className="relative overflow-hidden"
          style={{
            height: 12, borderRadius: 999, background: `rgba(${rgb},.08)`,
            border: `1px solid rgba(${rgb},.12)`, boxShadow: "inset 0 2px 4px rgba(0,0,0,.04)",
          }}
        >
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="relative h-full"
            style={{
              background: `linear-gradient(90deg, ${cor} 0%, ${t.primaryDark} 50%, ${t.softBorder} 100%)`,
              borderRadius: 999, boxShadow: `0 2px 8px rgba(${rgb},.4)`,
            }}
          >
            {/* o brilho varrendo é o que mantém a barra viva entre um ponto
                percentual e o seguinte */}
            {!reduzido && (
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 top-0 h-full w-1/2"
                style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%)" }}
                aria-hidden
              />
            )}
          </motion.div>
        </div>

        <div className="mt-2.5 flex items-center justify-between px-0.5">
          <span style={{ fontSize: 12, color: t.muted, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Processando</span>
          <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: cor }}>{Math.round(pct)}%</span>
        </div>
      </motion.div>

      {pilulas ? (
      <motion.div
        initial={reduzido ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex max-w-[380px] flex-wrap justify-center gap-2"
      >
        {linhas.map((m, i) => {
          const aceso = i <= atual;
          return (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 transition-all"
              style={{
                padding: "6px 12px", borderRadius: 999,
                background: aceso ? `linear-gradient(135deg, rgba(${rgb},.12), rgba(${rgb},.18))` : "rgba(100,116,139,.08)",
                border: `1px solid ${aceso ? `rgba(${rgb},.35)` : "rgba(100,116,139,.18)"}`,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{m.icone ?? "•"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: aceso ? t.primaryDarker : t.muted }}>
                {m.texto.replace(/[.…]+$/, "").split(" ")[0].toUpperCase()}
              </span>
            </div>
          );
        })}
      </motion.div>
      ) : null}

      {/* CAIXAS — uma verificação por linha, marcando conforme a análise avança.
          Enquanto as pílulas dizem em que fase está, as caixas dizem O QUE foi
          verificado; por isso as duas podem conviver, e por isso a escolha é do
          construtor. */}
      {caixas ? (
        <div className="mt-1 w-full max-w-[380px] space-y-2.5">
          {linhas.map((m, i) => {
            const feita = i < atual || pct >= 100;
            const rodando = i === atual && pct < 100;
            return (
              <motion.div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,.06)]"
                animate={{ opacity: feita || rodando ? 1 : 0.45 }}
                transition={{ duration: 0.25 }}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `rgba(${rgb},.10)` }}>
                  {m.icone ?? "🔎"}
                </div>
                <p className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: t.text }}>{m.texto}</p>
                {feita ? (
                  <span className="shrink-0 text-lg leading-none" style={{ color: cor }}>✓</span>
                ) : rodando ? (
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: cor }}
                        animate={reduzido ? {} : { opacity: [0.25, 1, 0.25] }}
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
      ) : null}
    </div>
  );
}
