"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Comparativo de VSLs (players VTurb): curvas de retenção SOBREPOSTAS
 * (eixo X em % do vídeo — durações diferentes ficam comparáveis) +
 * tabela de métricas com melhor/pior por linha.
 */

export interface VslCompareRow {
  playerId: string;
  playerName: string;
  stats: {
    views: number; plays: number; playRate: number; engagement: number;
    pitchAudience: number; pitchRetention: number; clicks: number;
    conversions: number; convRate: number; amountBrl: number;
  };
}

const COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#f97316", "#22d3ee", "#e879f9"];
/** Dia-calendário de São Paulo (`en-CA` já sai YYYY-MM-DD). */
const DIA_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
interface Curve { pts: { x: number; pct: number }[]; pitchX: number | null }

export default function VslCompare({ rows }: { rows: VslCompareRow[] }) {
  const [curves, setCurves] = useState<Record<string, Curve>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      // Dia em São Paulo, não UTC: com `toISOString()` a janela deslocava um dia
      // inteiro das 21h à meia-noite. Mesmo bug do VslDetail e do LayersBuilder.
      const from = DIA_SP.format(new Date(Date.now() - 30 * 86400 * 1000));
      const to = DIA_SP.format(new Date());
      const out: Record<string, Curve> = {};
      await Promise.all(rows.map(async (r) => {
        try {
          const res = await fetch(`/api/vturb/detail?player=${r.playerId}&from=${from}&to=${to}&lite=1`);
          const j = await res.json();
          if (j?.curve?.length) {
            const maxT = j.curve[j.curve.length - 1].t || 1;
            out[r.playerId] = {
              // normaliza o tempo pra % do vídeo — vídeos de durações diferentes comparáveis
              pts: j.curve.map((p: { t: number; pct: number }) => ({ x: (p.t / maxT) * 100, pct: p.pct })),
              pitchX: j.player?.pitchTime ? (j.player.pitchTime / maxT) * 100 : null,
            };
          }
        } catch { /* melhor sem curva do que quebrar */ }
      }));
      if (!dead) { setCurves(out); setLoading(false); }
    })();
    return () => { dead = true; };
  }, [rows]);

  const W = 760, H = 240, PL = 44, PB = 24, PT = 10, PR = 12;
  const x = (p: number) => PL + ((W - PL - PR) * p) / 100;
  const y = (pct: number) => PT + (H - PT - PB) * (1 - pct / 100);

  // Number(): a API do VTurb devolve algumas taxas como string ("94.3") —
  // sem coerção o Math.max/=== não marca melhor/pior nas linhas de %.
  const METRICS = useMemo(() => ([
    { label: "Views", get: (r: VslCompareRow) => Number(r.stats.views), fmt: (v: number) => v.toLocaleString("pt-BR") },
    { label: "Plays", get: (r: VslCompareRow) => Number(r.stats.plays), fmt: (v: number) => v.toLocaleString("pt-BR") },
    { label: "Play Rate", get: (r: VslCompareRow) => Number(r.stats.playRate), fmt: (v: number) => `${v}%` },
    { label: "Engajamento", get: (r: VslCompareRow) => Number(r.stats.engagement), fmt: (v: number) => `${v}%` },
    { label: "Aud. Pitch", get: (r: VslCompareRow) => Number(r.stats.pitchAudience), fmt: (v: number) => v.toLocaleString("pt-BR") },
    { label: "Ret. Pitch", get: (r: VslCompareRow) => Number(r.stats.pitchRetention), fmt: (v: number) => `${v}%` },
    { label: "Cliques", get: (r: VslCompareRow) => Number(r.stats.clicks), fmt: (v: number) => v.toLocaleString("pt-BR") },
  ]), []);

  if (rows.length < 2) return null;

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-neutral-800">⚖️ Comparação de VSLs ({rows.length}) <span className="ml-1 text-xs font-normal text-neutral-400">últimos 30 dias · eixo X em % do vídeo</span></h3>

      {/* curvas sobrepostas */}
      <div className="rounded-xl bg-[#0e1320] p-4">
        <div className="mb-2 flex flex-wrap gap-3">
          {rows.map((r, i) => (
            <span key={r.playerId} className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="max-w-[220px] truncate" title={r.playerName}>{r.playerName}</span>
            </span>
          ))}
        </div>
        {loading ? (
          <div className="grid h-56 animate-pulse place-items-center text-sm text-white/40">Carregando curvas…</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line x1={PL} x2={W - PR} y1={y(g)} y2={y(g)} stroke="#ffffff14" />
                <text x={PL - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="#ffffff66">{g}%</text>
              </g>
            ))}
            {[0, 25, 50, 75, 100].map((g) => (
              <text key={`x${g}`} x={x(g)} y={H - 6} textAnchor="middle" fontSize="10" fill="#ffffff66">{g}%</text>
            ))}
            {rows.map((r, i) => {
              const c = curves[r.playerId];
              if (!c) return null;
              const d = c.pts.map((p, k) => `${k ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
              return (
                <g key={r.playerId}>
                  {c.pitchX != null ? <line x1={x(c.pitchX)} x2={x(c.pitchX)} y1={PT} y2={H - PB} stroke={COLORS[i % COLORS.length]} strokeDasharray="3 5" opacity="0.5" /> : null}
                  <path d={d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="2" />
                </g>
              );
            })}
          </svg>
        )}
        <p className="mt-1 text-[10px] text-white/40">Linha tracejada = pitch de cada VSL.</p>
      </div>

      {/* tabela de métricas com melhor/pior */}
      <div role="region" aria-label="Métricas da comparação de players" tabIndex={0} className="ct-comparison-scroll mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Métrica</th>
              {rows.map((r, i) => (
                <th key={r.playerId} className="max-w-[180px] truncate px-3 py-2 text-right font-semibold" title={r.playerName}>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{r.playerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const vals = rows.map((r) => m.get(r));
              const best = Math.max(...vals);
              const worst = Math.min(...vals);
              const spread = best !== worst;
              return (
                <tr key={m.label} className="border-t border-neutral-100">
                  <td className="px-3 py-2 text-neutral-600">{m.label}</td>
                  {rows.map((r, i) => {
                    const v = vals[i];
                    const cls = !spread ? "text-neutral-700" : v === best ? "font-bold text-green-600" : v === worst ? "font-semibold text-red-500" : "text-neutral-700";
                    return <td key={r.playerId} className={`px-3 py-2 text-right ${cls}`}>{m.fmt(v)}{spread && v === best && <span className="ml-1 text-[10px] font-normal">melhor</span>}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
