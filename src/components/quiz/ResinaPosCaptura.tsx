"use client";

/**
 * PÓS-CAPTURA — a confirmação, no formato da referência.
 *
 * O PAPEL DESTA TELA
 * O lead acabou de entregar o telefone e não recebeu nada ainda. Esta tela
 * fecha o ciclo: confirma que deu certo (check que se desenha), avisa o que
 * vai acontecer, e — o mais importante — pede a ÚNICA ação de que a entrega
 * depende: responder a mensagem. Sem esse pedido explícito, a apostila fica
 * presa na janela de 24h do WhatsApp.
 *
 * O CARD COM SUB-CARD
 * O bloco "Ahhh, quase ia esquecendo…" carrega dentro dele uma caixa menor com
 * a fala pessoal da professora. É o "sub card" que o Luca apontou nos prints.
 * A hierarquia é o recado: o card externo é a professora falando; a caixa
 * interna é a frase que ela quer que fique.
 *
 * Puro: recebe textos e o nome já capturado, devolve `onAvancar`.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepPostCapture.tsx`.
 */

import { motion } from "motion/react";
import { tokensResina } from "@/lib/quiz/resina";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface ResinaPosCapturaProps {
  cor: string;
  /** desenha o selo de confirmação no topo; vem do bloco CHECK da lâmina */
  check?: boolean;
  /** nome do lead; entra em negrito no começo do texto */
  nome?: string;
  titulo?: string;
  texto?: string;
  /** aviso de filete dourado */
  alerta?: string;
  recadoTitulo?: string;
  recadoTexto?: string;
  /** a frase que fica dentro do sub-card */
  recadoDestaque?: string;
  recadoFim?: string;
  chamada?: string;
  cta: string;
  onAvancar: () => void;
}

const OK = "#16A34A";
const OK_ESC = "#15803D";

export default function ResinaPosCaptura({
  cor, check = false, nome, titulo = "Pronto!", texto, alerta, recadoTitulo, recadoTexto,
  recadoDestaque, recadoFim, chamada, cta, onAvancar,
}: ResinaPosCapturaProps) {
  const t = tokensResina(cor);
  const reduzido = prefereMenosMovimento();

  return (
    <div className="flex w-full flex-col gap-5 py-3">
      <div className="flex flex-col items-center gap-2.5 text-center">
        {check ? (
        <motion.div
          initial={reduzido ? false : { scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
          className="relative h-16 w-16 sm:h-20 sm:w-20"
        >
          {/* Duas ondas com atraso entre si: uma só lê como piscada, duas leem
              como sinal repetindo — que é o que "confirmado" precisa parecer. */}
          {!reduzido && [0, 0.6].map((d, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, i ? 1.6 : 1.4, 1], opacity: [i ? 0.3 : 0.45, 0, i ? 0.3 : 0.45] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: d }}
              className="absolute inset-0 rounded-full"
              style={{ background: OK }}
              aria-hidden
            />
          ))}
          <div
            className="relative grid h-full w-full place-items-center rounded-full"
            style={{ background: `linear-gradient(135deg, ${OK} 0%, ${OK_ESC} 100%)`, boxShadow: t.sombraCardLg }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden>
              {/* o traço se DESENHA: o gesto de marcar é o que confirma, não o
                  símbolo já pronto */}
              <motion.path
                d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"
                initial={reduzido ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
              />
            </svg>
          </div>
        </motion.div>
        ) : null}

        <h2 className="text-[28px] font-black sm:text-3xl md:text-4xl" style={{ color: t.primaryDarker }}>{titulo}</h2>

        {texto ? (
          <p className="px-1 text-[15px] leading-relaxed sm:px-2 md:text-lg" style={{ color: t.text }}>
            {nome ? <strong>{nome}</strong> : null}{nome ? ", " : ""}
            <span dangerouslySetInnerHTML={{ __html: texto }} />
          </p>
        ) : null}
      </div>

      {alerta ? (
        <div
          className="flex gap-3 p-4"
          style={{ background: "#FEFCE8", borderRadius: 16, border: `1px solid ${t.softBorder}`, borderLeft: "4px solid #F9D14A", boxShadow: t.sombraCard }}
        >
          <span className="shrink-0 text-2xl">🚨</span>
          <p className="text-sm leading-relaxed" style={{ color: t.text }}>{alerta}</p>
        </div>
      ) : null}

      {recadoTitulo || recadoTexto ? (
        <div
          className="flex flex-col gap-3 p-5"
          style={{ background: "#fff", borderRadius: 16, border: `1px solid ${t.softBorder}`, borderLeft: `4px solid ${cor}`, boxShadow: t.sombraCard }}
        >
          {recadoTitulo ? <h3 className="text-base font-bold" style={{ color: t.primaryDarker }}>{recadoTitulo}</h3> : null}
          {recadoTexto ? <div className="text-sm leading-relaxed md:text-base" style={{ color: t.text }} dangerouslySetInnerHTML={{ __html: recadoTexto }} /> : null}

          {recadoDestaque ? (
            // SUB-CARD: fundo claro do tema, sem borda. A diferença de fundo já
            // separa — pôr borda aqui criaria uma caixa dentro de outra caixa e
            // a hierarquia viraria ruído.
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: t.softBg }}>
              <span className="text-2xl">❤️</span>
              <p className="text-sm font-medium" style={{ color: t.primaryDarker }}>{recadoDestaque}</p>
            </div>
          ) : null}

          {recadoFim ? <p className="text-sm leading-relaxed" style={{ color: t.muted }}>{recadoFim}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3 pt-1 text-center">
        {chamada ? <p className="text-base font-bold md:text-lg" style={{ color: t.primaryDarker }}>{chamada}</p> : null}
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
    </div>
  );
}
