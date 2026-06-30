"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import type { DashboardMetrics } from "@/lib/quiz/metrics";
import { PRESETS } from "@/lib/quiz/presets";
import { getPalette } from "@/lib/quiz/theme";
import { createFunnel, duplicateFunnel, deleteFunnel } from "@/app/dashboard/actions";
import { signOut } from "@/app/auth/actions";
import Pagination from "@/components/ui/Pagination";

const PER_PAGE = 6;

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return ""; }
}


/* ── Card de métrica (Datacrazy) ───────────────────────────── */
function MetricCard({ label, value, sub, icon, active }: { label: string; value: string; sub: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${active ? "border-blue-500 ring-1 ring-blue-100" : "border-neutral-200"}`}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-neutral-100 text-neutral-400">{icon}</span>
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none tracking-tight text-neutral-900">{value}</p>
      <p className="mt-1.5 text-xs text-neutral-400">{sub}</p>
    </div>
  );
}

/* ── Gráfico de barras diário ──────────────────────────────── */
function DailyChart({ data }: { data: DashboardMetrics["daily"] }) {
  const max = Math.max(1, ...data.map((d) => d.sessoes));
  return (
    <div className="flex h-44 items-end gap-3 px-1">
      {data.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-md bg-blue-500/90 transition-all" style={{ height: `${(d.sessoes / max) * 100}%`, minHeight: d.sessoes ? 4 : 0 }} title={`${d.sessoes} sessões`} />
          </div>
          <span className="text-[10px] text-neutral-400">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Donut (sessões por funil) ─────────────────────────────── */
function Donut({ data }: { data: DashboardMetrics["porFunil"] }) {
  const total = data.reduce((a, b) => a + b.sessoes, 0);
  const R = 54, C = 2 * Math.PI * R;
  let off = 0;
  const segs = total > 0 ? data.filter((d) => d.sessoes > 0) : [];
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef1f5" strokeWidth="16" />
        {segs.map((d) => {
          const len = (d.sessoes / total) * C;
          const el = <circle key={d.slug} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
          off += len; return el;
        })}
      </svg>
      <div className="space-y-1.5 text-sm">
        {data.slice(0, 5).map((d) => (
          <div key={d.slug} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /><span className="max-w-[140px] truncate text-neutral-600">{d.name}</span><span className="ml-auto font-semibold text-neutral-800">{d.pct}%</span></div>
        ))}
        {!segs.length ? <p className="text-xs text-neutral-400">Sem sessões ainda.</p> : null}
      </div>
    </div>
  );
}

export default function Dashboard({ funnels, metrics }: { funnels: FunnelSummary[]; metrics: DashboardMetrics }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [page, setPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  useEffect(() => { try { setThemeState((localStorage.getItem("ctf-theme") as "light" | "dark" | "system") || "light"); } catch { /* noop */ } }, []);
  const setTheme = (t: "light" | "dark" | "system") => {
    setThemeState(t);
    try { localStorage.setItem("ctf-theme", t); } catch { /* noop */ }
    const d = document.documentElement;
    if (t === "system") d.removeAttribute("data-theme"); else d.setAttribute("data-theme", t);
  };

  const filtered = funnels.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const doCreate = async () => { if (busy) return; setBusy(true); const r = await createFunnel(name.trim() || "Novo funil", presetId); setBusy(false); if (r.ok && r.slug) router.push(`/builder/${r.slug}`); else alert(r.error ?? "Erro"); };
  const doDuplicate = async (slug: string) => { setMenu(null); setBusy(true); const r = await duplicateFunnel(slug); setBusy(false); if (r.ok) router.refresh(); else alert(r.error ?? "Erro"); };
  const doDelete = async (slug: string) => { setMenu(null); if (!confirm(`Excluir "${slug}"?`)) return; setBusy(true); const r = await deleteFunnel(slug); setBusy(false); if (r.ok) router.refresh(); else alert(r.error ?? "Erro"); };

  const cards = [
    { label: "Total de funis", value: String(metrics.totalFunis), sub: `${funnels.length} ativos`, icon: "⛢", active: true },
    { label: "Sessões", value: String(metrics.totalSessoes), sub: "visitantes únicos", icon: "👁" },
    { label: "Respostas", value: String(metrics.totalRespostas), sub: "iniciaram o quiz", icon: "✍" },
    { label: "Leads", value: String(metrics.totalLeads), sub: "deixaram contato", icon: "👤" },
    { label: "Conclusões", value: `${metrics.taxaConclusao}%`, sub: `${metrics.totalConclusoes} concluíram`, icon: "✓" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f9] font-[var(--font-admin)] text-neutral-900" onClick={() => setMenu(null)}>
      <div className="overflow-x-clip">
        <div className="mx-auto max-w-[1180px] px-7 py-6">
          {/* header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-neutral-500">Visão geral do desempenho dos seus funis</p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/analytics" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">📊 Analytics</a>
              <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Criar funil</button>
              <button onClick={() => setShowSettings(true)} title="Configurações" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⚙ Configurações</button>
              <button onClick={() => signOut()} title="Sair" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">⎋ Sair</button>
            </div>
          </div>

          {/* métricas */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => <MetricCard key={c.label} {...c} />)}
          </div>

          {/* charts */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-700">Dados diários</h2>
              <p className="text-xs text-neutral-400">Sessões nos últimos 7 dias</p>
              <div className="mt-4"><DailyChart data={metrics.daily} /></div>
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-700">Sessões por funil</h2>
              <p className="mb-3 text-xs text-neutral-400">Distribuição</p>
              <Donut data={metrics.porFunil} />
            </section>
          </div>

          {/* funis */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-base font-bold">Meus funis <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-600">{funnels.length}</span></h2>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar funil..." className="w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          {filtered.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
              {funnels.length === 0 ? "Nenhum funil ainda." : "Nada encontrado."}<br />
              <button onClick={() => setCreating(true)} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Criar funil</button>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map((f) => {
                const pal = getPalette(f.palette_id);
                return (
                  <div key={f.slug} className={`relative rounded-2xl border border-neutral-200 bg-white transition hover:shadow-md ${menu === f.slug ? "z-30" : ""}`}>
                    <div className="h-1 rounded-t-2xl" style={{ background: pal.primary }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => router.push(`/builder/${f.slug}`)} className="min-w-0 flex-1 text-left" title="Abrir construtor">
                          <h3 className="truncate font-bold text-neutral-800">{f.name}</h3>
                          <p className="mt-0.5 text-xs text-neutral-400">{fmtDate(f.updated_at)}{f.niche ? ` · ${f.niche}` : ""}</p>
                        </button>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setMenu(menu === f.slug ? null : f.slug); }} className="rounded-md px-1.5 text-lg text-neutral-400 hover:bg-neutral-100">⋮</button>
                          {menu === f.slug ? (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-xl">
                              <button onClick={() => router.push(`/builder/${f.slug}`)} className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50">✏️ Editar</button>
                              <button onClick={() => router.push(`/dashboard/${f.slug}`)} className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50">📊 Métricas</button>
                              <a href={f.domain ? `https://${f.domain}/${f.slug}` : `/${f.slug}`} target="_blank" rel="noreferrer" className="block px-3 py-1.5 hover:bg-neutral-50">👁 Visualizar</a>
                              <button onClick={() => doDuplicate(f.slug)} className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50">⧉ Duplicar</button>
                              <button onClick={() => doDelete(f.slug)} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50">🗑 Excluir</button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ background: pal.bgSoft, color: pal.primaryDark }}>{f.status}</span>
                        <span className="text-[11px] text-neutral-400">/{f.slug}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalPages > 1 ? (
            <div className="mt-5">
              <Pagination current={curPage} total={totalPages} onChange={setPage} accent="#3b82f6" />
            </div>
          ) : null}
        </div>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">Criar funil</h3>
            <p className="mt-1 text-sm text-neutral-500">Escolha um modelo e dê um nome.</p>
            <label className="mt-4 block text-xs font-semibold text-neutral-500">Nome do funil</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bolsas - SRC 02" className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <label className="mt-4 block text-xs font-semibold text-neutral-500">Modelo (preset)</label>
            <div className="mt-1 grid gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} disabled={p.comingSoon} onClick={() => setPresetId(p.id)} className={`rounded-xl border-2 p-3 text-left transition ${p.comingSoon ? "cursor-not-allowed border-neutral-200 opacity-60" : presetId === p.id ? "border-blue-600 bg-blue-50" : "border-neutral-200 hover:border-neutral-400"}`}>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full" style={{ background: getPalette(p.paletteId).primary }} />
                    <span className="text-sm font-bold">{p.name}</span>
                    {p.comingSoon ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">em construção</span> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{p.description}</p>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-500">Cancelar</button>
              <button onClick={doCreate} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Criando..." : "Criar e editar →"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">⚙ Configurações</h2>
              <button onClick={() => setShowSettings(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
            </div>

            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">Aparência</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {([["light", "☀️ Claro"], ["dark", "🌙 Escuro"], ["system", "🖥️ Sistema"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTheme(k)} className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold transition ${theme === k ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>{l}</button>
              ))}
            </div>

            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">Idioma</p>
            <div className="mb-4 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700">🇧🇷 Português (Brasil)</div>

            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">Conta</p>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2.5">
              <span className="text-sm text-neutral-700">Admin do CTFUNNEL</span>
              <button onClick={() => signOut()} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50">⎋ Sair</button>
            </div>

            <p className="text-center text-[11px] text-neutral-400">CTFUNNEL · construtor de funis (quiz + typebot)</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
