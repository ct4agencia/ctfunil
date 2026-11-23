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

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { prefereMenosMovimento } from "@/lib/quiz/motion";
import { clarear, fundoEscuroTema, gradienteTema, rgbDe } from "@/lib/quiz/resina";
// relógio da VSL: revela pelo tempo do VÍDEO, com queda para tempo de página
import { useRevelado } from "@/lib/quiz/relogio-vsl";
// leva utm/xcod/sck da página para o checkout
import { comRastreio } from "@/lib/quiz/rastreio";

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
  /**
   * Preview do construtor: os tempos de revelação são IGNORADOS. O canvas
   * existe para conferir layout, e obedecer o relógio esconderia o CTA, os
   * selos e a garantia inteira atrás de 16 minutos de espera — que foi
   * exatamente o que o Luca viu ao abrir a lâmina.
   */
  preview?: boolean;
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
  /**
   * Largura das imagens da lâmina, em % — o campo "Largura (%)" de cada bloco.
   *
   * A tela desenhava com `maxWidth` cravado (220px no selo, 280px nas formas de
   * pagamento) e ignorava o campo: mexer no slider do construtor não mudava
   * nada na tela. Cada imagem manda a sua; sem valor, cai no padrão de antes.
   */
  larguraGarantia?: number;
  larguraPagamentos?: number;
  /**
   * Corpo dos títulos, em px — o campo "Tamanho da fonte" de cada bloco de
   * texto. Mesma história das imagens: a tela cravava 24px nos dois títulos e o
   * campo do construtor não tinha efeito nenhum. Vazio = 24, como era.
   */
  tamanhoHeadline?: number;
  tamanhoGarantia?: number;
  garantiaTitulo?: string;
  garantiaImagem?: string;
  pagamentosImagem?: string;
  /**
   * Selos de confiança logo abaixo do 1º CTA. Sem imagem, desenho três em SVG
   * (compra segura, satisfação, privacidade) — são ícones genéricos, não marca
   * de terceiro, então dá para desenhá-los sem depender de arquivo.
   */
  /**
   * Provas de confiança, vindas do bloco `trust` da lâmina. `undefined` = a
   * lâmina não tem esse bloco, então NADA é desenhado.
   *
   * Antes eram desenhadas incondicionalmente aqui dentro: apareciam na página
   * sem existir em "Blocos desta lâmina", e não havia como remover nem editar
   * uma peça sequer. Quem decide agora é o construtor.
   */
  selos?: {
    seloGarantia: boolean;
    dias: number;
    bandeiras: boolean;
    selosConfianca: boolean;
    formas: string[];
    seguranca: string;
  };
  /** card explicativo da garantia, em HTML */
  garantiaTexto?: string;
  /** pílula abaixo do 2º CTA (ex.: "🔒 Garantia de 7 dias — risco zero") */
  garantiaChip?: string;
  /**
   * CTA repetido depois da garantia. A referência faz isso porque quem rolou
   * até aqui leu a garantia e está decidindo — obrigá-lo a subir de volta para
   * achar o botão é perder a venda no último metro.
   *
   * NÃO é mais um `boolean` que a tela decide sozinha: é o SEGUNDO bloco de
   * botão da lâmina. Antes a tela inventava este CTA, e duplicar o botão no
   * construtor criava um bloco que ela descartava em silêncio — o bloco existia
   * no painel, mas editá-lo não mudava nada na tela. Agora duplicar o botão É o
   * gesto que cria o segundo CTA, e ocultá-lo o remove.
   */
  ctaRepete?: { label: string; cor?: string; url: string } | null;
  /**
   * Blocos que entram LOGO ABAIXO do CTA e acima da garantia — hoje o ranking
   * de posição. Vêm prontos do runner porque se desenham sozinhos; a tela só
   * reserva o lugar, como já faz com o disclaimer em `topo`.
   */
  aposCta?: ReactNode;
  /**
   * Logo no topo, acima do player.
   *
   * Fica AQUI e não no header do funil porque a lâmina de VSL desliga o header
   * (`show_logo: false` no cdb-insta): a tela é cheia e escura, e o cabeçalho
   * claro do quiz brigaria com ela. Sem este campo, a marca simplesmente não
   * aparecia na página da oferta — que é onde ela mais precisa aparecer.
   */
  logo?: string;
  /** altura da logo em px (padrão 78) */
  logoAltura?: number;
  /** chamado no clique, antes de navegar — para o pixel */
  onCheckout?: () => void;
}

/** Os três selos da referência, em traço — sem dependência de arquivo. */
const SELOS = [
  {
    fraco: "Compra", forte: "Segura",
    d: (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" /></>),
  },
  {
    fraco: "Satisfação", forte: "Garantida",
    d: (<><circle cx="12" cy="10" r="6" /><path d="M9 15.5L8 22l4-2 4 2-1-6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 9.6l2-.3.9-1.8Z" /></>),
  },
  {
    fraco: "Privacidade", forte: "Protegida",
    d: (<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" /><circle cx="12" cy="15" r="1.6" /></>),
  },
];

/**
 * Selo de garantia DESENHADO — o medalhão dourado "7 DIAS".
 *
 * Existe porque a arte nunca chegou ao servidor e a seção da garantia ficava
 * com um buraco no lugar do selo. Vetor em vez de arquivo: nasce nítido em
 * qualquer tela, não pesa no carregamento e não some se alguém apagar o upload.
 * Assim que um bloco de imagem for adicionado à lâmina, ele vence este desenho.
 *
 * Dourado fixo, não derivado do tema: selo de garantia é convenção de mercado
 * (a pessoa reconhece antes de ler), e um medalhão azul-marinho não lê como
 * selo. Mesmo critério dos três ícones de confiança abaixo do CTA.
 */
function SeloGarantia({ dias = 7 }: { dias?: number }) {
  return (
    <svg viewBox="0 0 200 200" width="170" height="170" aria-label={`Garantia de ${dias} dias`} role="img">
      <defs>
        <linearGradient id="rv-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7d78a" />
          <stop offset="45%" stopColor="#e0a93c" />
          <stop offset="100%" stopColor="#b9781c" />
        </linearGradient>
      </defs>
      {/* serrilha da borda: traço pontilhado grosso, o jeito mais barato de
          sugerir um medalhão sem desenhar 40 dentes à mão */}
      <circle cx="100" cy="100" r="88" fill="none" stroke="url(#rv-ouro)" strokeWidth="10" strokeDasharray="5 9" strokeLinecap="round" />
      <circle cx="100" cy="100" r="76" fill="url(#rv-ouro)" />
      <circle cx="100" cy="100" r="66" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <text x="100" y="72" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="2.5" fill="#5a3908">GARANTIA</text>
      <text x="100" y="128" textAnchor="middle" fontSize="52" fontWeight="900" fill="#4a2f06">{dias}</text>
      <text x="100" y="150" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="3" fill="#5a3908">DIAS</text>
    </svg>
  );
}

export default function ResinaVSL({
  cor = "#0284c7", fundo, ctaCor,
  embedHtml, preview = false, cta, checkoutUrl, revelarEm = 0,
  textoEspera = "⏳ Assista o vídeo para liberar o acesso…",
  headline, alertas = [], topo,
  selosImagem, rodape, garantiaTitulo, garantiaImagem, pagamentosImagem,
  larguraGarantia, larguraPagamentos, tamanhoHeadline, tamanhoGarantia,
  selos, garantiaTexto, garantiaChip, ctaRepete, aposCta, logo, logoAltura, onCheckout,
}: ResinaVSLProps) {
  const reduzido = prefereMenosMovimento();
  /* Fundo, filete e CTA saem do TEMA — nada de hexadecimal cravado. Com tema
     verde, um fundo azul-marinho denunciaria que a paleta não governa a página.
     `fundo` sobrescreve: aceita URL de imagem, cor ou gradiente CSS. */
  const ehImagem = !!fundo && /^https?:\/\//i.test(fundo);
  const fundoFinal = ehImagem ? undefined : (fundo || fundoEscuroTema(cor));
  const filete = gradienteTema(cor);
  const verdeCta = ctaCor || "#16A34A";
  /* Gradiente do TÍTULO da garantia. `filete` não serve aqui: ele vai de
     escuro para médio — foi desenhado para a barrinha sobre fundo claro. Sobre
     o preto desta tela, recortado dentro do texto, some. Este vai do claro do
     tema ao branco e volta, então a frase brilha do meio para fora como na
     referência, e continua legível. */
  const gradTitulo = `linear-gradient(95deg, ${clarear(cor, 0.5)} 0%, #ffffff 45%, #ffffff 55%, ${clarear(cor, 0.5)} 100%)`;
  /* O CTA aparece pelo tempo do VÍDEO, não pelo tempo de página. Antes era um
     `setTimeout` desde a montagem: quem pausasse para atender o telefone via o
     botão de compra surgir antes do pitch — o oposto do que a revelação por
     tempo existe para fazer. Ver `relogio-vsl.ts`. */
  const mostraCta = useRevelado(revelarEm, preview);
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
    /* Os scripts injetados são MARCADOS e removidos no cleanup. Sem isso, cada
       montagem deixava mais um player no <head> — no construtor, alternar entre
       etapas acumulava players de vídeo até a aba morrer, e o sintoma era a
       página inteira não carregar. No site passava despercebido porque a lâmina
       monta uma vez só. */
    const injetados: HTMLScriptElement[] = [];
    el.querySelectorAll("script").forEach((antigo) => {
      const novoScript = document.createElement("script");
      for (const a of Array.from(antigo.attributes)) novoScript.setAttribute(a.name, a.value);
      if (!antigo.src) novoScript.textContent = antigo.textContent;
      novoScript.async = true;
      novoScript.dataset.resinaVsl = "1";
      document.head.appendChild(novoScript);
      injetados.push(novoScript);
      antigo.remove();
    });
    return () => {
      el.innerHTML = "";
      injetados.forEach((s) => s.remove());
    };
  }, [embedHtml]);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    return () => ts.forEach(clearTimeout);
  }, [revelarEm, preview]);

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
      {/* FUNDO ATÉ AS BORDAS DA JANELA.
          O gradiente pintado só neste container parava no `max-w` do funil, e
          nas laterais aparecia o `backgroundColor` do design — duas faixas mais
          escuras emoldurando a página, visíveis em qualquer tela mais larga que
          o container.
          Uma camada fixa atrás de tudo resolve sem mexer no layout: cobre a
          viewport inteira e não rola com o conteúdo. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background: fundoFinal,
          backgroundImage: ehImagem ? `url(${fundo})` : fundoFinal,
          backgroundSize: ehImagem ? "cover" : undefined,
          backgroundPosition: ehImagem ? "center" : undefined,
        }}
      />

      {topo}

      {/* LOGO — a marca antes do vídeo. Sobre fundo escuro ela precisa do
          próprio brilho, senão vira um retângulo apagado no topo. */}
      {logo ? (
        <div className="flex w-full justify-center px-5 pb-1 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo} alt="" fetchPriority="high" decoding="async"
            style={{ height: logoAltura || 78, width: "auto", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.45))" }}
          />
        </div>
      ) : null}

      {/* A chamada vem ANTES do player: ela diz o que assistir. Embaixo do
          vídeo só é lida por quem já assistiu — tarde demais para orientar. */}
      {headline ? (
        <div className="w-full px-5 pb-1 pt-7 text-center">
          <div className="mx-auto mb-4 h-[3px] w-[60px] rounded-sm" style={{ background: filete }} />
          <h2 className="mx-auto" style={{ fontWeight: 900, fontSize: tamanhoHeadline || 24, lineHeight: 1.25, color: "#fff", maxWidth: 420 }}>{headline}</h2>
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
          {/* Halo na cor do TEMA em volta do player. Sombra preta sobre fundo
              escuro é invisível: o que separa o vídeo do fundo é o brilho
              colorido, e ele precisa vir da paleta para acompanhar o tema. */}
          <div
            ref={playerRef}
            className="overflow-hidden rounded-2xl"
            style={{ boxShadow: `0 0 0 1px rgba(${rgbDe(cor)},.35), 0 18px 60px -12px rgba(${rgbDe(cor)},.55)` }}
          />
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
              /* NAVEGA PELO `href` DO ELEMENTO, não pela variável.
                 A UTMify reescreve o href deste link para anexar utm_source,
                 xcod, sck e companhia — é assim que ela liga a visita à venda.
                 A versão anterior fazia `window.location.href = checkoutUrl`,
                 ou seja, ia para a URL ORIGINAL e jogava fora tudo o que a
                 UTMify tinha escrito: a venda chegava na Hotmart sem dono e
                 nenhum evento era atribuído.
                 `currentTarget` é lido no instante do clique, então traz o que
                 houver sido anexado até ali. */
              const destino = e.currentTarget.getAttribute("href") || checkoutUrl;
              e.preventDefault();
              onCheckout?.();
              if (destino) window.location.href = comRastreio(destino);
            }}
            className={`mx-auto block w-full max-w-[360px] ${reduzido ? "" : "animate-cta-green"}`}
            style={{
              /* Menor que antes (era 19px/17px): no celular o CTA e os selos
                 empurravam o ranking para fora da primeira tela, e a escassez
                 que devia ser vista junto do botão ficava a uma rolagem de
                 distância. Continua com área de toque folgada. */
              padding: "15px 20px", borderRadius: 16, fontWeight: 800, fontSize: 15.5,
              letterSpacing: ".02em", textTransform: "uppercase", color: "#fff",
              textDecoration: "none",
              background: `linear-gradient(135deg, ${verdeCta} 0%, ${verdeCta}dd 50%, ${verdeCta}bb 100%)`,
              boxShadow: `0 10px 30px rgba(${rgbDe(verdeCta)},.4)`,
              // o halo pulsante lê estas duas — sem elas o keyframe cai no verde
              ["--cta-halo-soft" as string]: `rgba(${rgbDe(verdeCta)},.4)`,
              ["--cta-halo-strong" as string]: `rgba(${rgbDe(verdeCta)},.65)`,
            }}
          >
            {cta}
          </a>

          {pagamentosImagem ? (
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pagamentosImagem} alt="Formas de pagamento" loading="lazy" decoding="async" className="h-auto w-full"
                style={larguraPagamentos ? { width: `${larguraPagamentos}%` } : { maxWidth: 280 }} />
            </div>
          ) : selos?.selosConfianca ? (
            /* SELOS DE CONFIANÇA — desenhados, porque são ícones genéricos e não
               marca de terceiro. Ficam logo abaixo do CTA: é o instante em que a
               pessoa decide clicar e a dúvida é "isso é seguro?". */
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-3.5" style={{ color: "rgba(255,255,255,.55)" }}>
              {SELOS.map(({ d, forte, fraco }) => (
                <span key={forte} className="inline-flex items-center gap-1">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>{d}</svg>
                  <span className="text-left text-[9.5px] leading-tight">
                    {fraco}<br /><b className="text-white/80">{forte}</b>
                  </span>
                </span>
              ))}
            </div>
          ) : null}

          {/* FORMAS DE PAGAMENTO — logo abaixo dos selos, no mesmo instante da
              decisão: "consigo pagar do meu jeito?" vem junto de "isso é
              seguro?". Some quando a lâmina traz a arte real (2ª imagem). */}
          {!pagamentosImagem && selos?.bandeiras && selos.formas.length ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {selos.formas.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] font-bold tracking-wide"
                    style={{
                      borderRadius: 5, padding: "5px 8px",
                      background: "rgba(255,255,255,.07)",
                      border: "1px solid rgba(255,255,255,.16)",
                      color: "rgba(255,255,255,.72)",
                    }}
                  >{b}</span>
                ))}
              </div>
              {selos.seguranca ? (
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                  </svg>
                  {selos.seguranca}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : textoEspera ? (
        /* Vazio TIRA o aviso, em vez de cair no texto padrão. Nem toda VSL quer
           anunciar que há algo trancado — às vezes o silêncio segura melhor. */
        <p className="px-5 py-6 text-center text-sm" style={{ color: "rgba(255,255,255,.55)" }}>{textoEspera}</p>
      ) : null}

      {/* RANKING e afins — FORA do bloco do CTA, de propósito.
          Dentro dele, o ranking só existia depois que o botão aparecia, e o
          `revealAt` próprio dele não valia nada: marcar 12s contra 20s do botão
          não adiantava, os dois entravam juntos aos 20s.
          Fora, cada um obedece ao seu relógio — que é como o disclaimer do
          cdb-insta consegue entrar aos 973s com o botão só aos 1005s. */}
      {aposCta ? <div className="w-full px-5 pt-6">{aposCta}</div> : null}

      {mostraCta && (garantiaTitulo || garantiaImagem || garantiaTexto || selos?.seloGarantia) ? (
        <div className="w-full px-5 pb-7 pt-10 text-center" style={{ animation: reduzido ? undefined : "fade-in-up .6s ease-out .15s both" }}>
          <div className="mx-auto mb-8 h-[3px] w-[60px] rounded-sm" style={{ background: filete, opacity: 0.5 }} />
          {garantiaTitulo ? (
            /* Título em GRADIENTE recortado no texto, como na referência: sobre
               fundo escuro ele brilha sem precisar de caixa em volta. */
            <h2
              className="mx-auto mb-8"
              style={{
                fontWeight: 900, fontSize: tamanhoGarantia || 24, lineHeight: 1.25, maxWidth: 420,
                background: gradTitulo, WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}
            >{garantiaTitulo}</h2>
          ) : null}
          {garantiaImagem ? (
            <div className="mx-auto" style={larguraGarantia ? { width: `${larguraGarantia}%` } : { width: "100%", maxWidth: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={garantiaImagem} alt="Garantia" loading="lazy" decoding="async" className="h-auto w-full"
                style={{ filter: `drop-shadow(0 8px 24px rgba(${rgbDe(cor)},.35))` }} />
            </div>
          ) : selos?.seloGarantia ? (
            /* Sem imagem na lâmina, o medalhão é desenhado — mas só se o bloco
               `trust` pedir. Uma imagem sempre vence o desenho. */
            <div className="flex justify-center" style={{ filter: "drop-shadow(0 8px 24px rgba(224,169,60,.3))" }}>
              <SeloGarantia dias={selos.dias} />
            </div>
          ) : null}

          {/* CARD dos termos da garantia — o texto que tira o risco da decisão */}
          {garantiaTexto ? (
            <div
              className="mx-auto mt-7 text-left text-sm leading-relaxed"
              style={{
                maxWidth: 420, borderRadius: 16, padding: "20px 18px",
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "rgba(255,255,255,.82)",
              }}
              dangerouslySetInnerHTML={{ __html: garantiaTexto }}
            />
          ) : null}

          {/* 2º CTA — quem rolou até aqui leu a garantia e está decidindo;
              mandá-lo subir de volta para achar o botão é perder a venda no
              último metro. */}
          {ctaRepete ? (
            <a
              href={ctaRepete.url}
              /* mesmo motivo do CTA principal: o href pode ter sido reescrito
                 pela UTMify, e a variável não acompanha */
              onClick={(e) => {
                const destino = e.currentTarget.getAttribute("href") || ctaRepete.url;
                e.preventDefault();
                onCheckout?.();
                if (destino) window.location.href = comRastreio(destino);
              }}
              className={`mx-auto mt-7 block w-full max-w-[360px] ${reduzido ? "" : "animate-cta-green"}`}
              style={{
                padding: "19px 24px", borderRadius: 16, fontWeight: 800, fontSize: 17,
                letterSpacing: ".02em", textTransform: "uppercase", color: "#fff", textDecoration: "none",
                background: ctaRepete.cor || `linear-gradient(135deg, ${verdeCta} 0%, ${verdeCta} 50%, ${verdeCta} 100%)`,
                boxShadow: `0 10px 30px ${ctaRepete.cor || verdeCta}66`,
                ["--cta-halo-soft" as string]: `${ctaRepete.cor || verdeCta}66`,
                ["--cta-halo-strong" as string]: `${ctaRepete.cor || verdeCta}a6`,
              }}
            >{ctaRepete.label}</a>
          ) : null}

          {garantiaChip ? (
            <div className="mt-4 flex justify-center">
              <span
                className="inline-flex items-center gap-2 text-xs"
                style={{
                  borderRadius: 9999, padding: "8px 16px",
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.14)",
                  color: "rgba(255,255,255,.75)",
                }}
                dangerouslySetInnerHTML={{ __html: garantiaChip }}
              />
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
              <Link href="/termos" style={{ color: "rgba(255,255,255,.55)" }}>Termos de Uso</Link>
              <Link href="/privacidade" style={{ color: "rgba(255,255,255,.55)" }}>Políticas de Privacidade</Link>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
