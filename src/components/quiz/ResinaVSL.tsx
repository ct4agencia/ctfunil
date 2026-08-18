"use client";

/**
 * VSL no formato da referência — a única tela escura do funil.
 *
 * POR QUE ESCURA
 * Todas as outras telas são claras. Aqui o vídeo é o assunto, e fundo claro em
 * volta de um player rouba contraste dele. A inversão também marca a passagem:
 * o quiz acabou, começou a oferta.
 *
 * A REVELAÇÃO POR TEMPO
 * O CTA e a barra de vagas não existem no começo — aparecem depois de N
 * segundos de página, quando o pitch do vídeo já passou. Botão visível desde o
 * primeiro quadro convida a clicar antes de ouvir a oferta, e quem chega ao
 * checkout sem contexto não compra.
 *
 * `dangerouslySetInnerHTML` no player é intencional: o embed é HTML de player
 * (VTurb) colado pelo admin no construtor, que é rota protegida por
 * ADMIN_EMAIL. Mesmo precedente do `EmbedBlock`.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepVSL.tsx`.
 */

import { useEffect, useState } from "react";
import { prefereMenosMovimento } from "@/lib/quiz/motion";

export interface ResinaVSLProps {
  /** HTML do player, como vem do construtor */
  embedHtml: string;
  cta: string;
  checkoutUrl: string;
  /** segundos até revelar o CTA; 0 mostra desde o início */
  revelarEm?: number;
  /** segundos até revelar a barra de vagas */
  vagasEm?: number;
  vagasTexto?: string;
  textoEspera?: string;
  garantiaTitulo?: string;
  garantiaImagem?: string;
  pagamentosImagem?: string;
  /** chamado no clique, antes de navegar — para o pixel */
  onCheckout?: () => void;
}

export default function ResinaVSL({
  embedHtml, cta, checkoutUrl, revelarEm = 0, vagasEm = 0, vagasTexto,
  textoEspera = "⏳ Assista o vídeo para liberar o acesso…",
  garantiaTitulo, garantiaImagem, pagamentosImagem, onCheckout,
}: ResinaVSLProps) {
  const reduzido = prefereMenosMovimento();
  const [mostraCta, setMostraCta] = useState(revelarEm <= 0);
  const [mostraVagas, setMostraVagas] = useState(vagasEm <= 0 && !!vagasTexto);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    if (revelarEm > 0) ts.push(setTimeout(() => setMostraCta(true), revelarEm * 1000));
    if (vagasEm > 0 && vagasTexto) ts.push(setTimeout(() => setMostraVagas(true), vagasEm * 1000));
    return () => ts.forEach(clearTimeout);
  }, [revelarEm, vagasEm, vagasTexto]);

  return (
    <div
      // margens negativas anulam o padding do <main>: o fundo escuro precisa
      // sangrar até a borda, senão fica uma faixa clara em volta
      className="-mx-5 -my-6 flex w-[calc(100%+2.5rem)] flex-col items-center"
      style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #0b2033 0%, #123047 40%, #0b2033 100%)" }}
    >
      {mostraVagas && vagasTexto ? (
        <div className="w-full px-5 py-3.5 text-center" style={{ background: "rgba(0,0,0,.35)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <p className="m-0 text-[15px] font-extrabold" style={{ color: "#D6C1AD" }}>
            <span style={{ background: "linear-gradient(90deg, #E8A838, #F5C842)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {vagasTexto}
            </span>
          </p>
        </div>
      ) : null}

      <div className="w-full px-5 pb-4 pt-6">
        <div className="mx-auto w-full" style={{ maxWidth: 400 }}>
          <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
        </div>
      </div>

      {mostraCta ? (
        <div className="w-full px-5 pb-3 pt-7 text-center" style={{ animation: reduzido ? undefined : "fade-in-up .6s ease-out" }}>
          <a
            href={checkoutUrl}
            onClick={onCheckout}
            className={`mx-auto block w-full max-w-[360px] ${reduzido ? "" : "animate-cta-green"}`}
            style={{
              padding: "19px 24px", borderRadius: 16, fontWeight: 800, fontSize: 17,
              letterSpacing: ".02em", textTransform: "uppercase", color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, #16A34A 0%, #22C55E 50%, #34D399 100%)",
              boxShadow: "0 10px 30px rgba(5,150,105,.4)",
            }}
          >
            {cta}
          </a>

          {pagamentosImagem ? (
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pagamentosImagem} alt="Formas de pagamento" loading="lazy" decoding="async" className="h-auto w-full" style={{ maxWidth: 280 }} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 py-6 text-center text-sm" style={{ color: "rgba(255,255,255,.55)" }}>{textoEspera}</p>
      )}

      {garantiaTitulo || garantiaImagem ? (
        <div className="w-full px-5 pb-7 pt-10 text-center" style={{ animation: reduzido ? undefined : "fade-in-up .6s ease-out .15s both" }}>
          <div className="mx-auto mb-4 h-[3px] w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #E8A838, #F5C842)" }} />
          {garantiaTitulo ? (
            <h2 className="mb-5" style={{ fontWeight: 900, fontSize: 24, lineHeight: 1.25, color: "#fff" }}>{garantiaTitulo}</h2>
          ) : null}
          {garantiaImagem ? (
            <div className="mx-auto w-full" style={{ maxWidth: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={garantiaImagem} alt="Garantia" loading="lazy" decoding="async" className="h-auto w-full" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
