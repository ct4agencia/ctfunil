"use client";

import { useRouter } from "next/navigation";
import type { FunnelMetrics } from "@/lib/quiz/metrics";

const COLORS = ["#3b82f6", "#ec4899", "#8b5cf6", "#f59e0b", "#10b981"];

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function SummaryCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold text-neutral-500">{label}</p>
      <div className="mt-1.5 text-2xl font-bold text-neutral-900">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-neutral-400">{sub}</div> : null}
    </div>
  );
}

/** Funil trapézio invertido (estilo inlead "Desempenho"). */
function Funnel({ stages }: { stages: FunnelMetrics["funil"] }) {
  return (
    <div className="mt-4 space-y-1">
      {stages.map((s, i) => {
        const top = Math.max(6, s.pct);
        const bot = Math.max(6, stages[i + 1]?.pct ?? s.pct);
        const th = top / 2, bh = bot / 2;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-sm font-semibold leading-tight text-neutral-700">{s.label}</div>
            <div className="relative h-14 flex-1">
              <div className="absolute inset-0" style={{
                background: COLORS[i % COLORS.length],
                clipPath: `polygon(${50 - th}% 0, ${50 + th}% 0, ${50 + bh}% 100%, ${50 - bh}% 100%)`,
              }} />
            </div>
            <div className="w-20 shrink-0 text-right">
              <div className="text-xs font-bold text-neutral-500">{s.pct}%</div>
              <div className="text-sm font-bold text-neutral-900">{s.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrafficChart({ data }: { data: FunnelMetrics["trafego"] }) {
  const W = 680, H = 220, pad = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.visitantes, d.respostas, d.leads, d.conclusoes)));
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 16);
  const path = (k: keyof FunnelMetrics["trafego"][number]) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k] as number).toFixed(1)}`).join(" ");
  const series = [
    { k: "visitantes", c: COLORS[0], label: "Visitantes" },
    { k: "respostas", c: COLORS[1], label: "Respostas" },
    { k: "leads", c: COLORS[2], label: "Leads" },
    { k: "conclusoes", c: COLORS[3], label: "Conclusões" },
  ] as const;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 230 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="#0000000d" strokeDasharray="3 4" />)}
        {series.map((s) => <path key={s.k} d={path(s.k)} fill="none" stroke={s.c} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-neutral-500">
        {series.map((s) => <span key={s.k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.c }} />{s.label}</span>)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
        {data.filter((_, i) => i % 4 === 0).map((d) => <span key={d.hour}>{d.hour}</span>)}
      </div>
    </div>
  );
}

export default function FunnelAnalytics({ slug, m }: { slug: string; m: FunnelMetrics }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600">←</button>
            <div>
              <h1 className="text-sm font-bold">{m.name}</h1>
              <p className="text-xs text-neutral-500">/{slug} · {m.totalSteps} lâminas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-semibold text-neutral-500 sm:flex">
              <span className="rounded-md bg-white px-2.5 py-1 text-neutral-900 shadow-sm">Performance</span>
            </div>
            <a href={`/q/${slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-5">
        {/* filtros */}
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">⚡ Sumário</span>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-xs font-semibold text-neutral-500">
            {["24 horas", "7 dias", "30 dias", "Tudo"].map((f, i) => (
              <span key={f} className={`rounded-md px-2.5 py-1 ${i === 3 ? "bg-neutral-900 text-white" : ""}`}>{f}</span>
            ))}
          </div>
        </div>

        {/* 5 cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Score e Desempenho" value={<div className="flex items-baseline gap-2">{m.score.toFixed(1)}<span className="text-xs font-bold text-green-600">{m.score >= 70 ? "Ótimo" : m.score >= 40 ? "Bom" : "Baixo"}</span></div>}
            sub={<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-green-500" style={{ width: `${m.score}%` }} /></div>} />
          <SummaryCard label="Visitas e Acessos" value={<span>👁 {m.visitantes}</span>} sub="Sessões que entraram" />
          <SummaryCard label="Respostas Iniciadas" value={m.respostas} sub="Viram a 1ª pergunta" />
          <SummaryCard label="Média de Etapas" value={`${Math.round(m.mediaEtapas)}/${m.totalSteps}`} sub="Concluídas" />
          <SummaryCard label="Tempo Médio" value={<span className="text-xl">⏱ {fmtTime(m.tempoMedioSeg)}</span>} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* DESEMPENHO — funil */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">▼ Desempenho</h2>
            <div className="mt-3 flex gap-10">
              <div><p className="text-xs text-neutral-500">Taxa de conclusão</p><p className="text-2xl font-bold">{m.taxaConclusao}%</p></div>
              <div><p className="text-xs text-neutral-500">Total de conclusões</p><p className="text-2xl font-bold">{m.conclusoes}</p></div>
            </div>
            <Funnel stages={m.funil} />
          </section>

          {/* TRÁFEGO */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">📈 Tráfego (24h)</h2>
            <div className="mt-3 flex gap-10">
              <div><p className="text-xs text-neutral-500">Taxa de interação</p><p className="text-2xl font-bold">{m.taxaInteracao}%</p></div>
              <div><p className="text-xs text-neutral-500">Taxa de rejeição</p><p className="text-2xl font-bold">{m.taxaRejeicao}%</p></div>
            </div>
            <div className="mt-3"><TrafficChart data={m.trafego} /></div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* CAMPANHAS */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400"># Campanhas</h2>
            <div className="mt-3 flex gap-10">
              <div><p className="text-xs text-neutral-500">Total rastreado</p><p className="text-2xl font-bold">{m.totalRastreado}</p></div>
              <div><p className="text-xs text-neutral-500">Melhor origem</p><p className="text-2xl font-bold capitalize">{m.melhorOrigem}</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {m.campanhas.length ? m.campanhas.map((c, i) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-xs"><span className="truncate font-medium text-neutral-700">{c.name}</span><span className="text-neutral-500">{c.value} · {c.pct}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, c.pct)}%`, background: COLORS[i % COLORS.length] }} /></div>
                </div>
              )) : <p className="text-sm text-neutral-400">Sem UTMs rastreadas ainda.</p>}
            </div>
          </section>

          {/* DISPOSITIVOS (placeholder até captura de device) */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">📱 Dispositivos</h2>
            <p className="mt-6 text-center text-sm text-neutral-400">Captura de dispositivo entra na próxima etapa.</p>
          </section>
        </div>

        {m.visitantes === 0 ? (
          <p className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-500">
            Ainda sem dados. Rode o quiz (<a className="font-semibold underline" href={`/q/${slug}`} target="_blank" rel="noreferrer">/q/{slug}</a>) que as métricas aparecem aqui.
          </p>
        ) : null}
      </div>
    </div>
  );
}
