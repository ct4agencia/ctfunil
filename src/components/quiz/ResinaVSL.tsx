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
 * O CTA não existe no começo — aparece depois de N
 * segundos de página, quando o pitch do vídeo já passou. Botão visível desde o
 * primeiro quadro convida a clicar antes de ouvir a oferta, e quem chega ao
 * checkout sem contexto não compra.
 *
 * O embed é HTML de player (VTurb) colado pelo admin no construtor, rota
 * protegida por ADMIN_EMAIL — daí injetá-lo cru ser aceitável aqui. Mesmo
 * precedente do `EmbedBlock`.
 *
 * Medidas de `Velas-Lucrativas/funil/src/components/steps/StepVSL.tsx`.
 */

import { useEffect, useRef, useState } from "react";
import { prefereMenosMovimento } from "@/lib/quiz/motion";
import { fundoEscuroTema, gradienteTema, rgbDe } from "@/lib/quiz/resina";

export interface ResinaVSLProps {
  /** cor do tema — governa fundo e filete quando não há sobrescrita */
  cor?: string;
  /** fundo próprio da lâmina: URL de imagem, cor ou gradiente CSS. Vazio deriva do tema. */
  fundo?: string;
  /**
   * Cor do CTA. Vazio mantém o VERDE de confirmação: verde significa
   * "comprar/confirmado" em qualquer paleta, e um botão de checkout na cor de
   * um tema vermelho leria como alerta. Decisão combinada com o Luca — os
   * demais botões seguem o tema, este é a exceção deliberada.
   */
  ctaCor?: string;
  /** HTML do player, como vem do construtor */
  embedHtml: string;
  cta: string;
  checkoutUrl: string;
  /** segundos até revelar o CTA; 0 mostra desde o início */
  revelarEm?: number;

  textoEspera?: string;
  /** chamada ACIMA do player — diz o que assistir antes de o vídeo começar */
  headline?: string;
  /**
   * Blocos de ALERTA da lâmina, em HTML, renderizados entre a chamada e o
   * player. Antes esta tela lia só 5 tipos de bloco e DESCARTAVA o resto: um
   * alerta criado no construtor aparecia lá e sumia no site, sem aviso.
   */
  alertas?: string[];
  /**
   * Faixa(s) fixa(s) no topo — os blocos `disclaimer` da lâmina, já
   * renderizados. Eles se desenham sozinhos (fundo, tempo de revelação e
   * contador ficam no bloco), então esta tela só os posiciona.
   */
  topo?: React.ReactNode;
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
  cor = "#0284c7", fundo, ctaCor,
  embedHtml, cta, checkoutUrl, revelarEm = 0,
  textoEspera = "⏳ Assista o vídeo para liberar o acesso…",
  headline, alertas = [], topo,
  selosImagem, rodape, garantiaTitulo, garantiaImagem, pagamentosImagem, onCheckout,
}: ResinaVSLProps) {
  const reduzido = prefereMenosMovimento();
  /* Fundo, filete e CTA saem do TEMA — nada de hexadecimal cravado. Com tema
     verde, um fundo azul-marinho denunciaria que a paleta não governa a página.
     `fundo` sobrescreve: aceita URL de imagem, cor ou gradiente CSS. */
  const ehImagem = !!fundo && /^https?:\/\//i.test(fundo);
  const fundoFinal = ehImagem ? undefined : (fundo || fundoEscuroTema(cor));
  const filete = gradienteTema(cor);
  const verdeCta = ctaCor || "#16A34A";
  const [mostraCta, setMostraCta] = useState(revelarEm <= 0);
  /**
   * `dangerouslySetInnerHTML` NÃO executa <script> — é regra do React, e por
   * isso o player aparecia como um retângulo preto: o placeholder do VTurb
   * entrava no DOM, mas o script que o transforma em player nunca rodava.
   * Setar innerHTML e recriar cada <script> à mão é a única forma de o
   * navegador executá-los. Mesma técnica do `EmbedBlock` (blocks.tsx:471), que
   * já serve o vídeo nos outros funis.
   */
  const playerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = playerRef.current;
    if (!el || !embedHtml) return;
    el.innerHTML = embedHtml;
    el.querySelectorAll("script").forEach((antigo) => {
      const novoScript = document.createElement("script");
      for (const a of Array.from(antigo.attributes)) novoScript.setAttribute(a.name, a.value);
      if (!antigo.src) novoScript.textContent = antigo.textContent;
      novoScript.async = true;
      document.head.appendChild(novoScript);
      antigo.remove();
    });
    return () => { el.innerHTML = ""; };
  }, [embedHtml]);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    if (revelarEm > 0) ts.push(setTimeout(() => setMostraCta(true), revelarEm * 1000));
    return () => ts.forEach(clearTimeout);
  }, [revelarEm]);

  return (
    <div
      // margens negativas anulam o padding do <main>: o fundo escuro precisa
      // sangrar até a borda, senão fica uma faixa clara em volta
      className="-mx-5 -my-6 flex w-[calc(100%+2.5rem)] flex-col items-center"
      style={{
        minHeight: "100dvh",
        background: fundoFinal,
        backgroundImage: ehImagem ? `url(${fundo})` : fundoFinal,
        backgroundSize: ehImagem ? "cover" : undefined,
        backgroundPosition: ehImagem ? "center" : undefined,
      }}
    >
      {topo}

      {/* A chamada vem ANTES do player: ela diz o que assistir. Embaixo do
          vídeo só é lida por quem já assistiu — tarde demais para orientar. */}
      {headline ? (
        <div className="w-full px-5 pb-1 pt-7 text-center">
          <div className="mx-auto mb-4 h-[3px] w-[60px] rounded-sm" style={{ background: filete }} />
          <h2 className="mx-auto" style={{ fontWeight: 900, fontSize: 24, lineHeight: 1.25, color: "#fff", maxWidth: 420 }}>{headline}</h2>
        </div>
      ) : null}

      {/* ALERTAS da lâmina — entram entre a chamada e o player. Esta tela lia
          só embed, botão, texto e imagem, e o resto era descartado em silêncio:
          um alerta criado no construtor aparecia lá e sumia no site. Fundo
          escuro, então o cartão claro do bloco comum não serviria aqui. */}
      {alertas.length ? (
        <div className="flex w-full flex-col gap-2.5 px-5 pt-5">
          {alertas.map((html, i) => (
            <div
              key={i}
              className="mx-auto w-full text-center text-sm font-bold"
              style={{
                maxWidth: 400, borderRadius: 14, padding: "12px 16px",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.14)",
                color: "#F5C842",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ))}
        </div>
      ) : null}

      <div className="w-full px-5 pb-4 pt-6">
        <div className="mx-auto w-full" style={{ maxWidth: 400 }}>
          <div ref={playerRef} className="overflow-hidden rounded-2xl shadow-2xl" />
        </div>
      </div>

      {mostraCta ? (
        <div className="w-full px-5 pb-3 pt-7 text-center" style={{ animation: reduzido ? undefined : "fade-in-up .6s ease-out" }}>
          <a
            href={checkoutUrl}
            /* O href sozinho não estava navegando (só "abrir em nova aba"
               funcionava), então a ida ao checkout passa a ser explícita —
               mesmo `window.location.href` que o `navigate` do runner usa para
               destino externo. O href fica: é ele que permite abrir em outra
               aba, copiar o link e ser lido como link de verdade. */
            onClick={(e) => {
              e.preventDefault();
              onCheckout?.();
              if (checkoutUrl) window.location.href = checkoutUrl;
            }}
            className={`mx-auto block w-full max-w-[360px] ${reduzido ? "" : "animate-cta-green"}`}
            style={{
              padding: "19px 24px", borderRadius: 16, fontWeight: 800, fontSize: 17,
              letterSpacing: ".02em", textTransform: "uppercase", color: "#fff",
              textDecoration: "none",
              background: `linear-gradient(135deg, ${verdeCta} 0%, ${verdeCta}dd 50%, ${verdeCta}bb 100%)`,
              boxShadow: `0 10px 30px rgba(${rgbDe(verdeCta)},.4)`,
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
          <div className="mx-auto mb-4 h-[3px] w-[60px] rounded-sm" style={{ background: filete }} />
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
