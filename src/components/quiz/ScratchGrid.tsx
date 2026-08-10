"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ScratchStep, ScratchCard } from "@/lib/quiz/types";
import { StepShell, RichText, useEdit } from "./ui";
import { interp, type StepCtx } from "./steps";
import { playWin, playUrl } from "@/lib/quiz/sound";

/**
 * Raspadinha em GRADE (N cards) — espelha o painel de prêmios da roleta.
 *
 * Mecânica (decisão do Luca, 2026-07):
 *  - cada card tem copy, cor, PESO e popup próprio;
 *  - o prêmio é sorteado por PESO (100 = "viciado", sempre cai nele) e
 *    atribuído ao card que a lead raspar — igual à roleta, que sempre para na
 *    fatia escolhida. Ela decide QUAL raspar; o prêmio é o sorteado;
 *  - raspou `revealPct` da capa → revela aquele card e abre o POPUP;
 *  - fechando o popup, os demais cards se revelam com os prêmios restantes;
 *  - o botão final vai pro `ctaUrl` (WhatsApp) ou avança a lâmina se vazio.
 */

/**
 * PADRÃO DE FÁBRICA — copiado do `premio-sonia`, que é a raspadinha de
 * referência. Toda lâmina que não define um campo cai aqui, então uma
 * raspadinha nova já nasce com o efeito do funil que roda em produção.
 * Campo gravado na lâmina SEMPRE vence: mudar isto não altera funil existente
 * que já tenha o valor.
 */
const VERDE_PREMIO = "#16a34a";      // card do prêmio ganho
const CINZA_PERDEDOR = "#919191";    // cards que não saíram
const PADRAO = {
  /** % da capa que precisa ser raspada para revelar */
  revealPct: 80,
  /** imagem 16:9 em tela 9:16: ancorar no topo preserva a arte de cima (logo) */
  bgPosition: "top center",
  coverColor: "#f7e08a",
  coverColor2: "#c08c1e",
  coverText: "RASPE AQUI 🔥",
  coverTextColor: "#4a1c05",
  coverTextSize: 50,
} as const;

const CW = 300, CH = 150;             // resolução do canvas de cada card
const COLS_GRID = 12, ROWS_GRID = 8;  // grade de cobertura (não usa getImageData)

/** Sorteio por peso. Peso 100 num card e 0 nos outros = sempre esse card. */
function pickByWeight(cards: ScratchCard[]): number {
  const w = cards.map((c) => Math.max(0, Number(c.weight ?? 0)));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * cards.length); // sem peso = sorteio justo
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i;
  }
  return w.findIndex((x) => x > 0);
}

/** Logo do WhatsApp (inline: sem request externo, não depende de CDN). */
function WhatsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16.04 4C9.96 4 5.02 8.94 5.02 15.02c0 1.94.51 3.83 1.47 5.5L5 27.2l6.85-1.8a11 11 0 0 0 4.19.83h.01c6.07 0 11.01-4.94 11.01-11.02C27.06 8.94 22.12 4 16.04 4Zm0 20.2h-.01a9.1 9.1 0 0 1-4.64-1.27l-.33-.2-3.44.9.92-3.35-.22-.34a9.15 9.15 0 0 1-1.4-4.88c0-5.05 4.11-9.16 9.17-9.16 2.45 0 4.75.96 6.48 2.69a9.1 9.1 0 0 1 2.68 6.48c0 5.05-4.11 9.13-9.16 9.13Zm5.03-6.84c-.28-.14-1.63-.8-1.88-.9-.25-.09-.44-.13-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.16-.43-2.21-1.37-.82-.73-1.37-1.62-1.53-1.9-.16-.27-.02-.42.12-.56.13-.13.28-.32.42-.49.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.49-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.35-.25.28-.96.94-.96 2.29s.98 2.66 1.12 2.84c.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.25.18 1.72.11.53-.08 1.63-.66 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33Z" />
    </svg>
  );
}

/** Botão de resgate: verde WhatsApp, com a logo e pulsando pra puxar o clique. */
function BotaoWhats({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-extrabold text-white shadow-lg"
      style={{ background: "#25D366", boxShadow: "0 10px 30px rgba(37,211,102,.45)" }}
      animate={{ scale: [1, 1.035, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      whileTap={{ scale: 0.97 }}
    >
      <WhatsIcon />
      <span>{children}</span>
    </motion.button>
  );
}

/** Um card raspável. Avisa o pai quando passa do limiar. */
function Card({
  card, cover, cover2, coverGradiente, coverText, coverTextColor, coverTextSize,
  revealPct, revealed, disabled, destaque, destaqueBg, destaqueText, opacidadePerdedor, pulsarAntes,
  onFirstTouch, onReveal,
}: {
  card: ScratchCard;
  cover: string;
  /** 2ª cor do degradê (só quando coverGradiente) */
  cover2: string;
  coverGradiente: boolean;
  coverText: string;
  coverTextColor: string;
  coverTextSize: number;
  revealPct: number;
  revealed: boolean;
  disabled: boolean;
  /** é o prêmio que ela ganhou: fundo sólido + pulso */
  destaque: boolean;
  /** cor do card em destaque (vazio = cor do próprio prêmio) */
  destaqueBg?: string;
  destaqueText?: string;
  /** opacidade (0-1) dos cards NÃO premiados depois da revelação */
  opacidadePerdedor: number;
  /** antes de raspar TODOS pulsam (chama pro toque); depois só o premiado */
  pulsarAntes: boolean;
  /** 1º toque neste card: trava a escolha ANTES de revelar qualquer coisa */
  onFirstTouch: () => void;
  onReveal: () => void;
}) {
  /**
   * Cor do card revelado. O fallback é SEMÂNTICO, não o tema: prêmio ganho é
   * verde e prêmio perdido é cinza — é o que o `premio-sonia` faz gravando
   * `#16a34a` / `#919191` em cada card. Caindo em `var(--q-primary)`, uma
   * raspadinha criada sem escolher cor pintava o vencedor de laranja.
   */
  const corDestaque = destaqueBg || card.color || VERDE_PREMIO;
  const corTexto = destaqueText || "#ffffff";
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const cells = useRef<Set<number>>(new Set());
  const fired = useRef(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    // capa: SÓLIDA por padrão. O degradê fixo pra cinza fazia a cor escolhida
    // no construtor nunca aparecer como ela é.
    if (coverGradiente) {
      const grad = g.createLinearGradient(0, 0, CW, CH);
      grad.addColorStop(0, cover);
      grad.addColorStop(1, cover2);
      g.fillStyle = grad;
    } else {
      g.fillStyle = cover;
    }
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = coverTextColor;
    g.textAlign = "center";
    g.font = `bold ${coverTextSize}px Poppins, system-ui, sans-serif`;

    // QUEBRA DE LINHA automática: com fonte grande (ex.: 50px) o texto estourava
    // a largura do card e era cortado ("ASPE AQUI"). Emoji entra no próprio
    // texto e quebra junto, como qualquer palavra.
    const maxW = CW * 0.86;
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of coverText.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (g.measureText(teste).width > maxW && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    if (atual) linhas.push(atual);

    const alturaLinha = coverTextSize * 1.15;
    const topo = CH / 2 - ((linhas.length - 1) * alturaLinha) / 2 + coverTextSize * 0.35;
    linhas.forEach((l, i) => g.fillText(l, CW / 2, topo + i * alturaLinha));
  }, [cover, cover2, coverGradiente, coverText, coverTextColor, coverTextSize]);

  // revelado por fora (os "outros" cards, depois do popup): limpa a capa
  useEffect(() => {
    if (revealed) ref.current?.getContext("2d")?.clearRect(0, 0, CW, CH);
  }, [revealed]);

  const at = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return [((t.clientX - r.left) * CW) / r.width, ((t.clientY - r.top) * CH) / r.height];
  };

  const erase = (x: number, y: number) => {
    if (fired.current || disabled) return;
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.fill();
    const gx = Math.floor((x / CW) * COLS_GRID), gy = Math.floor((y / CH) * ROWS_GRID);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = gx + dx, cy = gy + dy;
        if (cx >= 0 && cx < COLS_GRID && cy >= 0 && cy < ROWS_GRID) cells.current.add(cy * COLS_GRID + cx);
      }
    }
    if (cells.current.size / (COLS_GRID * ROWS_GRID) >= revealPct) {
      fired.current = true;
      onReveal();
    }
  };

  const down = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    // ESCOLHA no 1º toque: o prêmio é sorteado e fixado AQUI, antes de raspar.
    // Antes a escolha só acontecia ao completar a raspagem, então dava pra
    // raspar um pouco de vários cards, ver os prêmios nas posições originais
    // e depois ver tudo trocar de lugar — spoiler + contradição.
    onFirstTouch();
    drawing.current = true;
    const [x, y] = at(e);
    erase(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => { if (!drawing.current) return; const [x, y] = at(e); erase(x, y); };
  const up = () => { drawing.current = false; };

  return (
    <motion.div
      className="relative w-full rounded-xl"
      // z-50 no premiado: fica ACIMA do escurecimento da tela (z-40), criando o
      // efeito de holofote — só ele e o botão de redirect ficam iluminados.
      style={{ aspectRatio: `${CW} / ${CH}`, zIndex: destaque ? 50 : 1 }}
      // ANTES de raspar: todos pulsam (convida ao toque).
      // DEPOIS: só o premiado continua pulsando; os outros param e recuam.
      animate={destaque || pulsarAntes ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={destaque || pulsarAntes ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl px-2 text-center"
        style={
          destaque
            ? {
                // vencedor: cor SÓLIDA (configurável) + brilho na mesma cor
                background: corDestaque,
                border: `3px solid ${corDestaque}`,
                boxShadow: `0 0 0 4px ${corDestaque}33, 0 12px 32px ${corDestaque}66`,
              }
            : {
                background: "var(--q-bg-soft)",
                border: `2px solid ${card.color || CINZA_PERDEDOR}`,
                // perdedores desbotam pra o ganho saltar aos olhos (% configurável)
                opacity: revealed ? opacidadePerdedor : 1,
                filter: revealed ? "saturate(.6)" : "none",
              }
        }
      >
        {card.emoji ? <span className="text-2xl leading-none">{card.emoji}</span> : null}
        <span
          className={`mt-0.5 leading-tight font-black ${destaque ? "text-lg" : "text-base"}`}
          style={{ color: destaque ? corTexto : card.color || CINZA_PERDEDOR }}
        >
          {card.label}
        </span>
        {destaque ? (
          <span
            className="mt-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: corTexto }}
          >
            seu prêmio
          </span>
        ) : null}
      </div>
      {!revealed ? (
        <canvas
          ref={ref}
          width={CW}
          height={CH}
          className="absolute inset-0 h-full w-full touch-none rounded-xl"
          style={{ cursor: disabled ? "not-allowed" : "grab" }}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
        />
      ) : null}
    </motion.div>
  );
}

export default function ScratchGrid({ step, ctx }: { step: ScratchStep; ctx: StepCtx }) {
  // Clique-para-editar do construtor: as outras lâminas usam isso via <Title>
  // (steps.tsx:79). Sem isso, clicar no título/subtítulo no preview não abria o
  // campo no painel — parecia que a lâmina "não dava pra editar".
  const { editing, onEdit } = useEdit();
  const edit = (campo: string) =>
    editing ? (e: React.MouseEvent) => { e.stopPropagation(); onEdit?.(campo); } : undefined;
  const editavel = editing ? "cursor-pointer rounded-md ring-2 ring-transparent transition hover:bg-blue-50/40 hover:ring-blue-400/60" : "";

  // Lâmina legada (sem `cards`) continua funcionando com prize/prizeEmoji.
  const cards = useMemo<ScratchCard[]>(() => {
    if (step.cards?.length) return step.cards;
    return [{
      label: step.prize ?? "PRÊMIO",
      emoji: step.prizeEmoji,
      popupTitle: step.winTitle,
      popupBody: step.winBody,
    }];
  }, [step]);

  const revealPct = Math.min(0.9, Math.max(0.05, Number(step.revealPct ?? PADRAO.revealPct) / 100));
  const cols = Math.min(4, Math.max(1, Number(step.columns ?? 2)));
  const lockKey = `ctf_scratch_${ctx.funnelSlug}_${step.id}`;

  /** Estado único da lâmina: qual prêmio saiu, em qual card, e em que fase.
   *  raspando = já escolheu o card (1º toque) e está raspando; os outros travam
   *  popup    = atingiu o limiar, prêmio revelado
   *  todos    = os demais cards também aparecem (por baixo do popup) */
  type Estado = { prize: number; pos: number; fase: "raspando" | "popup" | "todos" };
  const [estado, setEstado] = useState<Estado | null>(null);
  /** espelho síncrono do estado: o updater do setEstado roda depois, e o
   *  onReveal precisa saber o prêmio NA HORA pra disparar som/confete/trava. */
  const estadoRef = useRef<Estado | null>(null);
  const prizeIdx = estado?.prize ?? null;
  const openedPos = estado?.pos ?? null;
  // popupEnabled desligado: revela os cards, destaca o prêmio, solta confete e
  // som do mesmo jeito — só não mostra o painel flutuante.
  const popup = estado?.fase === "popup" && (step.popupEnabled ?? true);
  /** Só revela DEPOIS de raspar de verdade. Na fase "raspando" o card escolhido
   *  continua coberto — a lead precisa raspar pra revelar. (Bug: como openedPos
   *  passou a ser definido já no 1º toque, usar `pos === openedPos` aqui fazia
   *  o card limpar inteiro no clique, sem sensação de raspagem.) */
  const revelado = estado !== null && estado.fase !== "raspando";

  // 1 raspagem por dispositivo: restaura o estado já revelado (nunca no preview).
  // Precisa ser em effect (ler localStorage no render divergiria do SSR e
  // quebraria a hidratação) — mesmo padrão do lockReplay da roleta, steps.tsx:205.
  useEffect(() => {
    if (ctx.preview || !step.oncePerDevice) return;
    try {
      const raw = localStorage.getItem(lockKey);
      if (!raw) return;
      const s = JSON.parse(raw) as { prize: number; pos: number };
      if (typeof s?.prize === "number" && typeof s?.pos === "number") {
        const novo = { prize: s.prize, pos: s.pos, fase: "todos" as const };
        estadoRef.current = novo;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurar estado persistido; roda 1x
        setEstado(novo);
      }
    } catch { /* storage bloqueado: segue normal */ }
  }, [lockKey, step.oncePerDevice, ctx.preview]);

  /** 1º toque: fixa o card escolhido e SORTEIA o prêmio na hora. A partir daqui
   *  os outros cards ficam travados — é isso que elimina o spoiler. */
  const onFirstTouch = useCallback((pos: number) => {
    if (estadoRef.current) return; // já escolheu: ignora toque nos outros
    const novo = { prize: pickByWeight(cards), pos, fase: "raspando" as const };
    estadoRef.current = novo;
    setEstado(novo);
  }, [cards]);

  const onReveal = useCallback((pos: number) => {
    // `ref` em vez do updater do setEstado: o callback do setEstado roda DEPOIS
    // (é assíncrono), então ler `idx` na linha seguinte devolvia -1 e o guard
    // abortava som, confete e trava. O ref é lido na hora.
    const jaRevelou = estadoRef.current && estadoRef.current.fase !== "raspando";
    if (jaRevelou) return;
    const idx = estadoRef.current?.prize ?? pickByWeight(cards);
    const novo = { prize: idx, pos, fase: "popup" as const };
    estadoRef.current = novo;
    setEstado(novo);

    // Som e confete RODAM no preview: são justamente o que se ajusta no
    // construtor, e não deixam rastro. Só a trava por dispositivo fica de fora
    // (senão o 1º teste no construtor queimaria a raspagem do próprio editor).
    if (step.sound?.enabled) { if (step.sound.winUrl) playUrl(step.sound.winUrl); else playWin(); }
    // CONFETE acima de tudo. A própria lib aceita `zIndex` — tentei criar um
    // canvas manual com create() e o confete parou de aparecer; esta é a
    // chamada simples, que funciona, com o z-index no topo da pilha.
    if (step.confete ?? true) {
      import("canvas-confetti").then((m) => {
        const opts = { zIndex: 2147483647, disableForReducedMotion: true };
        m.default({ ...opts, particleCount: 160, spread: 100, origin: { y: 0.25 } });
        setTimeout(() => m.default({ ...opts, particleCount: 120, spread: 120, origin: { y: 0.35 } }), 250);
      }).catch(() => {});
    }
    if (!ctx.preview && step.oncePerDevice) {
      try { localStorage.setItem(lockKey, JSON.stringify({ prize: idx, pos })); } catch { /* noop */ }
    }
  }, [cards, ctx.preview, step.sound, step.oncePerDevice, step.confete, lockKey]);

  /** O card raspado mostra o prêmio SORTEADO; os demais, os prêmios restantes. */
  const cardAt = useCallback((pos: number): ScratchCard => {
    if (openedPos === null || prizeIdx === null) return cards[pos];
    if (pos === openedPos) return cards[prizeIdx];
    const restantes = cards.filter((_, i) => i !== prizeIdx);
    const outrasPos = cards.map((_, i) => i).filter((i) => i !== openedPos);
    return restantes[outrasPos.indexOf(pos)] ?? cards[pos];
  }, [cards, openedPos, prizeIdx]);

  const premio = prizeIdx !== null ? cards[prizeIdx] : null;
  const destino = premio?.redeemUrl || step.ctaUrl || "";

  const seguir = () => {
    if (destino) { window.location.href = destino; return; }
    ctx.advance();
  };


  return (
    <>
      {/* Fundo full-screen da lâmina: aceita cor chapada, linear-gradient,
          radial-gradient ou url(imagem) — mesmo campo que a roleta usa. */}
      {step.background ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background: step.background,
            // imagem 16:9 exibida em tela 9:16: "cover" + âncora no topo mantém
            // a arte de cima (ex.: a logo) visível em vez de cortá-la.
            backgroundSize: step.bgSize ?? "cover",
            backgroundPosition: step.bgPosition ?? PADRAO.bgPosition,
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : null}

      {/* HOLOFOTE: escurece a tela inteira ao revelar. O card premiado e o botão
          de redirect sobem pra z-50 e ficam iluminados. Vale mesmo com o painel
          desligado — é escurecimento de cena, não fundo de modal. */}
      <AnimatePresence>
        {revelado ? (
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-40"
            style={{ background: `rgba(0,0,0,${Math.min(1, Math.max(0, Number(step.escurecimento ?? 68) / 100))})` }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        ) : null}
      </AnimatePresence>
      <StepShell center>
        {/* Espaço no topo: desce texto/cards/botão pra não cobrir a arte do
            fundo (ex.: logo no topo de uma imagem 16:9 exibida em 9:16). */}
        {step.topSpacing ? <div aria-hidden style={{ height: Number(step.topSpacing) }} /> : null}
        {/* Título respeita a aba Aparência: o QuizRunner publica --q-title-*
            a partir de step.appearance (cor, tamanho, peso, alinhamento).
            Antes eu fixava tamanho/cor aqui e esses campos não faziam nada. */}
        <h1
          className={`font-[var(--q-display)] leading-tight tracking-tight ${editavel}`}
          onClick={edit("title")}
          title={editing ? "Clique para editar no painel" : undefined}
          style={{
            fontSize: "var(--q-title-size, 26px)",
            fontWeight: "var(--q-title-weight, 800)" as React.CSSProperties["fontWeight"],
            color: "var(--q-title-color, var(--q-text))",
            textAlign: "var(--q-title-align, center)" as React.CSSProperties["textAlign"],
            // sombra pra o texto continuar legível sobre imagem de fundo
            textShadow: step.titleShadow ? "0 2px 12px rgba(0,0,0,.75), 0 1px 3px rgba(0,0,0,.9)" : undefined,
          }}
        >
          <RichText text={interp(step.title, ctx)} />
        </h1>
        {step.subtitle ? (
          <p
            className={`mt-2 text-sm text-[var(--q-text-muted)] ${editavel}`}
            onClick={edit("subtitle")}
            title={editing ? "Clique para editar no painel" : undefined}
            style={{
              textAlign: "var(--q-title-align, center)" as React.CSSProperties["textAlign"],
              // com sombra ligada há imagem de fundo: o cinza padrão some, então
              // o subtítulo passa a branco translúcido.
              ...(step.titleShadow
                ? { color: "rgba(255,255,255,.92)", textShadow: "0 1px 8px rgba(0,0,0,.85)" }
                : {}),
            }}
          >
            <RichText text={interp(step.subtitle, ctx)} />
          </p>
        ) : null}

        <div
          className="mx-auto mt-6 grid w-full gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: 460 }}
        >
          {cards.map((_, pos) => (
            <Card
              key={pos}
              card={cardAt(pos)}
              cover={step.coverColor ?? PADRAO.coverColor}
              cover2={step.coverColor2 ?? PADRAO.coverColor2}
              // sem `coverStyle` gravado, o padrão é o degradê dourado da referência
              coverGradiente={step.coverStyle ? step.coverStyle === "gradient" : true}
              coverText={step.coverText ?? PADRAO.coverText}
              coverTextColor={step.coverTextColor ?? PADRAO.coverTextColor}
              coverTextSize={Number(step.coverTextSize ?? PADRAO.coverTextSize)}
              opacidadePerdedor={Math.min(1, Math.max(0, Number(step.perdedoresOpacidade ?? 45) / 100))}
              // enquanto ninguém tocou, todos pulsam chamando pro toque
              pulsarAntes={estado === null}
              revealPct={revealPct}
              revealed={revelado}
              // trava a partir do 1º toque em QUALQUER card (openedPos já
              // definido na fase "raspando") — é o que impede o spoiler
              disabled={openedPos !== null && pos !== openedPos}
              // o card que ela raspou carrega o prêmio sorteado → é o destaque
              destaque={pos === openedPos && revelado}
              destaqueBg={step.destaqueBg}
              destaqueText={step.destaqueText}
              onFirstTouch={() => onFirstTouch(pos)}
              onReveal={() => onReveal(pos)}
            />
          ))}
        </div>
        {/* CTA logo ABAIXO da grade (não no rodapé): o botão precisa ficar
            colado nos cards, no campo de visão de quem acabou de raspar. */}
        {/* z-50 > z-40 do painel informativo: este é o ÚNICO clique da tela
            depois que o prêmio é revelado, e precisa ficar por cima do fundo. */}
        <div className="relative z-50 mx-auto mt-5 w-full" style={{ maxWidth: 460 }}>
          {revelado ? (
            <BotaoWhats onClick={seguir}>{step.winCta}</BotaoWhats>
          ) : (
            <p className="text-center text-sm font-medium text-[var(--q-text-muted)]">
              👆 Raspe um card para revelar seu prêmio
            </p>
          )}
        </div>
      </StepShell>

      {/* PAINEL de premiação — no TOPO da página, apenas INFORMATIVO.
          pointer-events-none: não intercepta clique, então o único elemento
          clicável da tela segue sendo o botão de redirect (z-50, acima deste
          fundo z-40). Cores e copy configuráveis por prêmio. */}
      <AnimatePresence>
        {popup && premio ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-4 pt-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            {/* COMPACTO: faixa no topo, não um card grande — antes cobria os
                dois primeiros cards da grade. */}
            <motion.div
              className="w-full max-w-[300px] rounded-2xl px-4 py-3 text-center shadow-xl"
              style={{ background: step.popupBg || "#16a34a", color: step.popupText || "#ffffff" }}
              initial={{ scale: 0.85, y: -24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xl leading-none">{premio.emoji || "🎉"}</span>
                <p className="text-base font-black uppercase leading-none tracking-tight">
                  <RichText text={interp(premio.popupTitle || step.winTitle || "Parabéns!", ctx)} />
                </p>
              </div>
              <p className="mt-0.5 text-[11px] font-medium opacity-90">
                <RichText text={interp(premio.popupBody || step.winBody || "Você ganhou...", ctx)} />
              </p>
              {/* PRÊMIO em destaque, pulsando. O painel é INFORMATIVO e não tem
                  botão: o único clique da tela é o de redirect, abaixo da grade. */}
              <motion.div
                className="mt-2 rounded-xl px-3 py-2 text-base font-black leading-tight shadow-md"
                style={{ background: step.popupBtnBg || "#ffffff", color: step.popupBg || "#16a34a" }}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              >
                {premio.label}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
