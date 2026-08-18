"use client";

/**
 * CAPTURA no formato da referência — a tela que converte.
 *
 * O QUE ELA FAZ DIFERENTE DE UM FORMULÁRIO
 * Um formulário pede dados. Esta tela primeiro ENTREGA: pílula de presente,
 * headline de reconhecimento, e o mockup do material flutuando com selo GRÁTIS
 * e brilhos ao redor. Só depois aparece o aviso de "vou mandar no WhatsApp" e
 * então os campos. A ordem é o argumento — pedir o telefone antes de mostrar o
 * que a pessoa ganha inverte a troca.
 *
 * O mockup tem três camadas de movimento sobrepostas, e cada uma faz uma coisa:
 * a entrada com inclinação (-12° → -3°) dá a impressão de objeto pousando; o
 * flutuar contínuo mantém a peça viva sem pedir atenção; os brilhos em ritmos
 * diferentes evitam que o conjunto pulse em bloco.
 *
 * Puro: devolve `{nome, telefone}` em `onEnviar`. Quem chama grava o lead,
 * dispara pixel e navega — este componente não conhece Supabase.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepCapture.tsx`.
 */

import { useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { tokensResina, rgbDe } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface ResinaCapturaProps {
  cor: string;
  selo?: string;
  titulo?: string;
  destaque?: string;
  subtexto?: string;
  imagem?: string;
  /** aviso do card de filete dourado, acima do formulário */
  aviso?: string;
  formTitulo?: string;
  rotuloNome?: string;
  rotuloTelefone?: string;
  cta: string;
  enviando?: boolean;
  onEnviar: (d: { nome: string; telefone: string }) => void;
}

/** (11) 91234-5678 — a máscara acompanha o que já foi digitado, sem travar
 *  o campo enquanto o número está incompleto. */
function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

const BRILHOS = [
  { e: "✨", cls: "-top-3 -left-4 text-2xl sm:text-3xl", dur: 2.8, atraso: 0, giro: 20 },
  { e: "✨", cls: "top-8 -right-5 text-xl sm:text-2xl", dur: 2.4, atraso: 0.6, giro: -15 },
  { e: "⭐", cls: "-bottom-2 left-2 text-xl sm:text-2xl", dur: 3.2, atraso: 1.2, giro: 25 },
  { e: "💫", cls: "top-1/2 -right-7 text-base sm:text-lg", dur: 2.6, atraso: 1.8, giro: 0 },
];

export default function ResinaCaptura({
  cor, selo, titulo, destaque, subtexto, imagem, aviso, formTitulo,
  rotuloNome = "Como você gostaria que eu te chamasse?",
  rotuloTelefone = "Seu WhatsApp (com DDD)",
  cta, enviando = false, onEnviar,
}: ResinaCapturaProps) {
  const t = tokensResina(cor);
  const rgb = rgbDe(cor);
  const reduzido = prefereMenosMovimento();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [focado, setFocado] = useState<string | null>(null);

  // 10 dígitos = fixo com DDD, 11 = celular. Menos que isso não é telefone.
  const valido = nome.trim().length >= 2 && tel.replace(/\D/g, "").length >= 10;

  const corte = destaque && titulo ? titulo.indexOf(destaque) : -1;
  const campo = (id: string): CSSProperties => ({
    width: "100%", padding: "13px 15px", fontSize: 16, borderRadius: 12,
    border: `2px solid ${focado === id ? cor : t.softBorder}`,
    background: "#fff", outline: "none", transition: "border-color .2s", color: t.text,
  });
  const rotulo: CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
    color: t.muted, display: "block", marginBottom: 6,
  };

  return (
    <div className="flex w-full flex-col gap-5 py-3">
      <div className="flex flex-col items-center gap-4 text-center">
        {selo ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-white sm:text-sm"
            style={{ background: cor, border: `1px solid ${t.softBorder}`, boxShadow: `0 4px 16px rgba(${rgb},.4)` }}
          >{selo}</span>
        ) : null}

        {titulo ? (
          <p className="px-1 text-[22px] font-bold leading-tight md:text-2xl" style={{ color: t.text, whiteSpace: "pre-line" }}>
            {corte >= 0 && destaque ? (
              <>{titulo.slice(0, corte)}<span style={{ color: cor }}>{destaque}</span>{titulo.slice(corte + destaque.length)}</>
            ) : titulo}
          </p>
        ) : null}

        {subtexto ? (
          <p className="px-1 text-base leading-relaxed md:text-lg" style={{ color: t.muted }}>{subtexto}</p>
        ) : null}
      </div>

      {imagem ? (
        <div className="relative flex justify-center py-4 sm:py-6">
          <div className="relative inline-block">
            {!reduzido && BRILHOS.map((b, i) => (
              <motion.span
                key={i} className={`pointer-events-none absolute z-20 ${b.cls}`}
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6], rotate: [0, b.giro, 0] }}
                transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut", delay: b.atraso }}
              >{b.e}</motion.span>
            ))}

            <motion.div
              animate={reduzido ? {} : { y: [0, -10, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <motion.div
                initial={reduzido ? false : { opacity: 0, scale: 0.7, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: reduzido ? 0 : -3 }}
                transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
                className="relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagem} alt="" loading="eager" decoding="async"
                  className="relative h-auto w-72 rounded-2xl sm:w-80"
                  style={{ filter: `drop-shadow(0 20px 40px rgba(${rgb},.45)) drop-shadow(0 8px 16px rgba(0,0,0,.25))` }}
                />
                {/* SELO GRÁTIS — inclinado e com halo pulsando. A inclinação é o
                    que o separa de um rótulo colado no canto. */}
                <motion.div
                  initial={reduzido ? false : { scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 12 }}
                  transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.5 }}
                  className="absolute -right-3 -top-3 z-10 sm:-right-4 sm:-top-4"
                >
                  <div className="relative">
                    {!reduzido && (
                      <motion.div
                        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-emerald-400 blur-md" aria-hidden
                      />
                    )}
                    <div className="relative rounded-full border-2 border-white bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 px-4 py-2 text-xs font-black tracking-wider text-white shadow-xl sm:text-sm">
                      GRÁTIS
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* reflexo elíptico: ancora a peça no chão, senão ela parece recortada */}
            <div
              className="pointer-events-none absolute -bottom-3 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-full"
              style={{ background: `radial-gradient(ellipse, rgba(${rgb},.35) 0%, transparent 70%)`, filter: "blur(8px)" }}
              aria-hidden
            />
          </div>
        </div>
      ) : null}

      {aviso ? (
        <div
          className="p-4"
          style={{
            background: "#FEFCE8", borderRadius: 16,
            border: `1px solid ${t.softBorder}`, borderLeft: "4px solid #F9D14A",
            boxShadow: t.sombraCard,
          }}
        >
          <p className="text-sm leading-relaxed sm:text-base" style={{ color: t.text }}>{aviso}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5 p-5" style={{ background: "#fff", borderRadius: 16, border: `1px solid ${t.softBorder}`, boxShadow: t.sombraCard }}>
        {formTitulo ? (
          <h3 className="text-center text-base font-bold md:text-lg" style={{ color: t.primaryDarker }}>{formTitulo}</h3>
        ) : null}
        <div>
          <label htmlFor="rq-nome" style={rotulo}>{rotuloNome}</label>
          <input
            id="rq-nome" type="text" placeholder="Digite seu nome..." value={nome}
            onChange={(e) => setNome(e.target.value)}
            onFocus={() => setFocado("nome")} onBlur={() => setFocado(null)}
            autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false}
            style={campo("nome")}
          />
        </div>
        <div>
          <label htmlFor="rq-tel" style={rotulo}>{rotuloTelefone}</label>
          {/* Prefixo +55 fixo ao lado do campo, não dentro dele. Dentro, o lead
              apaga sem querer ao limpar o campo; fora, ele é um rótulo — deixa
              claro que o número é brasileiro sem virar caractere digitável. */}
          <div
            className="flex items-stretch overflow-hidden"
            style={{ border: `2px solid ${focado === "tel" ? cor : t.softBorder}`, borderRadius: 12, background: "#fff", transition: "border-color .2s" }}
          >
            <span
              className="flex shrink-0 items-center gap-1.5 px-3 text-base font-semibold"
              style={{ background: t.softBg, color: t.primaryDarker, borderRight: `1px solid ${t.softBorder}` }}
            >
              <span aria-hidden>🇧🇷</span>+55
            </span>
            <input
              id="rq-tel" type="tel" placeholder="(00) 00000-0000" value={tel}
              onChange={(e) => setTel(mascaraTelefone(e.target.value))}
              onFocus={() => setFocado("tel")} onBlur={() => setFocado(null)}
              // `inputMode=tel` abre o teclado numérico no celular; sem ele o lead
              // digita telefone no teclado de texto
              autoComplete="tel" inputMode="tel"
              style={{ ...campo("tel"), border: "none", borderRadius: 0 }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onEnviar({ nome: nome.trim(), telefone: tel })}
        disabled={!valido || enviando}
        className={`w-full uppercase ${valido && !enviando && !reduzido ? "fx-pulse" : ""}`}
        style={{
          padding: "19px 24px", border: "none", borderRadius: 16, fontWeight: 800,
          fontSize: 16, letterSpacing: ".02em", minHeight: 56,
          color: valido ? "#fff" : "#94a3b8",
          background: valido ? t.gradienteCta : "#e2e8f0",
          boxShadow: valido ? t.sombraCta : "none",
          cursor: valido && !enviando ? "pointer" : "not-allowed",
        }}
      >
        {enviando ? "Enviando…" : cta}
      </button>

      <p className="text-center text-xs" style={{ color: t.muted }}>
        🔒 Seus dados estão protegidos e nunca serão compartilhados
      </p>
    </div>
  );
}
