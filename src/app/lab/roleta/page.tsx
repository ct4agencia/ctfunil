"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Parâmetros e presets moram em `fisica.ts` para poderem ser verificados por
// `scripts/check-roleta.mjs` — dentro deste arquivo eles não são exportáveis, e
// um teste teria de replicá-los (testando a cópia, não o que roda).
import { type Params, PADRAO, LIMITES, comIntensidade, PRESETS, ESCALA } from "./fisica";

/**
 * LABORATÓRIO da roleta com física — rota /lab/roleta.
 *
 * NÃO é a roleta de produção. `RouletteStepView` (components/quiz/steps.tsx:141)
 * segue intacta. Aqui se valida o movimento antes de mexer no funil pago.
 *
 * TRÊS COISAS QUE A DE PRODUÇÃO NÃO FAZ
 *
 * 1. SOM VEM DO MOVIMENTO. Lá, a roda anima por `motion` declarativo e o som
 *    sai de `playSpinTicks(4200)`, que agenda 30 tiques numa curva SEPARADA —
 *    nenhum tique corresponde a um pino real cruzando o ponteiro. Aqui a roda é
 *    integrada quadro a quadro e cada tique nasce de uma passagem de verdade.
 *    Desacelerar espaça os tiques sozinho; não há o que sincronizar.
 *
 * 2. O PONTEIRO TEM PESO. Ele é um pêndulo com mola e amortecimento: cada pino
 *    que passa lhe dá um empurrão proporcional à velocidade da roda, e ele
 *    volta oscilando. Em velocidade alta mal se recupera entre um pino e outro
 *    (fica vibrando); devagar, ele cai inteiro em cada vão.
 *
 * 3. O FIM É SIMULADO, não animado. Três fases: giro livre → catraca (cada pino
 *    cobra energia; é o "quase parou") → settle (mola amortecida rumo ao centro
 *    da fatia; se o ponteiro subiu a rampa, a roda RECUA — o backdrag).
 *    O "peg hang" é uma quarta fase explícita: a roda equilibra sobre a crista
 *    do pino, hesita, e tomba.
 *
 * O prêmio é sorteado ANTES do giro e o vale de destino fica guardado; a mola
 * do settle mira NELE, nunca no vale mais próximo. Sem isso, um overshoot maior
 * que meia fatia entregaria um prêmio diferente do sorteado.
 */

// ── modelo ───────────────────────────────────────────────────────────────────

const SEGMENTOS = [
  { label: "ACESSO GRÁTIS", color: "#1a7a3e" },
  { label: "25% OFF", color: "#7bc98d" },
  { label: "Não foi dessa vez", color: "#d64545" },
  { label: "15% OFF", color: "#9fd9ab" },
  { label: "Tente de novo", color: "#3f3f46" },
];

const N = SEGMENTOS.length;
const SEG = 360 / N;
/** Um pino por fronteira de fatia — é neles que o ponteiro bate. */
const PASSO_PEG = SEG;
/** Deslocamento das cristas em relação aos centros de fatia. */
const CRISTA = SEG / 2;

/** Estilo "soft" do construtor (steps.tsx:60-64) — o mesmo do print. */
const CH = {
  rim: "#f3ead9",
  rimInner: "#e2d1b0",
  pegColor: "#e2d1b0",
  hub: "#fdf8ef",
  hubInner: "#eef5f0",
  hubR: 94,
  pointer: "#2f6fd0",
};

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
 * Tique de UM pino. `forca` (0..1) vem da velocidade no instante da passagem:
 * rápido = agudo e seco (a lâmina mal encosta); lento = grave e com corpo (ela
 * raspa). É o que faz o ouvido perceber a desaceleração sem nenhuma curva de
 * áudio programada.
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

function tocarVitoria() {
  const c = ac();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = c.currentTime + i * 0.11;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.55);
  });
}

// ── geometria (mesma da roleta de produção) ──────────────────────────────────

const C = 100;
const polar = (r: number, a: number): [number, number] => {
  const rad = ((a - 90) * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(C + r * Math.cos(rad)), round(C + r * Math.sin(rad))];
};
const slicePath = (i: number) => {
  const [x0, y0] = polar(86, i * SEG - SEG / 2);
  const [x1, y1] = polar(86, i * SEG + SEG / 2);
  return `M${C},${C} L${x0},${y0} A86,86 0 ${SEG > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
};

const CHAVE_SALVA = "ct4-roleta-intensidades";

export default function LabRoleta() {
  const [p, setP] = useState<Params>(PADRAO);
  const [angulo, setAngulo] = useState(0);
  const [flap, setFlap] = useState(0);          // ângulo do ponteiro (graus)
  const [girando, setGirando] = useState(false);
  const [premio, setPremio] = useState<string | null>(null);
  const [fase, setFase] = useState<"parada" | "giro" | "catraca" | "hesitando" | "settle">("parada");
  const [log, setLog] = useState<string[]>([]);
  const [som, setSom] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [intensidades, setIntensidades] = useState<Record<string, number>>({});
  const [salvo, setSalvo] = useState(false);

  const raf = useRef<number | null>(null);
  const st = useRef({
    ang: 0, vel: 0, atrito: 0, ultimoPeg: 0, fase: "parada" as string,
    valeAlvo: 0, hangAte: 0, flapAng: 0, flapVel: 0,
  });

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE_SALVA);
      if (!raw) return;
      const guardado = JSON.parse(raw) || {};
      // A régua já foi ±100. Um valor salvo naquela escala (ex.: 40) seria
      // quatro vezes o máximo de hoje, então converte em vez de descartar —
      // quem já tinha ajustado não perde o que escolheu.
      const migrado: Record<string, number> = {};
      for (const [k, v] of Object.entries(guardado)) {
        const n = Number(v) || 0;
        migrado[k] = Math.max(-ESCALA, Math.min(ESCALA, Math.abs(n) > ESCALA ? Math.round(n / 10) : n));
      }
      setIntensidades(migrado);
    } catch { /* localStorage é editável pelo usuário: JSON quebrado não derruba a página */ }
  }, []);

  const intensidadeDe = (nome: string) => intensidades[nome] ?? 0;
  const setIntensidade = (nome: string, v: number) => {
    setIntensidades((o) => ({ ...o, [nome]: v }));
    setSalvo(false);
  };
  const salvar = () => {
    try { localStorage.setItem(CHAVE_SALVA, JSON.stringify(intensidades)); setSalvo(true); } catch { /* ignora */ }
  };

  const girar = useCallback(() => {
    if (girando) return;
    setGirando(true); setPremio(null); setLog([]);
    ac(); // destrava o áudio no gesto do usuário

    const vencedor = Math.floor(Math.random() * N);
    const base = st.current.ang;

    // Vale (centro da fatia) que deixa o vencedor sob o ponteiro. Guardado:
    // a mola do settle mira NELE, não no vale mais próximo — senão um overshoot
    // maior que meia fatia entregaria outro prêmio.
    const bruto = base + p.voltas * 360;
    const valeAlvo = bruto + ((360 - (((bruto % 360) + vencedor * SEG) % 360)) % 360);

    // No peg hang a roda MIRA A CRISTA anterior ao vale: chega lá sem energia,
    // equilibra, hesita e tomba para dentro da fatia. Sem hang, mira um pouco
    // além do vale — é esse excesso que a mola devolve como recuo.
    const alvo = p.pegHang ? valeAlvo - CRISTA + 0.4 : valeAlvo + p.overshoot;

    // Atrito que percorre a distância no tempo pedido (d = v0·t/2).
    const distancia = alvo - base;
    const v0 = (2 * distancia) / p.duracaoAlvo;

    st.current = {
      ang: base, vel: v0, atrito: v0 / p.duracaoAlvo,
      ultimoPeg: Math.floor((base + CRISTA) / PASSO_PEG),
      fase: "giro", valeAlvo, hangAte: 0,
      flapAng: st.current.flapAng, flapVel: st.current.flapVel,
    };
    setFase("giro");

    let anterior = performance.now();
    let tiques = 0;
    let recuo = 0;

    const passo = (agora: number) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const e = st.current;
      const antes = e.ang;

      if (e.fase === "giro" || e.fase === "catraca") {
        e.vel -= e.atrito * dt;
        if (e.vel < p.limiarCatraca && e.fase === "giro") { e.fase = "catraca"; setFase("catraca"); }
        e.ang += e.vel * dt;

        // Cristas ficam em múltiplos de PASSO_PEG deslocados de CRISTA.
        const pegAgora = Math.floor((e.ang + CRISTA) / PASSO_PEG);
        if (pegAgora !== e.ultimoPeg) {
          const cruzados = Math.min(4, Math.abs(pegAgora - e.ultimoPeg));
          for (let k = 0; k < cruzados; k++) {
            const f = Math.min(1, e.vel / 900);
            if (som) tiquePeg(f);
            // Empurrão NEGATIVO. Com o pivô no topo, um ponto abaixo dele vai
            // para a ESQUERDA quando a rotação é positiva (horária) — logo, para
            // a ponta seguir a roda, que gira para a direita, o ângulo precisa
            // ser negativo. Com sinal positivo o ponteiro levantava contra o
            // movimento, que é o que se via na tela.
            e.flapVel -= 190 + f * 620;
            tiques++;
            if (e.fase === "catraca") e.vel = Math.max(0, e.vel - p.pedagio);
          }
          e.ultimoPeg = pegAgora;
        }

        if (e.vel <= 12) {
          if (p.pegHang && !e.hangAte) {
            // HESITAÇÃO: equilibra sobre a crista antes de tombar. Curta de
            // propósito — 220 a 400 ms. Acima disso o olho lê como travamento
            // ("a roleta bugou"), não como suspense; o efeito precisa ser um
            // susto, não uma pausa.
            e.fase = "hesitando";
            e.hangAte = agora + 220 + Math.random() * 180;
            setFase("hesitando");
          } else {
            e.fase = "settle"; setFase("settle");
          }
        }
      } else if (e.fase === "hesitando") {
        // Equilíbrio instável: a roda treme sobre a crista, sem decidir. O
        // tremor é pequeno e some — o que o olho lê como "vai cair pra onde?".
        // tremor rápido e que já vai morrendo: some junto com o tempo restante
        const t = (e.hangAte - agora) / 400;
        e.ang += Math.sin(agora / 26) * 0.22 * Math.max(0, t);
        e.flapVel += Math.sin(agora / 26) * 9 * Math.max(0, t);
        if (agora >= e.hangAte) { e.fase = "settle"; setFase("settle"); }
      } else if (e.fase === "settle") {
        // Mola amortecida rumo ao vale SORTEADO. Se o ponteiro subiu a rampa,
        // o vale fica atrás e a roda recua: o backdrag sai daqui, não de uma
        // animação desenhada.
        const erro = e.valeAlvo - e.ang;
        e.vel += (p.rigidez * erro - p.amortecimento * e.vel) * dt;
        e.ang += e.vel * dt;
        if (e.ang < antes) recuo += antes - e.ang;

        const pegAgora = Math.floor((e.ang + CRISTA) / PASSO_PEG);
        if (pegAgora !== e.ultimoPeg) {
          if (som) tiquePeg(0.1);
          e.flapVel -= 150;   // mesmo sentido do giro (ver nota no impulso acima)
          e.ultimoPeg = pegAgora;
        }

        if (Math.abs(erro) < 0.05 && Math.abs(e.vel) < 1.5) {
          e.ang = e.valeAlvo;
          setAngulo(e.valeAlvo);
          setPremio(SEGMENTOS[vencedor].label);
          setFase("parada"); setGirando(false);
          if (som) tocarVitoria();
          setLog([`${tiques} tiques`, `recuo total: ${recuo.toFixed(1)}°`, `prêmio: ${SEGMENTOS[vencedor].label}`]);
          raf.current = null;
          return;
        }
      }

      // PONTEIRO: pêndulo com mola e amortecimento. Cada pino lhe dá um
      // empurrão (acima); aqui ele volta ao repouso oscilando. Em velocidade
      // alta não dá tempo de voltar — fica vibrando, como o de verdade.
      //
      // Com o pivô no TOPO, o mesmo ângulo desloca muito mais a ponta, então a
      // mola é mais firme e o batente menor: 16° já é uma varrida larga.
      //
      // Os batentes são espelhados junto com o sinal do impulso: a deflexão útil
      // agora é NEGATIVA (ponta acompanhando a roda), e o lado positivo é só o
      // repique curto da volta.
      e.flapVel += (-330 * e.flapAng - 15 * e.flapVel) * dt;
      e.flapAng += e.flapVel * dt;
      if (e.flapAng < -16) { e.flapAng = -16; e.flapVel *= -0.3; }  // batente
      if (e.flapAng > 2) { e.flapAng = 2; e.flapVel *= -0.3; }

      setAngulo(e.ang);
      setFlap(e.flapAng);
      raf.current = requestAnimationFrame(passo);
    };

    raf.current = requestAnimationFrame(passo);
  }, [girando, p, som]);

  const campo = (
    k: keyof Params, min: number, max: number, step: number,
    rotulo: string, explica: string, menos: string, mais: string,
  ) => (
    <div className="border-t border-neutral-100 pt-2.5 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-700">{rotulo}</span>
        <b className="text-xs tabular-nums text-neutral-900">{p[k] as number}</b>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{explica}</p>
      <input type="range" min={min} max={max} step={step} value={p[k] as number}
        onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })}
        className="mt-1.5 w-full accent-neutral-900" />
      <div className="flex justify-between text-[10px] text-neutral-400">
        <span>← {menos}</span><span>{mais} →</span>
      </div>
    </div>
  );

  const detalhes = (
    <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
      {campo("voltas", 2, 10, 1, "Quantas voltas ela dá",
        "Só o tamanho do giro. Não muda o suspense do fim.", "curto", "longo")}
      {campo("duracaoAlvo", 2, 8, 0.2, "Duração do giro (segundos)",
        "Quanto tempo até começar a assentar. Acima de 5 s cansa no celular.", "2 s", "8 s")}
      {campo("limiarCatraca", 60, 400, 10, "Quando o suspense começa",
        "A partir de que velocidade os pinos passam a segurar a roda.", "só no fim", "bem antes")}
      {campo("pedagio", 0, 40, 1, "Força com que o pino segura",
        "O quanto cada pino rouba de embalo. Faz ela quase parar e vencer mais um.", "escorrega", "agarra")}
      {campo("overshoot", 0, 20, 1, "Quanto ela passa do ponto",
        "O principal para o RECUO. Em zero ela encaixa seco, sem voltar atrás.", "sem recuo", "recua muito")}
      {campo("amortecimento", 2, 20, 0.5, "Quanto ela balança no fim",
        "Baixo = vai e volta antes de assentar. Alto = encaixa de primeira.", "balança", "firme")}
      {campo("rigidez", 40, 300, 10, "Força do encaixe final",
        "A puxada para o centro da fatia. Alta = encaixe rápido e decidido.", "molenga", "seco")}
      <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-neutral-100 pt-2.5 text-xs">
        <span>
          <b className="text-neutral-700">Parar em cima do pino</b>
          <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
            A roda equilibra na divisória, hesita por um instante e tomba.
          </span>
        </span>
        <input type="checkbox" checked={p.pegHang} onChange={(e) => setP({ ...p, pegHang: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
      </label>
      <button onClick={() => setP(PADRAO)} className="text-[11px] text-neutral-400 underline">restaurar padrão</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1e3d] px-5 py-8 text-neutral-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-lg font-bold text-white">Laboratório — roleta com física</h1>
        <p className="mt-1 text-xs text-white/60">
          O som nasce da passagem real do pino pelo ponteiro, e o ponteiro tem peso próprio.
        </p>

        <div className="relative mx-auto mt-7 h-[300px] w-[300px]">
          {/* PONTEIRO — mesma forma da roleta de produção (steps.tsx:236):
              `borderRadius: 50% 50% 0 50%` + rotate(45°) dá a gota angular com
              a PONTA para baixo, virada para os pinos.

              Dois níveis de transform de propósito: o de fora aplica a física,
              o de dentro só desenha a forma. Num só, o rotate(45°) da forma
              entraria na conta da física e o ponteiro pendularia torto.

              PIVÔ NO TOPO (`50% 0%`): o flapper de verdade é preso em cima, no
              suporte, e é a PONTA DE BAIXO que varre os pinos. Com o pivô na
              ponta era o contrário — ela ficava cravada e o corpo balançava no
              ar, que é o oposto do movimento real. */}
          <div className="absolute left-1/2 top-[-11px] z-30"
            style={{ transform: `translateX(-50%) rotate(${flap}deg)`, transformOrigin: "50% 0%" }}>
            <div style={{
              width: 24, height: 24, background: CH.pointer,
              borderRadius: "50% 50% 0 50%", transform: "rotate(45deg)",
              border: "3px solid #fff", boxShadow: "0 4px 9px rgba(0,0,0,.32)",
            }} />
          </div>

          <div className="h-full w-full" style={{ transform: `rotate(${angulo}deg)` }}>
            <svg viewBox="0 0 200 200" className="h-full w-full" style={{ filter: "drop-shadow(0 10px 22px rgba(0,0,0,.35))" }}>
              <circle cx={C} cy={C} r={97} fill={CH.rim} />
              <circle cx={C} cy={C} r={88.5} fill="none" stroke={CH.rimInner} strokeWidth={3} />
              {SEGMENTOS.map((s, i) => (
                <path key={i} d={slicePath(i)} fill={s.color} stroke="#fffaf2" strokeWidth="2" />
              ))}
              {/* pinos nas FRONTEIRAS — é neles que o ponteiro bate */}
              {Array.from({ length: N }, (_, k) => polar(93, k * PASSO_PEG + CRISTA)).map(([x, y], k) => (
                <circle key={`p${k}`} cx={x} cy={y} r={2.6} fill={CH.pegColor} />
              ))}
              {SEGMENTOS.map((s, i) => {
                const [tx, ty] = polar(58, i * SEG);
                const palavras = s.label.split(" ");
                const linhas = palavras.length > 1
                  ? [palavras.slice(0, Math.ceil(palavras.length / 2)).join(" "), palavras.slice(Math.ceil(palavras.length / 2)).join(" ")]
                  : [s.label];
                return (
                  <text key={`t${i}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${i * SEG} ${tx} ${ty})`} fontSize={10} fontWeight={800} fill="#fff">
                    {linhas.length === 1 ? linhas[0] : linhas.map((l, j) => (
                      <tspan key={j} x={tx} dy={j === 0 ? "-0.5em" : "1.1em"}>{l}</tspan>
                    ))}
                  </text>
                );
              })}
            </svg>
          </div>
          {/* miolo grande, como no estilo soft */}
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md"
            style={{ width: CH.hubR, height: CH.hubR, background: CH.hub, border: `6px solid ${CH.hubInner}` }} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={girar} disabled={girando}
            className="rounded-xl bg-white px-7 py-3 text-sm font-bold text-[#0f1e3d] disabled:opacity-40">
            {girando ? "Girando…" : "Girar"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-white/70">
            <input type="checkbox" checked={som} onChange={(e) => setSom(e.target.checked)} className="h-4 w-4 accent-white" />
            som
          </label>
        </div>

        <p className="mt-3 text-center text-sm text-white/80">
          <span className="text-white/40">fase:</span> <b>{fase}</b>
          {premio ? <> · <span className="text-white/40">prêmio:</span> <b className="text-green-300">{premio}</b></> : null}
        </p>

        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Sugestões — clique e gire</p>
          <div className="mt-2.5 grid gap-2">
            {PRESETS.map((pr) => {
              const ehCustom = pr.nome === "Personalizado";
              const n = intensidadeDe(pr.nome);
              const efetivo = ehCustom ? p : comIntensidade(pr.params, pr.dir, n);
              const ativo = aberto === pr.nome;
              return (
                <div key={pr.nome}
                  className={`rounded-lg border p-2.5 transition ${ativo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}>
                  <button
                    onClick={() => {
                      setAberto(pr.nome);            // clicar em outro fecha este
                      if (!ehCustom) setP(efetivo);  // "Personalizado" mantém o que está
                    }}
                    disabled={girando}
                    className="block w-full text-left disabled:opacity-40">
                    <span className="block text-xs font-bold">
                      {pr.nome}{ehCustom ? (ativo ? " ▾" : " ▸") : ""}
                    </span>
                    <span className={`block text-[11px] leading-snug ${ativo ? "text-neutral-300" : "text-neutral-500"}`}>
                      {pr.desc}
                    </span>
                  </button>

                  {/* "Personalizado" abre os controles finos no lugar da régua */}
                  {ehCustom ? (
                    ativo ? <div className="text-neutral-900">
                      <div className="mt-2 rounded-lg bg-white p-3">{detalhes}</div>
                    </div> : null
                  ) : (
                    <>
                      <p className="mt-2 text-[10px] text-neutral-400">{pr.eixo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="w-6 shrink-0 text-[10px] text-neutral-400">−{ESCALA}</span>
                        <span className="relative flex-1">
                          <span className={`pointer-events-none absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 ${ativo ? "bg-neutral-600" : "bg-neutral-300"}`} />
                          <input type="range" min={-ESCALA} max={ESCALA} step={1} value={n}
                            onChange={(e) => { setIntensidade(pr.nome, Number(e.target.value)); if (ativo) setP(comIntensidade(pr.params, pr.dir, Number(e.target.value))); }}
                            onDoubleClick={() => setIntensidade(pr.nome, 0)}
                            disabled={girando}
                            className="relative w-full accent-orange-500"
                            title="arraste para os lados · duplo clique volta ao 0" />
                        </span>
                        <span className="w-6 shrink-0 text-right text-[10px] text-neutral-400">+{ESCALA}</span>
                        <b className={`w-8 shrink-0 rounded px-1 py-0.5 text-center text-[11px] tabular-nums ${
                          n === 0 ? (ativo ? "bg-neutral-700 text-neutral-300" : "bg-neutral-100 text-neutral-500") : "bg-orange-500 text-white"
                        }`}>{n > 0 ? `+${n}` : n}</b>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => {
                const lista = PRESETS.filter((x) => x.nome !== "Personalizado");
                const pr = lista[Math.floor(Math.random() * lista.length)];
                setAberto(pr.nome);
                setP(comIntensidade(pr.params, pr.dir, intensidadeDe(pr.nome)));
              }}
              disabled={girando}
              className="flex-1 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
              🎲 Surpreenda-me
            </button>
            <button onClick={salvar} disabled={girando}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-40 ${
                salvo ? "bg-green-600 text-white" : "bg-neutral-900 text-white hover:bg-neutral-700"}`}>
              {salvo ? "✓ Salvo" : "Salvar"}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-neutral-400">
            0 = preset puro · duplo clique na régua volta ao 0 · Salvar guarda no navegador
          </p>
        </div>

        {log.length ? (
          <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
            {log.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-[11px] leading-relaxed text-white/60">
          <p className="font-semibold text-white/85">Por que o som acompanha sozinho</p>
          <p className="mt-1">
            Cada tique é um pino cruzando o ponteiro de verdade — não é trilha tocada
            por cima. Quando a roda desacelera, os tiques espaçam porque os pinos estão
            passando mais devagar. O ponteiro também é físico: leva um empurrão de cada
            pino e volta oscilando.
          </p>
          <p className="mt-1.5 text-white/40">
            O prêmio é sorteado ANTES do giro e a mola do fim mira exatamente nele.
            A física decide como a roda chega, nunca onde ela para.
          </p>
        </div>
      </div>
    </div>
  );
}
