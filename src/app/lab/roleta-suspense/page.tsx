"use client";

/**
 * LABORATÓRIO — roleta "Luxo Gold" com suspense COREOGRAFADO.
 *
 * O QUE É PORTE E O QUE É NOVO
 * O DESENHO é o do `roletacassinogold.html` do Luca, portado inteiro: padrão de
 * carbono nas fatias escuras, gradiente radial dourado nas claras, vinheta de
 * profundidade, divisórias com triângulos apontando para dentro, pontinhos na
 * borda, aro de cinco paradas com bordas fina interna e externa, 24 lâmpadas
 * com halo, hub em conic-gradient, pedestal e o brilho do chão.
 *
 * (Primeira tentativa minha desenhou cor chapada e aro simples — o resultado
 * ficou pobre justamente porque descartou tudo isso.)
 *
 * O MOVIMENTO é o motor de quatro fases, também dele, com quatro correções:
 *   - fase A de 4300 → 2800ms: 6,95s de dedo parado custa abandono em tráfego frio
 *   - fase B com easeOutQuad: easeInOutSine ACELERA no meio e desmancha a
 *     leitura de "travado"
 *   - `past` limitado a 45% da fatia: solto, ele parava colado na divisória do
 *     prêmio seguinte e a entrega estragava o suspense
 *   - respeita `prefers-reduced-motion`
 *
 * A COPY é a do funil `cdb-insta` (bloco `roulette`, lâmina 12), para a
 * comparação ser sobre o movimento e não sobre o texto.
 *
 * Nada aqui é importado por produção — existe para comparar com `/lab/roleta`,
 * que exercita o motor físico simulado que roda hoje.
 */

import { poppins } from "@/app/fonts/funnel-fonts";
import { useCallback, useEffect, useRef, useState } from "react";

// o desenho foi medido em Poppins 900; com fallback de sistema os rótulos
// mudam de largura e passam a encostar no aro

/* ── copy e paleta, iguais às do cdb-insta ──────────────────────────────── */
const SEGMENTOS: { label: string; cor: string; emoji?: string }[] = [
  { label: "ACESSO GRATUITO", cor: "#171717", emoji: "🎁" },
  { label: "Aula especial", cor: "#ffffff" },
  { label: "Apostila bônus", cor: "#e8842a" },
  { label: "Guia de materiais", cor: "#1c7ed6" },
  { label: "Modelos extras", cor: "#ffda09" },
  { label: "Desconto especial", cor: "#00af21" },
];
const TITULO = "SEU GIRO ESTÁ LIBERADO";
const SUBTITULO = "Toque no botão abaixo e descubra seu prêmio.";
const CTA = "GIRAR";
const WIN_TITULO = "PARABÉNS!";
const WIN_CORPO = "VOCÊ LIBEROU: ACESSO GRATUITO AO MATERIAL COMPLETO DO CLUBE DAS BOLSAS";
const WIN_CTA = "PEGAR MEU PRÊMIO";
const VENCEDOR = 0;

const N = SEGMENTOS.length;
const FATIA = 360 / N;
const GOLD_EDGE = "#c79a33";

const PADRAO = { tA: 2800, tB: 850, tC: 1150, tD: 650, folga: 1.4 };

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Texto legível sobre a cor da fatia — as do cdb-insta variam de preto a amarelo. */
const corTexto = (fundo: string) => {
  const n = parseInt(fundo.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#141414" : "#ffffff";
};

export default function LabRoletaSuspense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ponteiroRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const rotRef = useRef(0);
  const girandoRef = useRef(false);
  const goldRef = useRef(false);

  const [girando, setGirando] = useState(false);
  const [ganhou, setGanhou] = useState(false);
  const [cfg, setCfg] = useState(PADRAO);
  const [gold, setGold] = useState(true);
  const [painel, setPainel] = useState(false);
  useEffect(() => { goldRef.current = gold; }, [gold]);

  /* ══ DESENHO — porte do drawWheel() do roletacassinogold.html ══════════ */
  const desenhar = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const size = cv.width, C = size / 2, R = size / 2;
    const sliceR = R * 0.86;
    const slice = (2 * Math.PI) / N;
    const offset = -Math.PI / 2 - slice / 2 + (rotRef.current * Math.PI) / 180;
    const luxo = goldRef.current;

    // trama de carbono das fatias escuras — é o que tira o "cor chapada"
    const carbono = (() => {
      const c = document.createElement("canvas");
      c.width = 12; c.height = 12;
      const x = c.getContext("2d");
      if (!x) return "#121215";
      x.fillStyle = "#121215"; x.fillRect(0, 0, 12, 12);
      x.fillStyle = "#1c1c21"; x.fillRect(0, 0, 6, 6); x.fillRect(6, 6, 6, 6);
      x.fillStyle = "#0a0a0c"; x.fillRect(3, 3, 2, 2); x.fillRect(9, 9, 2, 2);
      return ctx.createPattern(c, "repeat") ?? "#121215";
    })();

    const dourado = (() => {
      const g = ctx.createRadialGradient(C, C, R * 0.1, C, C, sliceR);
      g.addColorStop(0, "#7d5a16"); g.addColorStop(0.45, "#c79a33");
      g.addColorStop(0.7, "#eecf6f"); g.addColorStop(0.88, "#f6e59a");
      g.addColorStop(1, "#a87a1e");
      return g;
    })();

    ctx.clearRect(0, 0, size, size);

    /* fatias */
    for (let i = 0; i < N; i++) {
      const a0 = offset + i * slice;
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.arc(C, C, sliceR, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = luxo ? (i % 2 === 0 ? carbono : dourado) : SEGMENTOS[i].cor;
      ctx.fill();
    }

    /* sombreamento geral — a profundidade que faz a roda parecer um objeto */
    const vinheta = ctx.createRadialGradient(C, C, R * 0.15, C, C, sliceR);
    vinheta.addColorStop(0, "rgba(0,0,0,.38)");
    vinheta.addColorStop(0.45, "rgba(0,0,0,.05)");
    vinheta.addColorStop(0.8, "rgba(255,255,255,.05)");
    vinheta.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.beginPath();
    ctx.arc(C, C, sliceR, 0, Math.PI * 2);
    ctx.fillStyle = vinheta;
    ctx.fill();

    /* divisórias + triângulos dourados apontando para dentro */
    for (let i = 0; i < N; i++) {
      const a = offset + i * slice;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * R * 0.16, C + Math.sin(a) * R * 0.16);
      ctx.lineTo(C + Math.cos(a) * sliceR, C + Math.sin(a) * sliceR);
      ctx.strokeStyle = "rgba(199,154,51,.95)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const tipR = R * 0.795, baseR = sliceR, t = 0.016;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * tipR, C + Math.sin(a) * tipR);
      ctx.lineTo(C + Math.cos(a - t) * baseR, C + Math.sin(a - t) * baseR);
      ctx.lineTo(C + Math.cos(a + t) * baseR, C + Math.sin(a + t) * baseR);
      ctx.closePath();
      ctx.fillStyle = "#e9c96a";
      ctx.fill();
    }

    /* pontinhos + textos */
    for (let i = 0; i < N; i++) {
      const mid = offset + i * slice + slice / 2;
      const s = SEGMENTOS[i];
      const fundoFatia = luxo ? (i % 2 === 0 ? "#121215" : "#c79a33") : s.cor;
      const tinta = luxo ? (i % 2 === 0 ? "#ecc65f" : "#17130a") : corTexto(s.cor);

      ctx.beginPath();
      ctx.arc(C + Math.cos(mid) * R * 0.78, C + Math.sin(mid) * R * 0.78, 5, 0, Math.PI * 2);
      ctx.fillStyle = tinta;
      ctx.fill();

      const rotulo = `${s.emoji ? `${s.emoji} ` : ""}${s.label}`;
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      // os rótulos do cdb-insta são longos ("Guia de materiais"); o corpo cai
      // conforme o comprimento para nenhum encostar no aro
      const corpo = rotulo.length >= 16 ? 20 : rotulo.length >= 12 ? 23 : 27;
      ctx.font = `900 ${corpo}px var(--font-roleta), Poppins, system-ui, sans-serif`;
      ctx.fillStyle = tinta;
      if (corTexto(fundoFatia) === "#ffffff") {
        ctx.shadowColor = "rgba(0,0,0,.7)";
        ctx.shadowBlur = 3;
      }
      ctx.fillText(rotulo, R * 0.735, 0);
      ctx.restore();
    }

    /* aro dourado */
    const aro = ctx.createRadialGradient(C, C, sliceR, C, C, R * 0.995);
    aro.addColorStop(0, "#6b4d12"); aro.addColorStop(0.3, "#e9c96a");
    aro.addColorStop(0.55, "#f7e7a6"); aro.addColorStop(0.8, "#c79a33");
    aro.addColorStop(1, "#5e430f");
    ctx.beginPath();
    ctx.arc(C, C, R * 0.995, 0, Math.PI * 2);
    ctx.arc(C, C, sliceR, 0, Math.PI * 2, true);
    ctx.fillStyle = aro;
    ctx.fill();

    /* bordas fina externa e interna do aro */
    ctx.lineWidth = 3; ctx.strokeStyle = "#3a2a08";
    ctx.beginPath(); ctx.arc(C, C, R * 0.985, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = GOLD_EDGE;
    ctx.beginPath(); ctx.arc(C, C, sliceR + 1, 0, Math.PI * 2); ctx.stroke();

    /* lâmpadas no aro — com halo e o ponto de luz descentrado */
    const BULBS = 24;
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * Math.PI * 2;
      const bx = C + Math.cos(a) * R * 0.925;
      const by = C + Math.sin(a) * R * 0.925;
      ctx.save();
      ctx.shadowColor = "rgba(255,244,214,.95)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fffbe8";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(bx - 1.5, by - 1.5, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }, []);

  // as fontes chegam depois do primeiro quadro; sem isto os rótulos ficam
  // desenhados no fallback do sistema para sempre
  useEffect(() => {
    desenhar();
    document.fonts?.ready.then(desenhar);
  }, [desenhar, gold]);

  /* ══ MOVIMENTO — as quatro fases ══════════════════════════════════════ */
  const girar = useCallback(() => {
    if (girandoRef.current) return;
    girandoRef.current = true;
    setGirando(true);
    setGanhou(false);

    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rot0 = rotRef.current;
    const alvoDeg = (360 - VENCEDOR * FATIA) % 360;
    const past = Math.min(10 + Math.random() * 8, FATIA * 0.45);

    let pino = rot0 - (rot0 % 360) + 5 * 360 + alvoDeg - FATIA / 2;
    while (pino <= rot0 + 3 * 360) pino += 360;

    const rotStall = pino - cfg.folga;
    const creep = 0.5;
    const rotFinal = pino + past;

    const encerrar = () => {
      rotRef.current = rotFinal;
      if (ponteiroRef.current) ponteiroRef.current.style.transform = "translateX(-50%) rotate(0deg)";
      desenhar();
      girandoRef.current = false;
      setGirando(false);
      setGanhou(true);
    };

    if (reduzido) { encerrar(); return; }

    const { tA, tB, tC, tD } = cfg;
    const t0 = performance.now();

    const quadro = (agora: number) => {
      const t = agora - t0;
      let rot: number;

      if (t < tA) {
        rot = rot0 + (rotStall - rot0) * easeOutQuart(t / tA);            // gira forte, vai morrendo
      } else if (t < tA + tB) {
        rot = rotStall + creep * easeOutQuad((t - tA) / tB);              // O SUSPENSE: rasteja no pino
      } else if (t < tA + tB + tC) {
        rot = (rotStall + creep) + (rotFinal - rotStall - creep) * easeInOutSine((t - tA - tB) / tC);
      } else if (t < tA + tB + tC + tD) {
        const td = (t - tA - tB - tC) / 1000;
        rot = rotFinal + 0.9 * Math.exp(-5 * td) * Math.sin(16 * td);     // balancinho
      } else { encerrar(); return; }

      rotRef.current = rot;

      /* O BADALO vergando no pino — é isto que vende a ilusão. Escrito direto
         no style: repintar o React 60 vezes por segundo derruba o quadro. */
      const fase = (rot - FATIA / 2) / FATIA;
      const ateOProximo = (Math.ceil(fase) - fase) * FATIA;
      const contato = ateOProximo < 6 ? 20 * Math.pow(1 - ateOProximo / 6, 1.3) : 0;
      if (ponteiroRef.current) ponteiroRef.current.style.transform = `translateX(-50%) rotate(${-contato}deg)`;

      desenhar();
      rafRef.current = requestAnimationFrame(quadro);
    };
    rafRef.current = requestAnimationFrame(quadro);
  }, [cfg, desenhar]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const slider = (rotulo: string, chave: "tA" | "tB" | "tC" | "tD", min: number, max: number) => (
    <label className="flex items-center justify-between gap-3 text-xs text-white/65">
      <span>{rotulo}</span>
      <span className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={50} value={cfg[chave]}
          onChange={(e) => setCfg({ ...cfg, [chave]: Number(e.target.value) })}
          className="w-32 accent-amber-400" aria-label={rotulo} />
        <b className="w-12 text-right tabular-nums text-amber-300">{cfg[chave]}</b>
      </span>
    </label>
  );

  return (
    <main
      className={`${poppins.className} min-h-dvh px-4 py-10`}
      style={{ background: "radial-gradient(circle at 50% 22%, #232326 0%, #131316 55%, #0a0a0c 100%)" }}
    >
      <div className="mx-auto max-w-[430px]">
        <h1 className="text-center text-[30px] font-black leading-[1.1] tracking-tight"
          style={{ color: "#ecc65f", textShadow: "0 0 22px rgba(236,198,95,.35)" }}>{TITULO}</h1>
        <p className="mt-2 text-center text-sm text-white/55">{SUBTITULO}</p>

        {/* ── o palco: roda, pedestal e o brilho do chão ── */}
        <div className="relative mx-auto mt-8 w-full">
          <div className="relative z-[2] aspect-square w-full">
            <div
              ref={ponteiroRef}
              aria-hidden
              className="absolute left-1/2 top-[-2.5%] z-[8] w-[10%]"
              style={{
                aspectRatio: "46 / 70", transform: "translateX(-50%)", transformOrigin: "50% 6%",
                background: "linear-gradient(180deg,#f2d98a 0%,#c79a33 30%,#8a641c 70%,#5e430f 100%)",
                clipPath: "polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)",
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,.6))",
              }}
            >
              {/* miolo escuro com a trama diagonal, como no original */}
              <span className="absolute" style={{
                left: "8%", right: "8%", top: "6%", bottom: "8%",
                clipPath: "polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)",
                background: "repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 2px, transparent 2px 4px), linear-gradient(180deg,#26262a 0%,#151518 60%,#0c0c0e 100%)",
              }} />
            </div>

            <canvas ref={canvasRef} width={600} height={600} className="h-full w-full rounded-full"
              style={{ filter: "drop-shadow(0 14px 26px rgba(0,0,0,.65))" }} />

            {/* hub: anel conic dourado + miolo carbono clicável */}
            <div className="absolute left-1/2 top-1/2 z-[6] grid h-[27%] w-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{
                background: "conic-gradient(#f6e59a,#a87a1e,#f2d98a,#6b4d12,#f6e59a,#a87a1e,#f6e59a)",
                boxShadow: "0 0 0 2px #4a350c, 0 8px 16px rgba(0,0,0,.65), inset 0 2px 4px rgba(255,255,255,.5)",
              }}>
              <button
                onClick={girar} disabled={girando}
                className="h-[76%] w-[76%] rounded-full text-[clamp(11px,2.6vw,16px)] font-extrabold tracking-[2px] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 2px, transparent 2px 4px), radial-gradient(circle at 35% 30%, #2c2c31, #131316 70%, #08080a 100%)",
                  color: "#ecc65f", textShadow: "0 0 8px rgba(236,198,95,.45)",
                  boxShadow: "inset 0 2px 5px rgba(0,0,0,.8), inset 0 -1px 2px rgba(255,255,255,.08)",
                }}
              >{girando ? "…" : CTA}</button>
            </div>
          </div>

          {/* pedestal */}
          <div aria-hidden className="relative z-[1] mx-auto -mt-[5%] h-[74px] w-[42%]"
            style={{
              clipPath: "polygon(22% 0, 78% 0, 100% 100%, 0 100%)",
              background: "radial-gradient(ellipse at 50% 0%, rgba(255,240,190,.5), transparent 55%), linear-gradient(180deg,#d9b14b 0%,#a87a1e 45%,#6b4d12 85%,#4a350c 100%)",
            }} />
          <div aria-hidden className="mx-auto -mt-1 h-4 w-[72%]"
            style={{ background: "radial-gradient(ellipse at center, rgba(255,205,100,.30), transparent 68%)" }} />
        </div>

        <div role="status" aria-live="polite" className="mt-4 min-h-[30px] text-center">
          {ganhou ? (
            <div className="rounded-2xl border p-5"
              style={{ borderColor: "rgba(236,198,95,.28)", background: "rgba(236,198,95,.06)" }}>
              <p className="text-xl font-black tracking-wide" style={{ color: "#ecc65f", textShadow: "0 0 14px rgba(236,198,95,.5)" }}>{WIN_TITULO}</p>
              <p className="mt-2 text-sm leading-snug text-white/75">{WIN_CORPO}</p>
              <button className="mt-4 w-full rounded-xl px-4 py-3.5 text-sm font-black tracking-wide text-[#17130a]"
                style={{ background: "linear-gradient(180deg,#f6e59a,#c79a33)", boxShadow: "0 8px 22px rgba(199,154,51,.35)" }}>{WIN_CTA}</button>
            </div>
          ) : null}
        </div>

        {/* ── calibragem: recolhida, para não competir com o palco ── */}
        <div className="mt-10">
          <button onClick={() => setPainel(!painel)}
            className="mx-auto block text-[11px] uppercase tracking-[.18em] text-white/35 hover:text-white/60"
            aria-expanded={painel}>
            {painel ? "esconder calibragem" : "calibrar o drama"}
          </button>
          {painel ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4">
              {slider("Fase A — giro forte", "tA", 1500, 6000)}
              {slider("Fase B — o suspense", "tB", 300, 2500)}
              {slider("Fase C — o peso vence", "tC", 400, 2500)}
              {slider("Fase D — balancinho", "tD", 0, 1500)}
              <label className="flex items-center justify-between gap-3 text-xs text-white/65">
                <span>Folga do pino</span>
                <span className="flex items-center gap-2">
                  <input type="range" min={0.4} max={4} step={0.1} value={cfg.folga}
                    onChange={(e) => setCfg({ ...cfg, folga: Number(e.target.value) })}
                    className="w-32 accent-amber-400" aria-label="Folga do pino" />
                  <b className="w-12 text-right tabular-nums text-amber-300">{cfg.folga.toFixed(1)}°</b>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 pt-2 text-xs text-white/65">
                <input type="checkbox" checked={gold} onChange={(e) => setGold(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400" />
                Paleta preto/dourado (desmarque para as cores do cdb-insta)
              </label>
              <p className="pt-2 text-[11px] leading-snug text-white/40">
                Total: {((cfg.tA + cfg.tB + cfg.tC + cfg.tD) / 1000).toFixed(2)}s — a roleta de produção roda em 4,2s.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
