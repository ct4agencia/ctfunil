"use client";

/**
 * HERO no formato da referência (artedaresina.com.br).
 *
 * O ARRANJO, que é o que distingue esta tela
 * Medalhão com emoji e aura pulsante → headline com um trecho em CÁPSULA (não
 * só colorido: fundo em degradê, texto branco, sombra) → filete divisor →
 * subtexto → um card claro que contém um CARD ESCURO com o nome do produto e um
 * chip de valor → carrossel com dots → CTA com brilho que varre.
 *
 * O card-dentro-do-card é o "sub card" que o Luca apontou nos prints. Não é
 * enfeite: ele separa a promessa (texto claro) do produto (bloco escuro), e é o
 * que faz o nome do produto virar âncora visual em vez de mais uma linha.
 *
 * Puro: recebe textos e imagens, devolve `onAvancar`. Sem Supabase, sem
 * tracking, sem navegação — igual `ResinaQuiz` e `Diagnostico`, para os dois
 * motores compartilharem a MESMA tela.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepHero.tsx`, com as
 * cores derivadas por `lib/quiz/resina.ts`.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { tokensResina, rgbDe } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface ResinaHeroProps {
  cor: string;
  emoji?: string;
  /** headline; o trecho igual a `capsula` sai dentro da cápsula em degradê */
  titulo: string;
  capsula?: string;
  subtexto?: string;
  /** texto do card claro, antes do bloco escuro */
  cardTexto?: string;
  /** o que vai dentro do card ESCURO — o nome do produto */
  produto?: string;
  /** texto do card claro, depois do bloco escuro */
  cardTextoFim?: string;
  /** destaque monetário, sai no chip verde */
  valor?: string;
  imagens?: string[];
  cta: string;
  /** CTA como PNG clicável (padrão inlead). Presente, substitui o botão estilizado. */
  ctaImagem?: string;
  rodape?: string;
  onAvancar: () => void;
}

/** Troca de slide do carrossel. 2,2 s é o da referência: rápido o bastante para
 *  mostrar variedade, lento o bastante para a imagem ser vista. */
const SLIDE_MS = 2200;

export default function ResinaHero({
  cor, emoji, titulo, capsula, subtexto, cardTexto, produto, cardTextoFim,
  valor, imagens = [], cta, ctaImagem, rodape, onAvancar,
}: ResinaHeroProps) {
  const t = tokensResina(cor);
  const rgb = rgbDe(cor);
  const reduzido = prefereMenosMovimento();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (imagens.length < 2) return;
    const iv = setInterval(() => setSlide((s) => (s + 1) % imagens.length), SLIDE_MS);
    return () => clearInterval(iv);
  }, [imagens.length]);

  const corte = capsula ? titulo.indexOf(capsula) : -1;
  const antes = corte >= 0 ? titulo.slice(0, corte) : titulo;
  const depois = corte >= 0 && capsula ? titulo.slice(corte + capsula.length) : "";

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center px-5 pb-6 pt-7" style={{ color: t.text }}>
      {/* MEDALHÃO — aura pulsante atrás de um disco claro com o emoji.
          Vem do bloco CHECK; sem o bloco, a tela começa direto na headline. */}
      {emoji ? (
      <motion.div
        initial={reduzido ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
        className="relative mb-5 text-center"
      >
        <motion.div
          animate={reduzido ? {} : { scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(${rgb},0.28) 0%, transparent 70%)` }}
        />
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full"
          style={{
            background: `linear-gradient(145deg, #ffffff 0%, ${t.softBg} 100%)`,
            border: `2px solid rgba(${rgb},0.25)`,
            boxShadow: `0 4px 20px rgba(${rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.8)`,
          }}
        >
          <motion.span
            animate={reduzido ? {} : { scale: [1, 1.15, 1], rotateZ: [0, -5, 5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            style={{ fontSize: 30, lineHeight: 1 }}
          >
            {emoji}
          </motion.span>
        </div>
      </motion.div>
      ) : null}

      <motion.div
        initial={reduzido ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mx-auto mb-5 w-full text-center"
        style={{ maxWidth: 440 }}
      >
        {/* `pre-line` para o título respeitar as quebras que vêm no texto. A
            headline da referência é escrita em linhas de tamanho parecido, e
            deixar o navegador quebrar sozinho produz uma linha órfã de uma
            palavra — que é o que mais denuncia headline não trabalhada. */}
        <h1 style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.2, letterSpacing: "0.02em", color: cor, textTransform: "uppercase", marginBottom: 14, whiteSpace: "pre-line" }}>
          {antes}
          {corte >= 0 ? (
            // CÁPSULA — fundo em degradê e texto branco. Só colorir a palavra
            // não produz o mesmo efeito: é o bloco preenchido que puxa o olho.
            <span
              style={{
                background: t.gradienteCta, color: "#fff", padding: "2px 10px 4px",
                borderRadius: 8, display: "inline-block", marginTop: 4, fontSize: 31,
                boxShadow: `0 2px 12px rgba(${rgb},0.35)`,
              }}
            >{capsula}</span>
          ) : null}
          {depois}
        </h1>

        <div className="mx-auto mb-3.5 h-[3px] w-12 rounded-sm" style={{ background: t.gradienteCta, opacity: 0.7 }} />

        {subtexto ? (
          <p className="mb-4 px-1" style={{ fontSize: 15, color: t.muted, lineHeight: 1.65 }}>{subtexto}</p>
        ) : null}

        {cardTexto || produto || cardTextoFim ? (
          <div
            className="relative overflow-hidden"
            style={{
              background: `linear-gradient(160deg, rgba(${rgb},0.06) 0%, ${t.softBg} 30%, rgba(255,255,255,0.98) 100%)`,
              borderRadius: 20, padding: "22px 14px 24px",
              border: `1.5px solid rgba(${rgb},0.18)`,
              boxShadow: `0 4px 24px rgba(${rgb},0.10), 0 1px 3px rgba(15,23,42,0.04)`,
            }}
          >
            {/* filete no topo do card — assina a caixa sem precisar de título */}
            <div className="absolute left-1/2 top-0 h-[3px] w-[60px] -translate-x-1/2 rounded-b-[3px]" style={{ background: t.gradienteCta }} />

            {cardTexto ? (
              <p className="mb-4" style={{ fontSize: 15, color: t.text, lineHeight: 1.55 }}>{cardTexto}</p>
            ) : null}

            {produto ? (
              // SUB-CARD ESCURO — separa o produto da promessa e vira a âncora
              // visual do bloco.
              <div
                className="mb-4"
                style={{
                  background: `linear-gradient(145deg, ${t.primaryDarker} 0%, ${t.primaryDark} 100%)`,
                  borderRadius: 14, padding: "14px 16px 16px",
                  boxShadow: `0 4px 16px rgba(${rgb},0.30)`,
                }}
              >
                <p style={{ fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1.2 }}>{produto}</p>
              </div>
            ) : null}

            {cardTextoFim ? (
              <p style={{ fontSize: 15, color: t.text, lineHeight: 1.7 }}>
                {cardTextoFim}
                {valor ? (
                  <>
                    {" "}
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center",
                        background: "linear-gradient(135deg, rgba(22,163,74,0.10), rgba(52,211,153,0.18))",
                        border: "1.5px solid rgba(22,163,74,0.30)", borderRadius: 8,
                        padding: "2px 10px 3px", fontWeight: 800, fontSize: 17, color: "#15803D",
                      }}
                    >{valor}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}
      </motion.div>

      {imagens.length ? (
        <>
          <motion.div
            initial={reduzido ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="relative mx-auto mb-3.5 w-full overflow-hidden"
            style={{
              maxWidth: 320, aspectRatio: "4 / 5", borderRadius: 18,
              boxShadow: `0 20px 50px -10px rgba(${rgb},0.38), 0 10px 25px -5px rgba(${rgb},0.28)`,
              border: `1px solid rgba(${rgb},0.20)`,
              background: `linear-gradient(135deg, ${t.softBg} 0%, #ffffff 100%)`,
            }}
          >
            {imagens.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i} src={src} alt="" decoding="async"
                loading={i === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: i === slide ? 1 : 0, transition: "opacity .5s ease" }}
              />
            ))}
          </motion.div>

          {imagens.length > 1 ? (
            <div className="mb-7 flex flex-wrap justify-center gap-1.5">
              {imagens.map((_, i) => (
                <button
                  key={i} onClick={() => setSlide(i)} aria-label={`Imagem ${i + 1}`}
                  className="h-2 rounded-sm border-0 p-0"
                  style={{
                    // o ativo vira uma BARRA, não um ponto maior: a diferença de
                    // forma lê mais rápido que a de tamanho
                    width: i === slide ? 20 : 8,
                    background: i === slide ? t.gradienteCta : `rgba(${rgb},0.22)`,
                    transition: "all .35s cubic-bezier(.4,0,.2,1)",
                  }}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {ctaImagem ? (
        /* CTA como PNG clicável: o botão É a arte. Sem moldura, sem degradê e
           sem sombra por baixo — qualquer um dos três brigaria com o desenho
           que já vem na imagem. */
        <motion.img
          src={ctaImagem} alt={cta} onClick={onAvancar}
          initial={reduzido ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.96 }}
          decoding="async"
          className={`mx-auto block w-full cursor-pointer select-none ${reduzido ? "" : "fx-pulse"}`}
          style={{ maxWidth: 260 }}
        />
      ) : (
      <motion.button
        initial={reduzido ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileTap={{ scale: 0.96 }}
        onClick={onAvancar}
        className={`relative w-full overflow-hidden ${reduzido ? "" : "fx-pulse"}`}
        style={{
          maxWidth: 360, padding: "19px 24px", background: t.gradienteCta, color: "#fff",
          border: "none", borderRadius: 16, fontWeight: 800, fontSize: 17,
          letterSpacing: "0.02em", boxShadow: `0 4px 30px rgba(${rgb},0.40)`,
          textShadow: "0 1px 2px rgba(0,0,0,.20)",
        }}
      >
        {reduzido ? null : (
          <span aria-hidden className="fx-shine pointer-events-none absolute left-0 top-0 h-full w-3/5"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.45) 50%, transparent 100%)" }} />
        )}
        <span className="relative z-[1]">{cta}</span>
      </motion.button>
      )}

      {rodape ? <p className="mt-7 text-center text-xs" style={{ color: t.muted }}>{rodape}</p> : null}
    </div>
  );
}
