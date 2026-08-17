"use client";

/**
 * RESULTADO — o veredito com nota, no formato da referência.
 *
 * NÃO É O `Diagnostico.tsx`
 * Aquele é a ESPERA: caixas que acendem uma a uma enquanto algo é "analisado".
 * Este é o VEREDITO: um número que sobe até a nota e para. Um comunica trabalho
 * em curso, o outro comunica um resultado alcançado — e é por isso que aqui o
 * anel é grande e o número domina a tela, em vez de dividir espaço com uma
 * lista.
 *
 * A contagem de 0 até a nota não é enfeite: ver o valor subir e PARAR num
 * número alto é o que faz a nota parecer conquistada. Um "94%" que já aparece
 * pronto lê como rótulo.
 *
 * Puro: recebe textos e devolve `onAvancar`.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepResult.tsx`.
 */

import { useEffect, useState } from "react";
import { tokensResina } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface ResinaResultadoProps {
  cor: string;
  /** a nota que o anel persegue */
  nota?: number;
  /** nota mínima citada no texto de reforço; ausente, a linha não aparece */
  minimo?: number;
  imagem?: string;
  titulo?: string;
  /** trecho do título que sai no chip verde */
  destaque?: string;
  reforco?: string;
  aprovacaoTitulo?: string;
  aprovacaoTexto?: string;
  cta: string;
  onAvancar: () => void;
}

/** Verde de aprovação. Fixo de propósito: "aprovado" é verde em qualquer
 *  paleta, e derivá-lo do tema faria a cor do tema significar duas coisas. */
const OK = "#16A34A";
const OK_ESC = "#15803D";

export default function ResinaResultado({
  cor, nota = 94, minimo, imagem, titulo, destaque, reforco,
  aprovacaoTitulo, aprovacaoTexto, cta, onAvancar,
}: ResinaResultadoProps) {
  const t = tokensResina(cor);
  const reduzido = prefereMenosMovimento();
  const [pct, setPct] = useState(reduzido ? nota : 0);

  useEffect(() => {
    if (reduzido) return;                     // quem pediu menos movimento vê a nota pronta
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setPct(Math.min(i, nota));
      if (i >= nota) clearInterval(id);
    }, 35);                                    // 35ms × 2 pontos ≈ 1,6s até 94
    return () => clearInterval(id);
  }, [nota, reduzido]);

  // r=76 num viewBox de 180 deixa margem para os 14px de traço sem clipar.
  const R = 76, PERIM = 2 * Math.PI * R;

  const corte = destaque && titulo ? titulo.indexOf(destaque) : -1;
  const chip = (txt: string) => (
    <strong style={{ background: "rgba(34,197,94,0.20)", color: OK_ESC, padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>{txt}</strong>
  );

  return (
    <div className="flex w-full flex-col gap-5 py-3">
      {imagem ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt="" loading="eager" decoding="async" className="h-40 w-auto drop-shadow-xl sm:h-48 md:h-56" />
        </div>
      ) : null}

      {titulo ? (
        <p className="px-1 text-center text-lg leading-relaxed sm:px-2 md:text-xl" style={{ color: t.text }}>
          {corte >= 0 && destaque ? (
            <>{titulo.slice(0, corte)}{chip(destaque)}{titulo.slice(corte + destaque.length)}</>
          ) : titulo}
        </p>
      ) : null}

      <div className="flex justify-center py-2 sm:py-4">
        <div className="relative h-44 w-44 sm:h-52 sm:w-52">
          {/* halo desfocado: separa o anel do fundo sem precisar de moldura */}
          <div className="absolute inset-3 rounded-full blur-2xl sm:inset-4" style={{ background: "rgba(22,163,74,.10)" }} aria-hidden />
          <svg className="relative h-full w-full -rotate-90" viewBox="0 0 180 180" aria-hidden>
            <circle cx="90" cy="90" r={R} fill="none" stroke={t.softBorder} strokeWidth="14" />
            <circle
              cx="90" cy="90" r={R} fill="none" stroke="url(#grad-ok)" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={PERIM} strokeDashoffset={PERIM - (pct / 100) * PERIM}
              style={{ transition: "stroke-dashoffset .4s ease" }}
            />
            <defs>
              <linearGradient id="grad-ok" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={OK} />
                <stop offset="100%" stopColor="#22C55E" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black leading-none tabular-nums sm:text-6xl" style={{ color: t.text }}>
              {pct}<span className="text-2xl sm:text-3xl">%</span>
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: OK }}>Compatível</span>
          </div>
        </div>
      </div>

      {reforco || minimo ? (
        <div className="flex flex-col gap-1.5 px-1 text-center">
          {reforco ? (
            <p className="text-lg font-extrabold leading-snug sm:text-xl md:text-2xl" style={{ color: t.text }}>
              {reforco}
            </p>
          ) : null}
          {minimo ? (
            <p className="text-base leading-relaxed sm:text-lg" style={{ color: "#DC2626" }}>
              O mínimo necessário era <strong>{minimo}%</strong>, e você foi muito além!!!
            </p>
          ) : null}
        </div>
      ) : null}

      {aprovacaoTitulo || aprovacaoTexto ? (
        // Card com FILETE À ESQUERDA — a barra vertical verde marca o bloco como
        // veredito favorável antes de o texto ser lido.
        <div
          className="flex items-start gap-3 p-4 sm:p-5"
          style={{
            background: "#fff", borderRadius: 16,
            border: `1px solid ${t.softBorder}`, borderLeft: `4px solid ${OK}`,
            boxShadow: t.sombraCard,
          }}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(22,163,74,.10)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" className="h-5 w-5" aria-hidden>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            {aprovacaoTitulo ? <h3 className="text-lg font-bold sm:text-xl" style={{ color: OK }}>{aprovacaoTitulo}</h3> : null}
            {aprovacaoTexto ? <p className="text-base leading-snug" style={{ color: t.muted }}>{aprovacaoTexto}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        onClick={onAvancar}
        className={`w-full uppercase ${reduzido ? "" : "fx-pulse"}`}
        style={{
          padding: "19px 24px", background: t.gradienteCta, color: "#fff", border: "none",
          borderRadius: 16, fontWeight: 800, fontSize: 16, letterSpacing: ".02em",
          boxShadow: t.sombraCta, minHeight: 56,
        }}
      >
        {cta}
      </button>
    </div>
  );
}
