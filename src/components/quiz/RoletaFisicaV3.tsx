"use client";

/**
 * ROLETA v3 — física natural com controle de suspense.
 *
 * PORTE LINHA A LINHA de `roletaclubedasbolsasv3.html` (arquivo do Luca).
 * O motor NÃO foi reescrito: `drawWheel`, os quatro sons, a física de duas
 * fases e o badalo com massa vieram do arquivo, com os mesmos números.
 *
 * COMO ELA DIFERE DO MOTOR ANTIGO (`RoletaInterativa`)
 * O antigo simula atrito e um pino que cobra pedágio; a hesitação emerge e é
 * imprevisível. Este modela o pino como um MORRO DE ENERGIA e deixa você
 * decidir se a roda tem energia para vencê-lo:
 *
 *   passRatio < 1  →  passa (cai no prêmio)
 *   passRatio > 1  →  não passa (volta e fica no prêmio anterior)
 *
 * A régua de hesitação aproxima a razão de 1 nos dois sentidos: quanto mais
 * perto de 1, mais tempo a roda morre em cima do pino antes de decidir. É por
 * isso que o suspense fica REPETÍVEL sem a roda virar animação falsa — ela
 * continua obedecendo à própria física, só com o combustível calibrado.
 *
 * DESVIOS DO ARQUIVO ORIGINAL — todos porque o funil já resolve a mesma coisa:
 *   1. `LOGO_SRC` (base64) → `centerImage`, a imagem que já está no bloco
 *   2. `PRIZES` fixo → `segments` do bloco, para o construtor mandar
 *   3. `COLORS` fixo → cor de cada segmento quando houver; a paleta do arquivo
 *      permanece como padrão
 *   4. `SHOW_CONTROLS` → o painel só aparece no PREVIEW do construtor. Em
 *      produção o lead nunca pode ver o controle de "quase não passa"
 *   5. `SPIN_LIMIT`/`spins` → o funil já tem trava de 24h própria
 * Nada mais mudou.
 */

import { useCallback, useEffect, useRef } from "react";

export interface SegmentoV3 {
  label: string;
  color?: string;
  emoji?: string;
  win?: boolean;
  /** arte desta fatia; quando existe, entra no lugar do texto */
  imagem?: string;
  /** largura em px do desenho de 600 (padrão 165, a medida do arquivo v3) */
  imagemTamanho?: number;
  /** giro só da arte, em graus; 0 = em pé quando a fatia está sob o ponteiro */
  imagemRotacao?: number;
}

export interface RoletaFisicaV3Props {
  segments: SegmentoV3[];
  /** índice do prêmio que o drama persegue */
  vencedor: number;
  girando: boolean;
  /** recebe o índice REALMENTE entregue (pode ser o anterior, se não passou) */
  onFim: (indiceReal: number) => void;
  som?: boolean;
  centerImage?: string;
  /** true = encosta no pino, hesita e PASSA. false = hesita e VOLTA */
  quasePassa?: boolean;
  /** −10..+10 — quanto mais alto, mais tempo morrendo em cima do pino */
  hesitacao?: number;
  /** painel de calibragem: só no preview do construtor */
  mostrarControles?: boolean;
  onControles?: (v: { quasePassa: boolean; hesitacao: number }) => void;
}

/* paleta do arquivo v3 — usada quando o segmento não traz cor própria */
const CORES = ["#7e0f1d", "#f6ead8", "#bf1e63", "#f5a623", "#8e1030", "#ff7fae"];
const CREME = "#f6ead8";

export default function RoletaFisicaV3({
  segments, vencedor, girando, onFim, som = true, centerImage,
  quasePassa = true, hesitacao = 0, mostrarControles = false, onControles,
}: RoletaFisicaV3Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ponteiroRef = useRef<HTMLDivElement>(null);
  /* Uma arte POR FATIA, não uma só. O arquivo v3 cravava a logo na fatia 0
     porque lá só havia uma; aqui qualquer fatia pode ter a sua, e o cache é por
     URL para trocar de imagem não recarregar as outras. */
  const artesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // estado da física fora do React: 60 re-renders por segundo derrubariam a taxa
  const rotRef = useRef(0);
  const flapPRef = useRef(0);
  const flapVRef = useRef(0);
  const girandoRef = useRef(false);
  const rafRef = useRef(0);

  const N = segments.length;
  const sliceDeg = 360 / N;
  const slice = (2 * Math.PI) / N;
  const offset = -Math.PI / 2 - slice / 2;

  /* ══════════════════ SOM — os quatro do arquivo ══════════════════ */
  const acRef = useRef<AudioContext | null>(null);
  const garantirAudio = useCallback(() => {
    if (!som) return;
    if (!acRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) acRef.current = new AC();
    }
    if (acRef.current?.state === "suspended") void acRef.current.resume();
  }, [som]);

  const tickSound = useCallback((gain: number) => {
    const ac = acRef.current;
    if (!som || !ac) return;
    const t = ac.currentTime, g = Math.max(0.06, Math.min(1, gain));
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = "square"; o.frequency.value = 1650 + Math.random() * 350;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.45 * g, t + 0.004);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + 0.07);
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.type = "sine"; o2.frequency.value = 200 + Math.random() * 40;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.22 * g, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o2.connect(g2); g2.connect(ac.destination); o2.start(t); o2.stop(t + 0.1);
  }, [som]);

  /* pino segurou: baque surdo */
  const thudSound = useCallback(() => {
    const ac = acRef.current;
    if (!som || !ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
  }, [som]);

  const winSound = useCallback(() => {
    const ac = acRef.current;
    if (!som || !ac) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = ac.currentTime + i * 0.12;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.4);
    });
  }, [som]);

  /* não passou: duas notas descendo */
  const almostSound = useCallback(() => {
    const ac = acRef.current;
    if (!som || !ac) return;
    [329.63, 261.63].forEach((f, i) => {
      const t = ac.currentTime + i * 0.18;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.35);
    });
  }, [som]);

  /* ══════════════════ DESENHO — o drawWheel do arquivo ══════════════════ */
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const size = canvas.width, C = size / 2, R = size / 2;
    const sliceR = R * 0.865;
    /** arte pronta para desenhar nesta fatia, ou null */
    const arteDe = (i: number) => {
      const url = segments[i].imagem;
      if (!url) return null;
      const img = artesRef.current.get(url);
      return img?.complete && img.naturalWidth ? img : null;
    };

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < N; i++) {
      const a0 = offset + i * slice;
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.arc(C, C, sliceR, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = segments[i].color || CORES[i % CORES.length];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.stroke();
    }

    /* ARTES — glow + imagem radial + borda dourada, uma vez por fatia que
       tenha imagem. No arquivo v3 este trecho rodava só para a fatia 0. */
    for (let i = 0; i < N; i++) {
      const arte = arteDe(i);
      if (!arte) continue;
      const a0 = offset + i * slice;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.arc(C, C, sliceR, a0, a0 + slice);
      ctx.closePath();
      ctx.clip();
      const gl = ctx.createRadialGradient(C, C - R * 0.55, 10, C, C - R * 0.55, R * 0.42);
      gl.addColorStop(0, "rgba(255,70,90,0.50)");
      gl.addColorStop(1, "rgba(255,70,90,0)");
      ctx.fillStyle = gl;
      // o glow é desenhado no eixo da fatia, não no topo fixo do arquivo
      ctx.translate(C, C);
      ctx.rotate(a0 + slice / 2 + Math.PI / 2);
      ctx.fillRect(-R, -R, 2 * R, R);
      /* arte em pé: leitura normal quando a fatia está sob o ponteiro.
         `imagemRotacao` gira só a arte, sem mexer no glow nem na borda. */
      ctx.rotate(((segments[i].imagemRotacao || 0) * Math.PI) / 180);
      const lw = segments[i].imagemTamanho || 165;
      const lh = lw * (arte.height / arte.width);
      ctx.drawImage(arte, -lw / 2, -R * 0.56 - lh / 2, lw, lh);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.arc(C, C, sliceR, a0, a0 + slice);
      ctx.closePath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#f3c437";
      ctx.stroke();
      ctx.restore();
    }

    const vign = ctx.createRadialGradient(C, C, R * 0.12, C, C, sliceR);
    vign.addColorStop(0.0, "rgba(0,0,0,0.16)");
    vign.addColorStop(0.4, "rgba(0,0,0,0)");
    vign.addColorStop(0.82, "rgba(255,255,255,0.05)");
    vign.addColorStop(1.0, "rgba(0,0,0,0.14)");
    ctx.beginPath();
    ctx.arc(C, C, sliceR, 0, Math.PI * 2);
    ctx.fillStyle = vign;
    ctx.fill();

    /* textos das demais fatias — duas linhas, corpo encolhe até caber */
    for (let i = 0; i < N; i++) {
      if (arteDe(i)) continue; // a arte já ocupa esta fatia
      const mid = offset + i * slice + slice / 2;
      const cor = segments[i].color || CORES[i % CORES.length];
      const isCream = cor.toLowerCase() === CREME;
      const maxLen = R * 0.78 - R * 0.3;
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      if (isCream) { ctx.fillStyle = "#7c1f4e"; ctx.shadowBlur = 0; }
      else { ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,0.40)"; ctx.shadowBlur = 3; }
      /* o arquivo trazia `lines` escrito à mão; aqui a quebra sai do rótulo do
         bloco, para o construtor continuar mandando no texto */
      const bruto = `${segments[i].emoji ? `${segments[i].emoji} ` : ""}${segments[i].label}`.trim();
      const palavras = bruto.split(/\s+/);
      const lines = palavras.length > 1
        ? [palavras.slice(0, Math.ceil(palavras.length / 2)).join(" "),
           palavras.slice(Math.ceil(palavras.length / 2)).join(" ")]
        : [bruto];
      const lh2 = 24;
      lines.forEach((ln, li) => {
        let fs = 22;
        ctx.font = `800 ${fs}px Poppins, Arial, sans-serif`;
        while (ctx.measureText(ln).width > maxLen && fs > 12) {
          fs -= 1;
          ctx.font = `800 ${fs}px Poppins, Arial, sans-serif`;
        }
        ctx.fillText(ln, R * 0.78, (li - (lines.length - 1) / 2) * lh2);
      });
      ctx.restore();
    }

    /* pinos dourados nas divisórias */
    for (let i = 0; i < N; i++) {
      const a = offset + i * slice;
      const px = C + Math.cos(a) * (sliceR - 12);
      const py = C + Math.sin(a) * (sliceR - 12);
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#8a5c10"; ctx.fill();
      const pg = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 7);
      pg.addColorStop(0, "#ffe9a8"); pg.addColorStop(0.6, "#e9b83a"); pg.addColorStop(1, "#a8761a");
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = pg; ctx.fill();
    }

    /* aro azul + lampadinhas */
    const rim = ctx.createRadialGradient(C, C, sliceR, C, C, R * 0.995);
    rim.addColorStop(0.0, "#14597f"); rim.addColorStop(0.28, "#3db0e4");
    rim.addColorStop(0.55, "#5cc3ef"); rim.addColorStop(0.82, "#2b9fd8");
    rim.addColorStop(1.0, "#14597f");
    ctx.beginPath();
    ctx.arc(C, C, R * 0.995, 0, Math.PI * 2);
    ctx.arc(C, C, sliceR, 0, Math.PI * 2, true);
    ctx.fillStyle = rim; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#0f4a6b";
    ctx.beginPath(); ctx.arc(C, C, R * 0.985, 0, Math.PI * 2); ctx.stroke();

    const BULBS = 18, bulbColors = ["#ff7085", "#ffd166", "#fff6e0"];
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * Math.PI * 2;
      const bx = C + Math.cos(a) * R * 0.928;
      const by = C + Math.sin(a) * R * 0.928;
      ctx.save();
      ctx.shadowColor = "rgba(255,240,200,0.9)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = bulbColors[i % bulbColors.length]; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(bx - 1.4, by - 1.4, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
    }
  }, [N, offset, slice, segments]);

  /* As artes chegam depois do primeiro quadro; sem redesenhar quando cada uma
     carrega, a fatia fica vazia para sempre. O cache é por URL: trocar a arte
     de uma fatia não recarrega as outras. */
  const urls = segments.map((s) => s.imagem).filter(Boolean).join("|");
  useEffect(() => {
    let vivo = true;
    const cache = artesRef.current;
    urls.split("|").filter(Boolean).forEach((url) => {
      if (cache.has(url)) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { if (vivo) drawWheel(); };
      img.src = url;
      cache.set(url, img);
    });
    drawWheel();
    return () => { vivo = false; };
  }, [urls, drawWheel]);

  useEffect(() => { drawWheel(); }, [drawWheel]);

  const aplicarRot = useCallback(() => {
    if (canvasRef.current) canvasRef.current.style.transform = `rotate(${rotRef.current}deg)`;
  }, []);
  /* flapP positivo = arrastado NO SENTIDO do giro (horário → ponta p/ direita);
     para o pêndulo apontando p/ baixo, isso é rotate NEGATIVO no CSS */
  const aplicarFlap = useCallback(() => {
    if (ponteiroRef.current) ponteiroRef.current.style.transform = `translateX(-50%) rotate(${(-flapPRef.current).toFixed(2)}deg)`;
  }, []);

  const phase = useCallback((r: number) => (r - sliceDeg / 2) / sliceDeg, [sliceDeg]);

  /* ══════════════════ FÍSICA — o spin() do arquivo ══════════════════ */
  const girar = useCallback(() => {
    if (girandoRef.current) return;
    girandoRef.current = true;
    garantirAudio();

    const PASS = quasePassa;
    /* O CHECK da fatia decide o prêmio — sempre, nos dois modos. Por isso, no
       modo OFF, a roda mira UMA FATIA ADIANTE: ela hesita, não vence o pino,
       volta, e para exatamente na fatia marcada.
       Sem isto, ON e OFF entregariam prêmios diferentes e o teste A/B mediria a
       troca de prêmio em vez do drama, que é o que se quer comparar. */
    const idx = PASS ? vencedor : (vencedor - 1 + N) % N;
    const targetDeg = (360 - idx * sliceDeg) % 360;
    const hes = hesitacao || 0; // −10..+10

    /* razão de energia do morro: <1 passa, >1 não passa.
       mais hesitação = mais perto de 1 (mais tempo morrendo no topo) */
    const passRatio = PASS
      ? 0.75 + ((hes + 10) / 20) * 0.22   // 0.75 .. 0.97
      : 1.16 - ((hes + 10) / 20) * 0.13;  // 1.16 .. 1.03

    /* geometria */
    const rot0 = rotRef.current;
    const base = rot0 - (rot0 % 360);
    let boundary = base + 5 * 360 + targetDeg - sliceDeg / 2; // pino de entrada da fatia-alvo
    while (boundary <= rot0 + 3 * 360) boundary += 360;

    /* fase 1 (script): gira e entrega a roda 45° antes do pino, já devagar */
    const HILL_W = 4;                          // meia-largura do morro do pino (graus)
    const HILL_FRIC = 12;                      // atrito reduzido em cima do pino
    const vEnter = 55 + Math.random() * 12;    // velocidade ao entrar na reta final
    const vHillT = 24 + Math.random() * 5;     // velocidade desejada ao chegar no morro
    const E = boundary - 45;
    const tA = 3800;                           // ms da fase 1
    const W = Math.min(0.4, (vEnter * (tA / 1000)) / (E - rot0)); // casa a velocidade na troca
    const cPre = Math.max(8, (vEnter * vEnter - vHillT * vHillT) / (2 * (45 - HILL_W)));
    const cPost = 12 + Math.random() * 5;      // atrito depois do pino (rola e morre)
    const cBack = 20;                          // atrito voltando (modo OFF)

    let mode: "ease" | "phys" = "ease";
    let v = 0;
    let Hmax: number | null = null;
    let doneFlag = false;
    const start = performance.now();
    let prevRot = rot0, prevT = start;

    const finish = () => {
      girandoRef.current = false;
      const relax = setInterval(() => {
        flapVRef.current += (750 * (0 - flapPRef.current) - 26 * flapVRef.current) * 0.016;
        flapPRef.current += flapVRef.current * 0.016;
        aplicarFlap();
        if (Math.abs(flapPRef.current) < 0.1 && Math.abs(flapVRef.current) < 0.5) {
          flapPRef.current = 0; aplicarFlap(); clearInterval(relax);
        }
      }, 16);

      const passed = rotRef.current > boundary;
      if (passed) winSound(); else almostSound();
      /* quem NÃO passou fica no prêmio anterior — a lâmina precisa saber qual,
         senão o pop-up celebraria um prêmio que a roda não entregou */
      onFim(passed ? idx : (idx + 1) % N);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.04, (now - prevT) / 1000) || 0.016;
      prevT = now;

      if (mode === "ease") {
        const t = (now - start) / tA;
        if (t >= 1) { mode = "phys"; rotRef.current = E; v = vEnter; }
        else {
          const e = (1 - W) * (1 - Math.pow(1 - t, 4)) + W * t;
          rotRef.current = rot0 + (E - rot0) * e;
        }
      } else {
        let x = rotRef.current - boundary;
        let acc = 0;
        if (Math.abs(x) < HILL_W) {
          /* energia do morro desconta o atrito da subida, senão nunca passa */
          if (Hmax === null && v > 0) Hmax = passRatio * Math.max(40, (v * v) / 2 - HILL_FRIC * HILL_W);
          if (Hmax !== null) acc += ((Math.PI * Hmax) / (2 * HILL_W)) * Math.sin((Math.PI * x) / HILL_W);
        }
        acc += -Math.sign(v) * (Math.abs(x) < HILL_W ? HILL_FRIC : v > 0 ? (x > HILL_W ? cPost : cPre) : cBack);
        if (Math.abs(v) < 5) acc += -v * 1.6;      // cauda suave: morre devagarinho
        const vPrev = v;
        v += acc * dt;
        if (vPrev > 0 && v <= 0 && Math.abs(x) < HILL_W) thudSound(); // pino segurou
        rotRef.current += v * dt;
        x = rotRef.current - boundary;
        if (x > 56) { rotRef.current = boundary + 56; v = 0; }   // seguranças
        if (x < -50) { rotRef.current = boundary - 50; v = 0; }
        if (Math.abs(v) < 0.25 && Math.abs(x) > HILL_W) doneFlag = true;
      }

      const speed = (rotRef.current - prevRot) / dt;

      /* ticks nos pinos (só no sentido do giro) */
      const k1 = Math.floor(phase(prevRot));
      const k2 = Math.floor(phase(rotRef.current));
      if (k2 > k1 && speed > 0) {
        tickSound(0.25 + Math.min(0.75, speed / 1100));
        flapVRef.current += Math.min(520, speed * 1.2);
      }

      /* contato com o pino: encosta antes, cavalga depois */
      const ph = phase(rotRef.current);
      const dNext = (Math.ceil(ph) - ph) * sliceDeg;
      const sPrev = (ph - Math.floor(ph)) * sliceDeg;
      let contactT = 0;
      if (girandoRef.current) {
        if (dNext < 5) contactT = 10 * Math.pow(1 - dNext / 5, 1.2);
        if (sPrev < 5) contactT = Math.max(contactT, 16 * Math.pow(1 - sPrev / 5, 0.9));
      }
      flapVRef.current += (750 * (contactT - flapPRef.current) - 26 * flapVRef.current) * dt;
      flapPRef.current += flapVRef.current * dt;
      if (flapPRef.current < -6) { flapPRef.current = -6; flapVRef.current = 0; }
      if (flapPRef.current > 55) { flapPRef.current = 55; flapVRef.current = 0; }

      prevRot = rotRef.current;
      aplicarRot();
      aplicarFlap();
      if (doneFlag) finish(); else rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [vencedor, sliceDeg, quasePassa, hesitacao, garantirAudio, phase, aplicarRot,
      aplicarFlap, tickSound, thudSound, winSound, almostSound, onFim, N]);

  // a lâmina manda girar; o componente não tem botão próprio
  useEffect(() => { if (girando) girar(); }, [girando, girar]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => { aplicarFlap(); }, [aplicarFlap]);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <div className="relative w-full">
        <div className="relative z-[2] aspect-square w-full">
          {/* ponteiro dourado (badalo) */}
          <div
            ref={ponteiroRef}
            aria-hidden
            className="absolute left-1/2 top-[-3%] z-[8] w-[11%]"
            style={{
              aspectRatio: "50 / 56", transformOrigin: "50% 6%", willChange: "transform",
              transform: "translateX(-50%) rotate(0deg)",
              filter: "drop-shadow(0 3px 5px rgba(0,0,0,.4))",
            }}
          >
            <span className="absolute left-1/2 w-[34%] -translate-x-1/2 rounded-full"
              style={{ top: "-13%", aspectRatio: "1/1", background: "radial-gradient(circle at 35% 30%, #ffe9a8, #e9b83a 55%, #a8761a)" }} />
            <span className="absolute inset-0"
              style={{
                clipPath: "polygon(50% 100%, 88% 26%, 68% 0, 50% 12%, 32% 0, 12% 26%)",
                background: "linear-gradient(160deg,#ffe9a8 0%,#f3c437 40%,#c8921f 75%,#8a5c10 100%)",
              }} />
          </div>

          <canvas ref={canvasRef} width={600} height={600} className="h-full w-full rounded-full"
            style={{ filter: "drop-shadow(0 14px 24px rgba(20,60,90,.35))" }} />

          {/* cubo dourado — e o MIOLO, que é o papel de sempre do `centerImage`
              nos outros motores. A arte de cada fatia mora em `segments[].imagem`. */}
          <div aria-hidden className="absolute left-1/2 top-1/2 z-[6] grid h-[23%] w-[23%] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full"
            style={{
              background: "radial-gradient(circle at 38% 32%, rgba(255,246,214,.95), rgba(255,246,214,0) 45%), conic-gradient(#f6d876,#c8921f,#f0cd5e,#b07d1a,#f6d876,#c8921f,#f0cd5e,#b07d1a,#f6d876)",
              boxShadow: "0 6px 14px rgba(0,0,0,.4), inset 0 -3px 8px rgba(120,80,10,.55)",
            }}>
            {centerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={centerImage} alt="" className="h-[78%] w-[78%] rounded-full object-cover" />
            ) : null}
          </div>
        </div>

        {/* pedestal azul */}
        <div aria-hidden className="relative z-[1] mx-auto -mt-[6%] h-[78px] w-[36%]"
          style={{
            clipPath: "polygon(28% 0, 72% 0, 94% 100%, 6% 100%)",
            background: "linear-gradient(90deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg,#3db0e4 0%,#2b9fd8 45%,#1a6f9e 100%)",
          }} />
        <div aria-hidden className="mx-auto h-[18px] w-[58%] rounded-[9px]"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg,#3db0e4 0%,#1a6f9e 100%)",
            boxShadow: "0 6px 14px rgba(20,60,90,.35)",
          }} />
      </div>

      {/* PAINEL DE CALIBRAGEM — construtor apenas. Em produção o lead nunca
          pode ver o controle de "quase não passa". */}
      {mostrarControles ? (
        <div className="mx-auto mt-6 max-w-[400px] rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <strong className="text-[15px] text-neutral-900">Quase não passa</strong>
            <label className="relative inline-block h-[26px] w-[46px]">
              <input type="checkbox" checked={quasePassa} className="h-0 w-0 opacity-0"
                onChange={(e) => onControles?.({ quasePassa: e.target.checked, hesitacao })} />
              <span className="absolute inset-0 cursor-pointer rounded-full transition"
                style={{ background: quasePassa ? "#0a7d38" : "#ccc" }}>
                <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition"
                  style={{ transform: quasePassa ? "translateX(20px)" : "none" }} />
              </span>
            </label>
          </div>
          <p className="my-1.5 text-[12.5px] text-neutral-500">
            Equilibra em cima do pino, hesita e{" "}
            <b style={{ color: quasePassa ? "#0a7d38" : "#c0392b" }}>
              {quasePassa ? "ON: passa e cai no prêmio" : "OFF: hesita e volta pra trás"}
            </b>
          </p>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span>menos&nbsp;hesitação</span>
            <input type="range" min={-10} max={10} value={hesitacao} className="flex-1 accent-orange-600"
              onChange={(e) => onControles?.({ quasePassa, hesitacao: Number(e.target.value) })} />
            <span>mais</span>
            <b className="min-w-[22px] text-right text-[13px] text-neutral-900">{hesitacao}</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}
