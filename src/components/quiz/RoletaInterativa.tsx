"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PRESETS, PADRAO, comIntensidade, type Params } from "@/lib/quiz/roleta-fisica";
import { ajustarRotulo } from "@/lib/quiz/roleta-texto";

/**
 * Motor de animação "interativa" da roleta — a alternativa à clássica.
 *
 * SÓ ANIMA. O vencedor chega pronto por prop: o sorteio, a trava de 24 h, o
 * confete e o avanço continuam em `RouletteStepView` (steps.tsx:141), que é a
 * fonte de verdade do negócio. Aqui a física decide COMO a roda chega ao
 * prêmio, nunca QUAL prêmio sai.
 *
 * O QUE MUDA EM RELAÇÃO À CLÁSSICA
 *  - A roda é integrada quadro a quadro, não animada por curva de easing.
 *  - Cada tique de som nasce de um pino cruzando o ponteiro DE VERDADE, com
 *    timbre derivado da velocidade naquele instante. Desacelerar espaça os
 *    tiques sozinho — não há curva de áudio a sincronizar.
 *  - O ponteiro é um pêndulo com mola: cada pino lhe dá um empurrão e ele volta
 *    oscilando. Em giro rápido nem chega a voltar.
 *  - O fim tem três fases: catraca (o pino cobra energia — o "quase parou"),
 *    settle (mola até o centro da fatia; se o ponteiro subiu a rampa, a roda
 *    RECUA) e, opcionalmente, hesitação sobre a crista do pino.
 */

export interface RoletaInterativaProps {
  /** `labelSize` por fatia vence o da lâmina — prêmio de nome longo encolhe sozinho */
  segments: { label: string; color: string; labelSize?: number; labelLines?: string[] }[];
  /** tamanho padrão do texto nas fatias, em px do viewBox (padrão 11) */
  labelSize?: number;
  /** índice JÁ SORTEADO. A física é calculada para parar exatamente nele. */
  vencedor: number;
  /** vira `true` para começar o giro */
  girando: boolean;
  /** chamado quando a roda assenta; é aqui que a vitória é celebrada */
  onFim: () => void;
  som?: boolean;
  /** nome do preset de movimento; ausente = padrão ("Cassino clássico") */
  preset?: string;
  /** -10..+10; 0 = preset puro */
  intensidade?: number;
  /**
   * Valores crus do movimento. Quando presentes VENCEM preset+intensidade — é
   * o que o modo "Personalizado" usa, já que ali não há preset de onde derivar.
   */
  params?: Params;
  /** cores vindas de `wheelChrome` (steps.tsx:43), para casar com o estilo */
  chrome: { rim: string; rimInner: string; pegColor: string; pointer: string; dark?: boolean };
  centerImage?: string;
  hubR?: number;
  hub?: string;
  hubInner?: string;
  /** rotação inicial (mantém a fatia inicial sob o ponteiro antes de girar) */
  anguloInicial?: number;
}

// ── som ──────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/**
 * Tique de UM pino. `forca` (0..1) vem da velocidade na passagem: rápido = agudo
 * e seco (a lâmina mal encosta); lento = grave e com corpo (ela raspa).
 */
function tiquePeg(forca: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const f = Math.max(0, Math.min(1, forca));

  const o = c.createOscillator();
  const g = c.createGain();
  const filtro = c.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 900 + f * 900;
  filtro.Q.value = 6;

  o.type = "triangle";
  o.frequency.setValueAtTime(760 + f * 700, t);
  o.frequency.exponentialRampToValueAtTime(420 + f * 300, t + 0.05);

  const pico = 0.05 + f * 0.2;
  const cauda = 0.035 + (1 - f) * 0.075;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + cauda);

  o.connect(filtro); filtro.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + cauda + 0.02);
}

// ── geometria (idêntica à da roleta clássica) ────────────────────────────────

const C = 100;
const polar = (r: number, a: number): [number, number] => {
  const rad = ((a - 90) * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(C + r * Math.cos(rad)), round(C + r * Math.sin(rad))];
};

function contraste(hex: string): string {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1c1917" : "#fff";
}

export default function RoletaInterativa({
  segments, labelSize, vencedor, girando, onFim, som = true,
  preset, intensidade = 0, params, chrome, centerImage,
  hubR = 94, hub = "#fdf8ef", hubInner = "#eef5f0", anguloInicial = 0,
}: RoletaInterativaProps) {
  const N = segments.length;
  const SEG = 360 / N;
  const CRISTA = SEG / 2;

  const [angulo, setAngulo] = useState(anguloInicial);
  const [flap, setFlap] = useState(0);
  const raf = useRef<number | null>(null);
  const rodou = useRef(false);
  const st = useRef({
    ang: anguloInicial, vel: 0, atrito: 0, ultimoPeg: 0,
    fase: "parada" as string, valeAlvo: 0, hangAte: 0, flapAng: 0, flapVel: 0,
  });

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const rodar = useCallback(() => {
    // `params` (modo Personalizado) vence; senão deriva do preset + intensidade.
    const pr = PRESETS.find((x) => x.nome === preset);
    const p: Params = params ?? (pr ? comIntensidade(pr.params, pr.dir, intensidade) : PADRAO);

    ac();
    const base = st.current.ang;

    // Vale (centro da fatia) que deixa o vencedor sob o ponteiro. Guardado: a
    // mola do settle mira NELE, não no vale mais próximo — senão um overshoot
    // maior que meia fatia entregaria outro prêmio.
    const bruto = base + p.voltas * 360;
    const valeAlvo = bruto + ((360 - (((bruto % 360) + vencedor * SEG) % 360)) % 360);
    const alvo = p.pegHang ? valeAlvo - CRISTA + 0.4 : valeAlvo + p.overshoot;

    const v0 = (2 * (alvo - base)) / p.duracaoAlvo;
    st.current = {
      ang: base, vel: v0, atrito: v0 / p.duracaoAlvo,
      ultimoPeg: Math.floor((base + CRISTA) / SEG),
      fase: "giro", valeAlvo, hangAte: 0, flapAng: 0, flapVel: 0,
    };

    let anterior = performance.now();

    const passo = (agora: number) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const e = st.current;

      if (e.fase === "giro" || e.fase === "catraca") {
        e.vel -= e.atrito * dt;
        if (e.vel < p.limiarCatraca && e.fase === "giro") e.fase = "catraca";
        e.ang += e.vel * dt;

        const pegAgora = Math.floor((e.ang + CRISTA) / SEG);
        if (pegAgora !== e.ultimoPeg) {
          const cruzados = Math.min(4, Math.abs(pegAgora - e.ultimoPeg));
          for (let k = 0; k < cruzados; k++) {
            const f = Math.min(1, e.vel / 900);
            if (som) tiquePeg(f);
            // NEGATIVO: com o pivô no topo, a ponta (abaixo dele) só acompanha
            // o giro para a direita se o ângulo for negativo.
            e.flapVel -= 190 + f * 620;
            if (e.fase === "catraca") e.vel = Math.max(0, e.vel - p.pedagio);
          }
          e.ultimoPeg = pegAgora;
        }

        if (e.vel <= 12) {
          if (p.pegHang && !e.hangAte) {
            e.fase = "hesitando";
            e.hangAte = agora + 220 + Math.random() * 180;
          } else e.fase = "settle";
        }
      } else if (e.fase === "hesitando") {
        const t = (e.hangAte - agora) / 400;
        e.ang += Math.sin(agora / 26) * 0.22 * Math.max(0, t);
        e.flapVel += Math.sin(agora / 26) * 9 * Math.max(0, t);
        if (agora >= e.hangAte) e.fase = "settle";
      } else if (e.fase === "settle") {
        const erro = e.valeAlvo - e.ang;
        e.vel += (p.rigidez * erro - p.amortecimento * e.vel) * dt;
        e.ang += e.vel * dt;

        const pegAgora = Math.floor((e.ang + CRISTA) / SEG);
        if (pegAgora !== e.ultimoPeg) {
          if (som) tiquePeg(0.1);
          e.flapVel -= 150;
          e.ultimoPeg = pegAgora;
        }

        if (Math.abs(erro) < 0.05 && Math.abs(e.vel) < 1.5) {
          e.ang = e.valeAlvo;
          setAngulo(e.valeAlvo);
          setFlap(0);
          raf.current = null;
          onFim();
          return;
        }
      }

      e.flapVel += (-330 * e.flapAng - 15 * e.flapVel) * dt;
      e.flapAng += e.flapVel * dt;
      if (e.flapAng < -16) { e.flapAng = -16; e.flapVel *= -0.3; }
      if (e.flapAng > 2) { e.flapAng = 2; e.flapVel *= -0.3; }

      setAngulo(e.ang);
      setFlap(e.flapAng);
      raf.current = requestAnimationFrame(passo);
    };

    raf.current = requestAnimationFrame(passo);
  }, [vencedor, SEG, CRISTA, som, onFim, preset, intensidade, params]);

  // Dispara UMA vez quando `girando` vira true. `rodou` evita que uma
  // re-renderização do pai reinicie o giro no meio.
  useEffect(() => {
    if (girando && !rodou.current) { rodou.current = true; rodar(); }
    if (!girando) rodou.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [girando]);

  const slicePath = (i: number) => {
    const [x0, y0] = polar(86, i * SEG - SEG / 2);
    const [x1, y1] = polar(86, i * SEG + SEG / 2);
    return `M${C},${C} L${x0},${y0} A86,86 0 ${SEG > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
  };

  return (
    <div className="relative mx-auto h-[300px] w-[300px] max-w-full">
      {/* ponteiro: preso em cima, ponta varrendo os pinos embaixo */}
      <div className="absolute left-1/2 top-[-11px] z-30"
        style={{ transform: `translateX(-50%) rotate(${flap}deg)`, transformOrigin: "50% 0%" }}>
        <div style={{
          width: 24, height: 24, background: chrome.pointer,
          borderRadius: "50% 50% 0 50%", transform: "rotate(45deg)",
          border: "3px solid #fff", boxShadow: "0 4px 9px rgba(0,0,0,.32)",
        }} />
      </div>

      <div className="h-full w-full" style={{ transform: `rotate(${angulo}deg)` }}>
        <svg viewBox="0 0 200 200" className="h-full w-full" style={{ filter: "drop-shadow(0 10px 22px rgba(0,0,0,.22))" }}>
          <circle cx={C} cy={C} r={97} fill={chrome.rim} />
          <circle cx={C} cy={C} r={88.5} fill="none" stroke={chrome.rimInner} strokeWidth={3} />
          {segments.map((s, i) => (
            <path key={i} d={slicePath(i)} fill={s.color}
              stroke={chrome.dark ? "rgba(0,0,0,.28)" : "#fffaf2"} strokeWidth="2" />
          ))}
          {/* pinos nas FRONTEIRAS — é neles que o ponteiro bate */}
          {Array.from({ length: N }, (_, k) => polar(93, k * SEG + CRISTA)).map(([x, y], k) => (
            <circle key={`p${k}`} cx={x} cy={y} r={2.6} fill={chrome.pegColor} />
          ))}
          {segments.map((s, i) => {
            // raio 62: mais para fora a fatia é mais larga (ver roleta-texto)
            const [tx, ty] = polar(62, i * SEG);
            // mesma regra da roleta clássica — antes eram duas cópias divergentes
            const fixo = s.labelSize != null;
            const { linhas, fontSize: fs } = s.labelLines?.length
              ? { linhas: s.labelLines, fontSize: s.labelSize ?? labelSize ?? 11 }
              : ajustarRotulo(
              s.label, N, 62, s.labelSize ?? labelSize ?? 11, fixo,
            );
            const dy0 = linhas.length === 1 ? "0" : `${-((linhas.length - 1) * 0.55)}em`;
            return (
              <text key={`t${i}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${i * SEG} ${tx} ${ty})`} fontSize={fs} fontWeight={800}
                fill={contraste(s.color)} style={{ letterSpacing: ".2px" }}>
                {linhas.length === 1 ? linhas[0] : linhas.map((l, j) => (
                  <tspan key={j} x={tx} dy={j === 0 ? dy0 : "1.1em"}>{l}</tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-md"
        style={{ width: hubR, height: hubR, background: hub, border: `6px solid ${hubInner}` }}>
        {centerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={centerImage} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
    </div>
  );
}
