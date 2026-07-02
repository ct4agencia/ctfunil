"use client";

import { useRef, useState } from "react";
import type { FunnelMetrics } from "@/lib/quiz/metrics";

const COLORS = ["#3b82f6", "#ec4899", "#8b5cf6", "#f59e0b", "#10b981"];

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

/** Indicador "+X% vs período anterior" (verde sobe / vermelho desce). */
function Delta({ v }: { v?: number }) {
  if (v == null || !isFinite(v)) return null;
  const up = v >= 0;
  return <span className={`mt-1 inline-block text-[11px] font-semibold ${up ? "text-green-600" : "text-red-500"}`}>{up ? "+" : ""}{v}% <span className="font-normal text-neutral-400">vs período anterior</span></span>;
}

function Card({ label, value, sub, delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold text-neutral-500">{label}</p>
      <div className="mt-1.5 text-2xl font-bold text-neutral-900">{value}</div>
      {delta != null ? <Delta v={delta} /> : sub ? <div className="mt-1 text-[11px] text-neutral-400">{sub}</div> : null}
    </div>
  );
}

/** Funil trapézio invertido (Visitantes → Respostas → Leads → Conclusões). */
function Funnel({ stages }: { stages: FunnelMetrics["funil"] }) {
  return (
    <div className="mt-4 space-y-1">
      {stages.map((s, i) => {
        const top = Math.max(6, s.pct), bot = Math.max(6, stages[i + 1]?.pct ?? s.pct);
        const th = top / 2, bh = bot / 2;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-sm font-semibold leading-tight text-neutral-700">{s.label}</div>
            <div className="relative h-12 flex-1">
              <div className="absolute inset-0" style={{ background: COLORS[i % COLORS.length], clipPath: `polygon(${50 - th}% 0, ${50 + th}% 0, ${50 + bh}% 100%, ${50 - bh}% 100%)` }} />
            </div>
            <div className="w-16 shrink-0 text-right"><div className="text-xs font-bold text-neutral-500">{s.pct}%</div><div className="text-sm font-bold text-neutral-900">{s.value}</div></div>
          </div>
        );
      })}
    </div>
  );
}

function Traffic({ data }: { data: FunnelMetrics["trafego"] }) {
  const W = 680, H = 200, pad = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.visitantes, d.respostas, d.leads, d.conclusoes)));
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 16);
  const path = (k: "visitantes" | "respostas" | "leads" | "conclusoes") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const series = [{ k: "visitantes", c: COLORS[0], label: "Visitantes" }, { k: "respostas", c: COLORS[1], label: "Respostas" }, { k: "leads", c: COLORS[2], label: "Leads" }, { k: "conclusoes", c: COLORS[3], label: "Conclusões" }] as const;
  const [hi, setHi] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current; if (!el || data.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHi(Math.round(ratio * (data.length - 1)));
  };
  const hd = hi != null ? data[hi] : null;
  const leftPct = hi != null ? (x(hi) / W) * 100 : 0;
  const tx = leftPct < 14 ? "0%" : leftPct > 86 ? "-100%" : "-50%";
  return (
    <div>
      <div ref={wrapRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="#0000000d" strokeDasharray="3 4" />)}
          {series.map((s) => <path key={s.k} d={path(s.k)} fill="none" stroke={s.c} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
          {hi != null && hd ? <line x1={x(hi)} x2={x(hi)} y1={pad} y2={H - pad} stroke="#00000022" strokeWidth={1} /> : null}
          {hi != null && hd ? series.map((s) => <circle key={s.k} cx={x(hi)} cy={y(hd[s.k])} r={3.5} fill="#fff" stroke={s.c} strokeWidth={2} />) : null}
        </svg>
        {hd ? (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] shadow-lg" style={{ left: `${leftPct}%`, transform: `translateX(${tx})` }}>
            <div className="mb-1 font-bold text-neutral-800">{hd.hour}</div>
            {series.map((s) => (
              <div key={s.k} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: s.c }}><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />{s.label}</span>
                <span className="font-bold text-neutral-800">{hd[s.k]}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-neutral-500">
        {series.map((s) => <span key={s.k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.c }} />{s.label}</span>)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">{data.filter((_, i) => i % 4 === 0).map((d) => <span key={d.hour}>{d.hour}</span>)}</div>
    </div>
  );
}

const SLIDES = [
  { t: "Score e Desempenho", b: "Uma nota de 0 a 100 que resume a saúde do funil pelo comportamento real dos leads: Crítico (0–25), Regular (26–50), Bom (51–75), Ótimo (76–100). Combina taxa de conclusão e taxa de interação." },
  { t: "Métricas", b: "Visitas e Acessos = quem entrou no funil. Respostas Iniciadas = quem interagiu (passou do hero). Média de Etapas = quanto do fluxo avançam em média. Tempo Médio = quanto tempo ficam. O indicador colorido compara com o período anterior." },
  { t: "Desempenho (funil)", b: "A jornada do lead em 5 etapas: Visitantes → 1ª resposta → 2ª resposta → Leads capturados → Conclusões. 1ª/2ª resposta = interação do lead no 1º/2º card. Quanto mais estreita a etapa, maior a perda ali. Taxa de conclusão = conclusões ÷ visitantes." },
  { t: "Tráfego", b: "Evolução por hora de Visitantes, Respostas, Leads e Conclusões — mostra picos e melhores horários. Taxa de interação = quem iniciou; taxa de rejeição = quem saiu sem interagir." },
];

/** Tela de Performance reutilizável (igual o antigo "Métricas"), com deltas e Sumário. */
export default function PerformanceView({ m, deltas }: { m: FunnelMetrics; deltas?: Record<string, number> | null }) {
  const [sum, setSum] = useState(false);
  const [si, setSi] = useState(0);
  const tier = m.score >= 76 ? "Ótimo" : m.score >= 51 ? "Bom" : m.score >= 26 ? "Regular" : "Crítico";
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setSi(0); setSum(true); }} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⚡ Sumário</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Score e Desempenho" value={<div className="flex items-baseline gap-2">{m.score.toFixed(1)}<span className={`text-xs font-bold ${m.score >= 51 ? "text-green-600" : m.score >= 26 ? "text-amber-500" : "text-red-500"}`}>{tier}</span></div>} delta={deltas?.score} />
        <Card label="Visitas e Acessos" value={<span>👁 {m.visitantes}</span>} delta={deltas?.visitantes} sub="Sessões que entraram" />
        <Card label="Respostas Iniciadas" value={m.respostas} delta={deltas?.respostas} sub="Viram a 1ª pergunta" />
        <Card label="Média de Etapas" value={`${Math.round(m.mediaEtapas)}/${m.totalSteps}`} delta={deltas?.mediaEtapas} sub="Concluídas" />
        <Card label="Tempo Médio" value={<span className="text-xl">⏱ {fmtTime(m.tempoMedioSeg)}</span>} delta={deltas?.tempoMedioSeg} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">▼ Desempenho</h2>
          <div className="mt-3 flex gap-10">
            <div><p className="text-xs text-neutral-500">Taxa de conclusão</p><p className="text-2xl font-bold">{m.taxaConclusao}%</p><Delta v={deltas?.taxaConclusao} /></div>
            <div><p className="text-xs text-neutral-500">Total de conclusões</p><p className="text-2xl font-bold">{m.conclusoes}</p><Delta v={deltas?.conclusoes} /></div>
          </div>
          <Funnel stages={m.funil} />
        </section>
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">📈 Tráfego (24h)</h2>
          <div className="mt-3 flex gap-10">
            <div><p className="text-xs text-neutral-500">Taxa de interação</p><p className="text-2xl font-bold">{m.taxaInteracao}%</p></div>
            <div><p className="text-xs text-neutral-500">Taxa de rejeição</p><p className="text-2xl font-bold">{m.taxaRejeicao}%</p></div>
          </div>
          <div className="mt-3"><Traffic data={m.trafego} /></div>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400"># Campanhas</h2>
          <div className="mt-3 flex gap-10">
            <div><p className="text-xs text-neutral-500">Total rastreado</p><p className="text-2xl font-bold">{m.totalRastreado}</p></div>
            <div><p className="text-xs text-neutral-500">Melhor origem</p><p className="text-2xl font-bold capitalize">{m.melhorOrigem}</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {m.campanhas.length ? m.campanhas.map((c, i) => (
              <div key={c.name}><div className="mb-1 flex justify-between text-xs"><span className="truncate font-medium text-neutral-700">{c.name}</span><span className="text-neutral-500">{c.value} · {c.pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, c.pct)}%`, background: COLORS[i % COLORS.length] }} /></div></div>
            )) : <p className="text-sm text-neutral-400">Sem UTMs rastreadas ainda.</p>}
          </div>
        </section>
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">📱 Dispositivos</h2>
          <p className="mt-6 text-center text-sm text-neutral-400">Captura de dispositivo entra na próxima etapa.</p>
        </section>
      </div>

      {sum ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSum(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Sumário</h2><button onClick={() => setSum(false)} className="text-neutral-400 hover:text-neutral-700">✕</button></div>
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
