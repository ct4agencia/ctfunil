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
  /** chamada ACIMA do player — diz o que assistir antes de o vídeo começar */
  headline?: string;
  /** selos de confiança do rodapé (ex.: "Google Site Seguro") */
  selosImagem?: string;
  rodape?: string;
  garantiaTitulo?: string;
  garantiaImagem?: string;
  pagamentosImagem?: string;
  /** chamado no clique, antes de navegar — para o pixel */
  onCheckout?: () => void;
}

export default function ResinaVSL({
  embedHtml, cta, checkoutUrl, revelarEm = 0, vagasEm = 0, vagasTexto,
  textoEspera = "⏳ Assista o vídeo para liberar o acesso…",
  headline, selosImagem, rodape, garantiaTitulo, garantiaImagem, pagamentosImagem, onCheckout,
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

      {/* A chamada vem ANTES do player: ela diz o que assistir. Embaixo do
          vídeo só é lida por quem já assistiu — tarde demais para orientar. */}
      {headline ? (
        <div className="w-full px-5 pb-1 pt-7 text-center">
          <div className="mx-auto mb-4 h-[3px] w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #E8A838, #F5C842)" }} />
          <h2 className="mx-auto" style={{ fontWeight: 900, fontSize: 24, lineHeight: 1.25, color: "#fff", maxWidth: 420 }}>{headline}</h2>
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

      {/* RODAPÉ — selo de confiança, razão social e os links legais. Numa página
          que pede cartão, a ausência disso é notada mesmo sem ser lida: é o que
          separa "página de venda" de "site". */}
      {selosImagem || rodape ? (
        <div className="mt-auto w-full px-5 pb-8 pt-10">
          <div className="mx-auto w-full" style={{ maxWidth: 480, borderTop: "1px solid rgba(255,255,255,.10)" }}>
            <div className="flex justify-center pt-7">
              {selosImagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selosImagem} alt="Site seguro" loading="lazy" decoding="async" className="h-auto w-full" style={{ maxWidth: 200 }} />
              ) : (
                /* Selo "Google Site Seguro" desenhado em SVG, como no print
                   que o Luca mandou. Vetor e não imagem: o rodapé é escuro, e um
                   PNG de fundo branco apareceria como um retângulo aceso ali.
                   Passando `selosImagem`, o arquivo real assume o lugar. */
                <span className="inline-flex items-center gap-2.5" aria-label="Google Site Seguro">
                  <svg width="34" height="38" viewBox="0 0 34 38" fill="none" aria-hidden>
                    <path d="M17 1.5 32 7v12.5C32 28.6 25.6 35.6 17 37.5 8.4 35.6 2 28.6 2 19.5V7l15-5.5Z" fill="#34A853" />
                    <circle cx="17" cy="24" r="3.4" fill="#fff" />
                    <path d="M9.6 13.4a11.4 11.4 0 0 1 14.8 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                    <path d="M12.6 17.6a7.2 7.2 0 0 1 8.8 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                  <span className="flex flex-col leading-none">
                    <span style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-.02em" }}>
                      <span style={{ color: "#4285F4" }}>G</span>
                      <span style={{ color: "#EA4335" }}>o</span>
                      <span style={{ color: "#FBBC05" }}>o</span>
                      <span style={{ color: "#4285F4" }}>g</span>
                      <span style={{ color: "#34A853" }}>l</span>
                      <span style={{ color: "#EA4335" }}>e</span>
                    </span>
                    <span style={{ fontSize: 11, marginTop: 3, color: "rgba(255,255,255,.55)", letterSpacing: ".04em" }}>Site Seguro</span>
                  </span>
                </span>
              )}
            </div>
            {rodape ? (
              <p className="mt-4 whitespace-pre-line text-center text-xs leading-relaxed" style={{ color: "rgba(255,255,255,.45)" }}>{rodape}</p>
            ) : null}
            <p className="mt-3 flex justify-center gap-5 text-xs">
              <a href="/termos" style={{ color: "rgba(255,255,255,.55)" }}>Termos de Uso</a>
              <a href="/privacidade" style={{ color: "rgba(255,255,255,.55)" }}>Políticas de Privacidade</a>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
