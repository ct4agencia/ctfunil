"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Detalhe de um player VTurb — réplica do painel da VTurb (REQ-5/6/7/10):
 * curva de retenção escura com hover + marcador de pitch, tabela minuto a
 * minuto (%RET/%QUEDA) e abas Países/Dispositivos/SO/Navegadores/Origem.
 */

interface SegRow {
  label: string;
  key?: string;
  views: number;
  plays: number;
  playRate: number;
  engagement: number;
  pitchRate: number;
  clicks: number;
  conversions: number;
  amountBrl: number;
}
interface Detail {
  player: { id: string; name: string; duration: number; pitchTime: number };
  totalUsers: number;
  curve: { t: number; pct: number }[];
  minutes: { label: string; ret: number; drop: number }[];
  segments: { paises: SegRow[]; dispositivos: SegRow[]; so: SegRow[]; navegadores: SegRow[] };
  traffic: SegRow[];
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s) % 60).padStart(2, "0")}`;
/**
 * Dia no fuso de São Paulo — NÃO `toISOString()`, que devolve o dia em UTC.
 *
 * Com UTC, das 21h à meia-noite o dia já virou lá fora: "Hoje" pedia o dia
 * SEGUINTE e a tela voltava vazia, e "Ontem" mostrava hoje. Medido: em 3 das 6
 * horas testadas o dia saía errado. `en-CA` já formata como YYYY-MM-DD.
 *
 * Mesma técnica de LayersBuilder.tsx:596, que sempre esteve correto.
 */
const FMT_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
const iso = (d: Date) => FMT_SP.format(d);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400 * 1000));
const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "custom", label: "Personalizado" },
] as const;
const SEG_TABS = [
  { key: "paises", label: "Países" },
  { key: "dispositivos", label: "Dispositivos" },
  { key: "so", label: "Sistemas Operacionais" },
  { key: "navegadores", label: "Navegadores" },
  { key: "origem", label: "Origem do Tráfego" },
] as const;

export default function VslDetail({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  // personalizado: 1 data (from=to) ou período; só recarrega no "Aplicar"
  const [customFrom, setCustomFrom] = useState(daysAgo(7));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [segTab, setSegTab] = useState<(typeof SEG_TABS)[number]["key"]>("paises");
  const [utmQuery, setUtmQuery] = useState("");
  const [hover, setHover] = useState<{ x: number; t: number; pct: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getRange = useCallback(() => {
    let from: string, to: string;
    if (period === "hoje") { from = to = iso(new Date()); }
    else if (period === "ontem") { from = to = daysAgo(1); }
    else if (period === "custom") {
      if (!applied) return null; // espera o Aplicar
      from = applied.from; to = applied.to;
      if (from > to) [from, to] = [to, from];
    } else { from = daysAgo(Number(period)); to = iso(new Date()); }
    return { from, to };
  }, [period, applied]);

  const load = useCallback(async () => {
    const range = getRange();
    if (!range) return;
    setState("loading");
    try {
      const r = await fetch(`/api/vturb/detail?player=${playerId}&from=${range.from}&to=${range.to}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || r.status);
      setData(j as Detail);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [playerId, getRange]);
  useEffect(() => {
    const range = getRange();
    if (!range) return;
    const { from, to } = range;
    let cancelled = false;
    async function run() {
      try {
        const r = await fetch(`/api/vturb/detail?player=${playerId}&from=${from}&to=${to}`);
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.status);
        if (cancelled) return;
        setData(j as Detail);
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [playerId, getRange]);

  // ── geometria do gráfico (viewBox fixo, responsivo via width 100%)
  const W = 760, H = 240, PL = 44, PB = 26, PT = 10, PR = 12;
  const geom = useMemo(() => {
    if (!data || !data.curve.length) return null;
    const maxT = data.curve[data.curve.length - 1].t || 1;
    const x = (t: number) => PL + ((W - PL - PR) * t) / maxT;
    const y = (pct: number) => PT + (H - PT - PB) * (1 - pct / 100);
    const line = data.curve.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
    const area = `${line}L${x(maxT).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
    return { maxT, x, y, line, area };
  }, [data]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!geom || !data || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = Math.max(0, Math.min(geom.maxT, ((px - PL) / (W - PL - PR)) * geom.maxT));
    const pt = data.curve.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    setHover({ x: geom.x(pt.t), t: pt.t, pct: pt.pct });
  };

  const segRows: SegRow[] = useMemo(() => {
    if (!data) return [];
    const rows = segTab === "origem" ? data.traffic : data.segments[segTab];
    if (segTab === "origem" && utmQuery.trim()) {
      const q = utmQuery.trim().toLowerCase();
      return rows.filter((r) => r.label.toLowerCase().includes(q) || (r.key ?? "").toLowerCase().includes(q));
    }
    return rows;
  }, [data, segTab, utmQuery]);

  const downloadCsv = () => {
    if (!data) return;
    const head = "TEMPO;% RET.;% QUEDA";
    const body = data.minutes.map((m) => `${m.label};${String(m.ret).replace(".", ",")}%;${String(m.drop).replace(".", ",")}%`).join("\n");
    const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `retencao-${data.player.name.replace(/[^\w-]+/g, "_")}-${period}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={onClose} aria-label="Fechar detalhe" className="grid h-8 w-8 place-items-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50">✕</button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-neutral-900">{data?.player.name ?? "Carregando…"}</h3>
          {data ? (
            <p className="text-xs text-neutral-500">
              Duração {mmss(data.player.duration)} · Pitch {data.player.pitchTime ? mmss(data.player.pitchTime) : "—"} · {data.totalUsers.toLocaleString("pt-BR")} espectadores no período
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${period === p.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={downloadCsv} disabled={!data} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
          ⬇ Baixar métricas
        </button>
      </div>

      {period === "custom" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
          <label className="text-xs font-semibold text-neutral-500">De</label>
          <input type="date" value={customFrom} max={iso(new Date())} onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400" />
          <label className="text-xs font-semibold text-neutral-500">até</label>
          <input type="date" value={customTo} max={iso(new Date())} onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400" />
          <button onClick={() => setApplied({ from: customFrom, to: customTo })}
            className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700">Aplicar</button>
          <span className="text-[11px] text-neutral-400">1 data só? Deixa &quot;De&quot; e &quot;até&quot; iguais.</span>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="grid h-64 animate-pulse place-items-center rounded-xl bg-neutral-100 text-sm text-neutral-400">Carregando dados do VTurb…</div>
      ) : state === "error" ? (
        <div className="grid h-40 place-items-center rounded-xl bg-red-50 text-sm text-red-600">Não consegui falar com o VTurb agora. <button onClick={load} className="ml-2 underline">tentar de novo</button></div>
      ) : data && geom ? (
        <>
          {/* ── curva de retenção (dark, igual VTurb) ── */}
          <div className="rounded-xl bg-[#0e1320] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Retenção de audiência</p>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
              <defs>
                <linearGradient id="vt-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map((g) => (
                <g key={g}>
                  <line x1={PL} x2={W - PR} y1={geom.y(g)} y2={geom.y(g)} stroke="#ffffff14" />
                  <text x={PL - 6} y={geom.y(g) + 3.5} textAnchor="end" fontSize="10" fill="#ffffff66">{g}%</text>
                </g>
              ))}
              {Array.from({ length: 6 }, (_, i) => Math.round((geom.maxT / 5) * i)).map((t) => (
                <text key={t} x={geom.x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#ffffff66">{mmss(t)}</text>
              ))}
              {data.player.pitchTime > 0 && data.player.pitchTime <= geom.maxT ? (
                <g>
                  <line x1={geom.x(data.player.pitchTime)} x2={geom.x(data.player.pitchTime)} y1={PT} y2={H - PB} stroke="#f59e0b" strokeDasharray="4 4" />
                  <text x={geom.x(data.player.pitchTime) + 4} y={PT + 12} fontSize="10" fontWeight="700" fill="#f59e0b">PITCH</text>
                </g>
              ) : null}
              <path d={geom.area} fill="url(#vt-area)" />
              <path d={geom.line} fill="none" stroke="#38bdf8" strokeWidth="2" />
              {hover ? (
                <g>
                  <line x1={hover.x} x2={hover.x} y1={PT} y2={H - PB} stroke="#ffffff55" />
                  <circle cx={hover.x} cy={geom.y(hover.pct)} r="4" fill="#38bdf8" stroke="#0e1320" strokeWidth="2" />
                  <g transform={`translate(${Math.min(hover.x + 8, W - 150)},${PT + 6})`}>
                    <rect width="140" height="40" rx="8" fill="#1c2436" stroke="#ffffff22" />
                    <text x="10" y="17" fontSize="11" fill="#ffffffaa">{mmss(hover.t)}</text>
                    <text x="10" y="32" fontSize="13" fontWeight="700" fill="#38bdf8">{String(hover.pct).replace(".", ",")}% assistindo</text>
                  </g>
                </g>
              ) : null}
            </svg>
          </div>

          {/* ── tabela minuto a minuto (planilha %RET/%QUEDA) ── */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-left text-neutral-500">
                  <tr><th className="px-3 py-2">TEMPO</th><th className="px-3 py-2 text-right">% RET.</th><th className="px-3 py-2 text-right">% QUEDA</th></tr>
                </thead>
                <tbody>
                  {data.minutes.map((m, i) => (
                    <tr key={m.label} className={i % 2 ? "bg-neutral-50/50" : ""}>
                      <td className="px-3 py-1.5 font-mono text-neutral-700">{m.label}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-neutral-900">{String(m.ret).replace(".", ",")}%</td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${m.drop > 10 ? "text-red-600" : m.drop > 5 ? "text-amber-600" : "text-neutral-500"}`}>
                        {m.drop > 0 ? `-${String(m.drop).replace(".", ",")}%` : "0%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── segmentações (abas do VTurb) ── */}
            <div className="rounded-xl border border-neutral-200">
              <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-2">
                {SEG_TABS.map((t) => (
                  <button key={t.key} onClick={() => setSegTab(t.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${segTab === t.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {segTab === "origem" ? (
                <div className="border-b border-neutral-100 p-2">
                  <input value={utmQuery} onChange={(e) => setUtmQuery(e.target.value)} placeholder="Buscar parâmetro (utm_content, campanha…)"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs outline-none focus:border-neutral-400" />
                </div>
              ) : null}
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">{segTab === "origem" ? "Origem" : SEG_TABS.find((t) => t.key === segTab)?.label}</th>
                      <th className="px-2 py-2 text-right">Views</th>
                      <th className="px-2 py-2 text-right">Plays</th>
                      <th className="px-2 py-2 text-right">Play Rate</th>
                      <th className="px-2 py-2 text-right">Engaj.</th>
                      <th className="px-2 py-2 text-right">Pitch</th>
                      <th className="px-2 py-2 text-right">Cliques</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segRows.length ? segRows.map((r, i) => (
                      <tr key={`${r.label}-${i}`} className={i % 2 ? "bg-neutral-50/50" : ""}>
                        <td className="max-w-[180px] truncate px-3 py-1.5 text-neutral-800" title={r.key ? `${r.key}: ${r.label}` : r.label}>
                          {r.label}
                          {r.key ? <span className="ml-1 text-[10px] text-neutral-400">({r.key})</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-right">{r.views.toLocaleString("pt-BR")}</td>
                        <td className="px-2 py-1.5 text-right">{r.plays.toLocaleString("pt-BR")}</td>
                        <td className="px-2 py-1.5 text-right">{String(r.playRate).replace(".", ",")}%</td>
                        <td className="px-2 py-1.5 text-right">{String(r.engagement).replace(".", ",")}%</td>
                        <td className="px-2 py-1.5 text-right">{r.pitchRate ? `${String(r.pitchRate).replace(".", ",")}%` : "—"}</td>
                        <td className="px-2 py-1.5 text-right">{r.clicks.toLocaleString("pt-BR")}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sem dados no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid h-40 place-items-center text-sm text-neutral-400">Sem dados de retenção no período.</div>
      )}
    </div>
  );
}
