"use client";

import { useRef, useState } from "react";
import { FunnelChart } from "@/components/ui/funnel-chart";
import type { FunnelMetrics } from "@/lib/quiz/metrics";

/**
 * Tela de Performance do funil.
 *
 * Cor com SIGNIFICADO (antes era `COLORS[i % 5]`, puramente decorativo):
 *   azul   = volume (visitantes, respostas)
 *   verde  = dinheiro (leads, conclusões)
 *   VERMELHO = erro e queda. Só isso. Antes o "0.0 Crítico" gritava vermelho
 *   para um funil que simplesmente não tinha recebido tráfego.
 */
const C = {
  volume: "#3b82f6",
  volume2: "#6366f1",
  dinheiro: "#16a34a",
  dinheiro2: "#0ea5e9",
} as const;
const CORES_FUNIL = [C.volume, C.volume2, "#8b5cf6", C.dinheiro, "#0d9488"];

const nf = (n: number) => n.toLocaleString("pt-BR");

function fmtTime(s: number): string {
  if (s <= 0) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

const IC = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">{d}</svg>;
const ICONS = {
  gauge: IC(<><path d="M12 15a2 2 0 1 0-2-2" /><path d="m13.6 10.4-1.6 2.6" /><path d="M4 19a8 8 0 1 1 16 0" /></>),
  eye: IC(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>),
  spark: IC(<><path d="m9 9 5 12 1.6-5.4L21 14 9 9Z" /><path d="M7.5 2.5 8 5M2.5 7.5 5 8M14 2.5 13.5 5" /></>),
  steps: IC(<><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="7" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="17" rx="1" /></>),
  clock: IC(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
} as const;

/** Ajuda em popover. O `title=` nativo é invisível no toque — e é justamente
 *  onde moram as DEFINIÇÕES que o Luca usa pra conferir os números. */
function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label={text}
        className="grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full border border-neutral-300 text-[9px] font-bold text-neutral-400 hover:border-neutral-500 hover:text-neutral-600"
      >?</button>
      {open ? (
        <span className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2.5 text-[11px] font-normal leading-relaxed text-neutral-600 shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function Delta({ v, compacto }: { v?: number; compacto?: boolean }) {
  if (v == null || !isFinite(v)) return null;
  const up = v >= 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px]">
      <span className={`rounded-md px-1.5 py-0.5 font-bold tabular-nums ${up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>{up ? "+" : ""}{v}%</span>
      {!compacto ? <span className="text-neutral-400">vs período anterior</span> : null}
    </span>
  );
}

function Card({ label, value, icon, delta, help }: { label: string; value: React.ReactNode; icon?: React.ReactNode; delta?: number; help?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
        {help ? <Help text={help} /> : null}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xl font-bold text-neutral-900">
        {icon ? <span className="text-neutral-300">{icon}</span> : null}
        {value}
      </div>
      {delta != null ? <div className="mt-1.5"><Delta v={delta} compacto /></div> : null}
    </div>
  );
}

/** Altura de cada faixa do cone, em px. É o que alinha o desenho (SVG contínuo)
 *  com a coluna de números ao lado. */
const CONE_ROW = 54;

/**
 * Funil em CONE.
 *
 * O trapézio da 1ª versão mentia duas vezes: `Math.max(6, pct)` dava a 0,5% a
 * mesma largura de 6%, e o `clipPath` sem teto estourava a caixa quando o
 * percentual passava de 100. Aqui a largura é ESTRITAMENTE proporcional
 * (`pct/100`, sem piso) e o `pct` chega limitado a 100, então o formato de cone
 * volta sem trazer a distorção junto — uma etapa de 0,5% aparece como um fio,
 * que é a verdade.
 *
 * O desenho é um SVG único (as fatias precisam encostar umas nas outras) e os
 * números ficam numa coluna à direita, alinhados pela mesma altura de faixa.
 *
 * `overflow-hidden` no wrapper do gráfico: o FunnelChart é `overflow-visible` de
 * ponta a ponta (container, wrapper do segmento e o próprio <svg>), então
 * qualquer estouro do desenho — entrada com mola subamortecida, hover, viewBox
 * fracionário — sai por cima do card em vez de ficar contido. O corte não perde
 * nada legítimo: em `vertical`, cada fatia vai de x = W/2 ± 0,44·W (o `0.44` de
 * `vSegmentPath`), ou seja no MÁXIMO de 6% a 94% da largura, e o anel externo no
 * hover escala 1,12 → 0,7% a 99,3%; no eixo Y o Bézier tem todos os pontos de
 * controle entre 0 e segH. A fatia de 100% cabe inteira dentro da caixa.
 */
function Funil({ stages }: { stages: FunnelMetrics["funil"] }) {
  const n = stages.length;
  if (!n) return null;

  const dados = stages.map((s, i) => ({
    label: s.label,
    value: s.value,
    displayValue: nf(s.value),
    color: CORES_FUNIL[i % CORES_FUNIL.length],
    // `pctReal`: o percentual vai PRONTO, nunca recalculado de value/max —
    // senão o número aqui diverge do card de Leads na mesma tela.
    pctReal: s.pct,
  }));

  return (
    <div className="mt-3 flex items-start gap-4">
      <div className="min-w-0 flex-1 overflow-hidden">
        <FunnelChart
          data={dados}
          orientation="vertical"
          layers={3}
          edges="curved"
          gap={2}
          staggerDelay={0.08}
          formatPercentage={(p) => `${p}%`}
          showLabels={false}
          style={{ aspectRatio: "auto", height: n * CONE_ROW }}
        />
      </div>

      <div className="w-[230px] shrink-0">
        {stages.map((s, i) => {
          const ant = i > 0 ? stages[i - 1] : null;
          const queda = ant && ant.value > 0 ? Math.round(((s.value - ant.value) / ant.value) * 1000) / 10 : null;
          // `boxSizing` explícito: a borda de 1px tem que caber DENTRO dos 54px,
          // senão cada linha vira 55 e a coluna descola do cone lá embaixo.
          return (
            <div key={s.label} className="flex flex-col justify-center border-b border-neutral-100 last:border-0" style={{ height: CONE_ROW, boxSizing: "border-box" }}>
              <div className="flex items-baseline gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CORES_FUNIL[i % CORES_FUNIL.length] }} />
                <span className="truncate text-xs font-semibold text-neutral-700">{s.label}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2 pl-3.5">
                <span className="text-sm font-bold tabular-nums text-neutral-900">{nf(s.value)}</span>
                <span className="text-[11px] tabular-nums text-neutral-500">{s.pct}%</span>
                {queda != null && queda < 0 ? (
                  <span className="ml-auto text-[11px] font-semibold tabular-nums text-red-500">{queda}%</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Série temporal das ÚLTIMAS 24 HORAS — nunca do período selecionado.
 *  `metrics.ts` monta 24 baldes fixos a partir de `now` e descarta sessão mais
 *  velha que isso, mas o período TAMBÉM filtra a query: o que sobra é a
 *  interseção dos dois. Por isso um dia passado deixa o bloco vazio.
 *  A legenda liga/desliga cada linha: com as 4 juntas, "visitantes" esmagava as
 *  outras três contra o eixo. */
function Trafego({ data }: { data: FunnelMetrics["trafego"] }) {
  // W/H são o sistema de coordenadas do viewBox, não o tamanho na tela: o <svg>
  // vai com `preserveAspectRatio="none"` porque o padrão (xMidYMid meet) para de
  // esticar acima de 680px de container e centraliza o desenho — os rótulos de
  // hora (posicionados por left:%) e o hover, que leem a largura do wrapper,
  // descolariam do traçado. Mesmo motivo do SVG do Funil.
  const W = 680, H = 190, pad = 10, padL = 30;
  const series = [
    { k: "visitantes", c: C.volume, label: "Visitantes" },
    { k: "respostas", c: C.volume2, label: "Respostas" },
    { k: "leads", c: C.dinheiro, label: "Leads" },
    { k: "conclusoes", c: C.dinheiro2, label: "Conclusões" },
  ] as const;
  const [off, setOff] = useState<Set<string>>(new Set());
  const vis = series.filter((s) => !off.has(s.k));
  const max = Math.max(1, ...data.map((d) => Math.max(0, ...vis.map((s) => d[s.k]))));
  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (W - padL - pad);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 14);
  /**
   * Curva suave com controles SÓ na horizontal. Um spline comum (Catmull-Rom)
   * daria overshoot: entre dois pontos baixos a curva desceria abaixo de ambos
   * e o gráfico mostraria tráfego negativo. Assim o Y de cada trecho fica
   * sempre entre os dois valores reais.
   */
  const path = (k: (typeof series)[number]["k"]) => data.map((d, i) => {
    const px = x(i), py = y(d[k]);
    if (i === 0) return `M${px.toFixed(1)},${py.toFixed(1)}`;
    const ax = x(i - 1), ay = y(data[i - 1][k]);
    const cx = (ax + px) / 2;
    return `C${cx.toFixed(1)},${ay.toFixed(1)} ${cx.toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");
  /** mesma curva, fechada no eixo — é o preenchimento sob a linha */
  const area = (k: (typeof series)[number]["k"]) =>
    `${path(k)} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const [hi, setHi] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotL = padL / W, plotR = (W - pad) / W;
  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current; if (!el || !data.length) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width - plotL) / (plotR - plotL)));
    setHi(Math.round(t * (data.length - 1)));
  };
  const hd = hi != null ? data[hi] : null;
  const leftPct = hi != null ? (x(hi) / W) * 100 : 0;
  const tx = leftPct < 16 ? "0%" : leftPct > 84 ? "-100%" : "-50%";

  if (!data.some((d) => d.visitantes > 0)) {
    return (
      <p className="px-4 py-12 text-center text-sm leading-relaxed text-neutral-400">
        Sem tráfego nas últimas 24 horas.
        <br />
        <span className="text-[11px]">Este bloco só desenha essa janela — se o período selecionado for passado, ele fica vazio mesmo com visitas.</span>
      </p>
    );
  }
  return (
    <div>
      <div ref={wrapRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 190 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.k} id={`tf-${s.k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.c} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.c} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={padL} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="#0000000d" strokeDasharray="3 4" />)}
          {[0, 0.5, 1].map((g) => <text key={`t${g}`} x={padL - 6} y={y(max * g) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{nf(Math.round(max * g))}</text>)}
          {vis.map((s) => <path key={`a-${s.k}`} d={area(s.k)} fill={`url(#tf-${s.k})`} stroke="none" />)}
          {vis.map((s) => <path key={s.k} d={path(s.k)} fill="none" stroke={s.c} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
          {hi != null && hd ? <line x1={x(hi)} x2={x(hi)} y1={pad} y2={H - pad} stroke="#00000022" /> : null}
          {hi != null && hd ? vis.map((s) => <circle key={s.k} cx={x(hi)} cy={y(hd[s.k])} r={3.5} fill="#fff" stroke={s.c} strokeWidth={2} />) : null}
        </svg>
        {hd ? (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] shadow-lg" style={{ left: `${leftPct}%`, transform: `translateX(${tx})` }}>
            <div className="mb-1 font-bold text-neutral-800">{hd.hour}</div>
            {vis.map((s) => <div key={s.k} className="font-semibold tabular-nums" style={{ color: s.c }}>{s.label}: {nf(hd[s.k])}</div>)}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
        {series.map((s) => {
          const ligada = !off.has(s.k);
          return (
            <button key={s.k} onClick={() => setOff((p) => { const n = new Set(p); if (n.has(s.k)) n.delete(s.k); else n.add(s.k); return n; })}
              className={`flex items-center gap-1.5 rounded px-1 ${ligada ? "text-neutral-600" : "text-neutral-300"}`}
              title={ligada ? "Ocultar esta linha" : "Mostrar esta linha"}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ligada ? s.c : "#d4d4d4" }} />{s.label}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-neutral-400" style={{ paddingLeft: `${plotL * 100}%`, paddingRight: `${(1 - plotR) * 100}%` }}>
        {data.filter((_, i) => i % 3 === 0).map((d) => <span key={d.hour}>{d.hour}</span>)}
      </div>
    </div>
  );
}

const SLIDES = [
  { t: "Leads", b: "É o número que paga a conta, por isso está em destaque. Conta PESSOAS: o mesmo lead que enviou o formulário duas vezes conta uma. A linha de conferência embaixo do funil mostra quantos foram gravados, quantos eram duplicados e quantos não têm sessão." },
  { t: "O funil", b: "Cada etapa é um recorte da MESMA população (os visitantes), então uma etapa nunca pode superar a anterior. A porcentagem em vermelho é a queda em relação à etapa de cima — é onde você perde gente." },
  { t: "Conferência", b: "A linha embaixo do funil diz qual lâmina é cada estágio HOJE. Se você editar o funil, esses índices mudam e o histórico é reinterpretado — a linha existe pra isso ficar visível em vez de silencioso." },
  { t: "Tempo e dispositivos", b: "Tempo de navegação é a MEDIANA entre o primeiro e o último avanço de lâmina; não inclui o tempo parado na última lâmina vendo a VSL. Dispositivos vem dos LEADS (é a única tabela com esse dado), então não bate com o Meta Ads, que reporta por clique." },
];

export default function PerformanceView({ m, deltas }: { m: FunnelMetrics; deltas?: Record<string, number> | null }) {
  const [sum, setSum] = useState(false);
  const [si, setSi] = useState(0);
  const tier = m.score >= 76 ? "Ótimo" : m.score >= 51 ? "Bom" : m.score >= 26 ? "Regular" : "Crítico";

  // Campos que o banco não conseguiu calcular. Contrato: campo listado aqui
  // NUNCA sai como número — sai como "—". Erro de banco e funil sem tráfego
  // produziam a mesma tela de zeros, e não dava pra saber qual era.
  const invalidos = new Set((m.issues ?? []).flatMap((i) => i.campos));
  /** Função, não componente: componente declarado dentro do render remonta a
   *  cada ciclo (e o lint reprova). Aqui só precisamos do JSX. */
  const num = (campo: string, v: number, suf = "") =>
    invalidos.has(campo)
      ? <span className="text-neutral-300" title="Não foi possível calcular — veja o aviso no topo">—</span>
      : <span className="tabular-nums">{nf(v)}{suf}</span>;

  // ESTADO 1 — funil inexistente. `found` já existia e nunca era lido.
  if (!m.found) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-neutral-700">Funil não encontrado</p>
        <p className="mt-1 text-xs text-neutral-500">Verifique o endereço — o funil “{m.name}” não existe ou foi renomeado.</p>
      </div>
    );
  }

  const leads = m.funil.find((f) => /lead/i.test(f.label));
  const cf = m.conferencia;

  // RECÊNCIA — responde o que o total sozinho esconde: um funil parado há duas
  // semanas e um recebendo tráfego agora mostram o MESMO "122 visitantes".
  //
  // Vinha de somar `m.trafego`, o que só funcionava porque a série era travada
  // em 24h — o mesmo defeito que fazia o gráfico ignorar o período escolhido.
  // Agora tem campo próprio. `undefined` quando o período não alcança agora
  // (metrics.ts nem calcula), e aí a linha some em vez de mentir.
  //
  // Sem razão percentual, de propósito: as 24h reais NÃO são subconjunto do
  // período. Em "Hoje" às 10h elas incluem ontem à tarde, e a razão passaria de
  // 100%. Dois números lado a lado dizem a mesma coisa e não têm como mentir.
  const v24 = m.visitantes24h ?? null;

  return (
    <div className="space-y-4">
      {/* ESTADO 2 — degradado: aviso ANTES dos números */}
      {m.degraded && m.issues.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-600">Alguns números não puderam ser calculados</p>
          <ul className="mt-1.5 space-y-1">
            {m.issues.map((i, k) => <li key={k} className="text-sm text-red-700" title={i.detalhe || undefined}>• {i.msg}</li>)}
          </ul>
          <p className="mt-1.5 text-[11px] text-red-500">Os campos afetados aparecem como “—”. Não é o mesmo que zero.</p>
        </div>
      ) : null}

      {/* ESTADO 3 — vazio de verdade: sem tráfego, sem erro */}
      {!m.degraded && m.visitantes === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-600">Nenhuma visita neste período</p>
          <p className="mt-1 text-xs text-neutral-400">Troque o período acima ou envie tráfego para o funil.</p>
        </div>
      ) : (
      <>
        {/* Score vira CHIP: é opinião derivada, não fato — não pode ter o mesmo
            peso visual de "Visitantes", que é um número medido. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${m.score >= 51 ? "bg-green-50 text-green-700" : m.score >= 26 ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-500"}`}>
            Score {m.score.toFixed(0)} · {tier}
          </span>
          <Help text="Nota 0–100 composta por taxa de conclusão (60%) e taxa de interação (40%). É um resumo próprio, não um dado de plataforma — nenhuma ferramenta externa calcula isso igual." />
          <button onClick={() => { setSi(0); setSum(true); }} className="ml-auto rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⚡ Como ler esta tela</button>
        </div>

        {/* HERÓI (Leads) + 3 apoios. Leads é o que paga a conta e antes nem
            aparecia nos cards — só dentro do funil. */}
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-xl border-2 border-green-200 bg-white p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Leads</p>
              <Help text="Pessoas que deixaram os dados. Conta pessoa, não envio: o mesmo lead que preencheu duas vezes conta uma. Confira na linha abaixo do funil." />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">{num("leads", m.leads)}</span>
              {m.visitantes > 0 ? <span className="text-xs font-semibold tabular-nums text-neutral-400">{leads?.pct ?? 0}% dos visitantes</span> : null}
            </div>
            {deltas?.leads != null ? <div className="mt-2"><Delta v={deltas.leads} /></div> : null}
          </div>
          <Card label="Visitas" icon={ICONS.eye} value={num("visitantes", m.visitantes)} delta={deltas?.visitantes} help="Sessões que abriram o funil e o app chegou a montar (exclui quem carregou e saiu antes de renderizar)." />
          <Card label="Respostas" icon={ICONS.spark} value={num("respostas", m.respostas)} delta={deltas?.respostas} help="Quem chegou na 1ª pergunta de verdade. É o MESMO número da linha '1ª resposta' no funil — antes eram dois cálculos diferentes exibidos lado a lado." />
          <Card label="Conclusões" icon={ICONS.gauge} value={num("conclusoes", m.conclusoes)} delta={deltas?.conclusoes} help="Sessões que alcançaram a última lâmina ativa. É progresso posicional, não venda." />
        </div>

        {/* linha secundária: diagnóstico, não KPI */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">{ICONS.steps}<b className="tabular-nums text-neutral-700">{invalidos.has("mediaEtapas") ? "—" : `${Math.round(m.mediaEtapas)}/${m.totalSteps}`}</b> etapas em média</span>
          <span className="flex items-center gap-1.5">
            {ICONS.clock}<b className="tabular-nums text-neutral-700">{invalidos.has("tempoMedianoSeg") ? "—" : fmtTime(m.tempoMedianoSeg)}</b> de navegação
            <Help text={`Mediana entre o primeiro e o último avanço de lâmina, medida em ${nf(m.sessoesComTempo)} sessões que avançaram ao menos uma vez. NÃO inclui o tempo parado na última lâmina (ex.: assistindo a VSL).`} />
          </span>
          <span className="flex items-center gap-1.5"><b className="tabular-nums text-neutral-700">{num("taxaConclusao", m.taxaConclusao, "%")}</b> de conclusão</span>
          {/* rejeição sai do destaque: é literalmente 100 − interação */}
          <span className="ml-auto text-neutral-400">
            {invalidos.has("taxaRejeicao") ? "" : <>saíram sem interagir: <b className="tabular-nums text-neutral-500">{m.taxaRejeicao}%</b></>}
          </span>
        </div>

        {/* FUNIL em largura total: é o painel mais importante e antes dividia a
            linha com o gráfico, ficando com metade do espaço. */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
            Jornada do lead
            <Help text="Cada etapa é um recorte da MESMA população (os visitantes). Por construção, uma etapa nunca supera a anterior. O vermelho à direita é a queda em relação à etapa de cima." />
          </h2>
          <Funil stages={m.funil} />
          {cf || v24 != null ? (
            <div className="mt-4 space-y-0.5 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-500">
              {cf ? (
                <>
                  <p>
                    <b className="text-neutral-600">Conferência dos leads:</b> {nf(m.leads)} no funil · {nf(cf.leadsLinhas)} gravados
                    {cf.duplicados > 0 ? <> · <span title="mesmo lead enviou o formulário mais de uma vez">{cf.duplicados} duplicado{cf.duplicados > 1 ? "s" : ""}</span></> : null}
                    {cf.orfaos > 0 ? <> · <span title="lead sem sessão correspondente na base ou no período">{cf.orfaos} sem sessão</span></> : null}
                  </p>
                  <p>
                    1ª interação = card {cf.firstQ + 1} “{cf.labelFirstQ}” · Conclusão = card {cf.lastI + 1} “{cf.labelLastI}”
                    <span className="ml-1 text-neutral-400">— editar o funil muda esses índices e reinterpreta o histórico</span>
                  </p>
                </>
              ) : null}
              {v24 != null ? (
                <p>
                  <b className="text-neutral-600">Recência:</b> <span className="tabular-nums">{nf(v24)}</span> {v24 === 1 ? "visita" : "visitas"} nas últimas 24 h · <span className="tabular-nums">{nf(m.visitantes)}</span> no período selecionado
                  {v24 === 0 ? <span className="text-neutral-400"> — nada nesta janela: o funil está parado agora</span> : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* RETENÇÃO POR LÂMINA — responde "onde eu perco gente" com precisão de
            lâmina. Usa step_id (estável), não o índice do funil de 5 estágios. */}
        {m.retencao && m.retencao.length > 1 ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
              Retenção por lâmina
              <Help text="Sessões distintas que alcançaram cada lâmina, contadas pelo identificador da lâmina (não pela posição). Sobrevive a reordenar ou desativar lâmina. O vermelho é a queda em relação à lâmina anterior — a maior queda é o seu maior gargalo." />
            </h2>
            {(() => {
              // Só lâminas VIVAS e com volume: uma lâmina removida com 1 sessão
              // aparecia como "maior gargalo" do funil, o que é puro ruído.
              const base = m.retencao![0]?.sessoes ?? 0;
              const candidatas = m.retencao!.filter((r) => r.idx >= 0 && r.sessoes >= Math.max(3, base * 0.02));
              const pior = candidatas.length ? candidatas.reduce((a, b) => (b.queda < a.queda ? b : a)) : null;
              return (
                <>
                  {pior && pior.queda < -20 ? (
                    <p className="mt-2 text-[11px] text-neutral-500">
                      Maior gargalo: <b className="text-red-500">{pior.titulo}</b> — perde <b className="tabular-nums text-red-500">{Math.abs(pior.queda)}%</b> de quem chegou na lâmina anterior.
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-1.5">
                    {m.retencao!.map((r) => (
                      <div key={r.stepId} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-neutral-400">{r.idx >= 0 ? r.idx + 1 : "—"}</span>
                        <span className={`w-40 shrink-0 truncate text-[11px] ${r.idx < 0 ? "italic text-neutral-400" : "text-neutral-600"}`} title={r.titulo}>{r.titulo}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100">
                          <div className="h-full rounded" style={{ width: `${Math.max(0.6, r.pct)}%`, background: r.queda < -30 ? "#ef4444" : r.queda < -10 ? "#f59e0b" : C.volume }} />
                        </div>
                        <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-neutral-700">{nf(r.sessoes)}</span>
                        <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-red-500">{r.queda < 0 ? `${r.queda}%` : ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
              Tráfego
              <Help text="O período selecionado, hora a hora até 48 h e dia a dia acima disso. Clique na legenda para isolar uma linha: com as quatro juntas, 'visitantes' esmaga as outras contra o eixo." />
            </h2>
            <div className="mt-3"><Trafego data={m.trafego} /></div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Campanhas</h2>
            <p className="mt-2 text-[11px] text-neutral-400">
              {invalidos.has("totalRastreado") ? "—" : `${nf(m.totalRastreado)} sessões rastreadas`}
              {m.melhorOrigem && m.melhorOrigem !== "—" ? <> · melhor origem <b className="capitalize text-neutral-600">{m.melhorOrigem}</b></> : null}
            </p>
            <div className="mt-3 space-y-2">
              {m.campanhas.length ? m.campanhas.map((c, i) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="truncate font-medium text-neutral-700" title={c.name}>{c.name}</span>
                    <span className="tabular-nums text-neutral-500">{nf(c.value)} · {c.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, c.pct)}%`, background: CORES_FUNIL[i % CORES_FUNIL.length] }} />
                  </div>
                </div>
              )) : <p className="text-sm text-neutral-400">Sem UTMs rastreadas ainda.</p>}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
            Dispositivos
            <Help text="Mix de aparelho dos LEADS capturados (é a única tabela com esse dado). Não compare direto com o Meta Ads, que reporta por clique — as bases são diferentes." />
          </h2>
          {m.dispositivos && m.dispositivos.total > 0 ? (
            <>
              <p className="mt-2 text-[11px] text-neutral-400">
                de {nf(m.dispositivos.total)} lead{m.dispositivos.total > 1 ? "s" : ""}
                {m.dispositivos.semDado > 0 ? ` · ${nf(m.dispositivos.semDado)} sem dado` : ""}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  {m.dispositivos.tipo.map((d, i) => (
                    <div key={d.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-neutral-700">{d.label}</span>
                        <span className="tabular-nums text-neutral-500">{nf(d.value)} · {d.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(3, d.pct)}%`, background: CORES_FUNIL[i % CORES_FUNIL.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap content-start gap-1.5">
                  {m.dispositivos.so.map((s) => (
                    <span key={s.label} className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600">
                      {s.label} <span className="font-normal tabular-nums text-neutral-400">{s.pct}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 text-center text-sm text-neutral-400">Sem leads com dado de aparelho neste período.</p>
          )}
        </section>
      </>
      )}

      {sum ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSum(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Como ler esta tela</h2><button onClick={() => setSum(false)} className="text-neutral-400 hover:text-neutral-700">✕</button></div>
            <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-neutral-500">{SLIDES[si].t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{SLIDES[si].b}</p>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setSi((i) => Math.max(0, i - 1))} disabled={si === 0} className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40">‹</button>
              <div className="flex gap-1.5">{SLIDES.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === si ? "bg-neutral-900" : "bg-neutral-300"}`} />)}</div>
              <button onClick={() => setSi((i) => Math.min(SLIDES.length - 1, i + 1))} disabled={si === SLIDES.length - 1} className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40">›</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
