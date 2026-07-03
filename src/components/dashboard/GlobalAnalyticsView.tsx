"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";
import ContainerScroll from "@/components/ui/ContainerScroll";
import VslDetail from "@/components/dashboard/VslDetail";

const ACCENT = "#3b82f6";

/* ── Sidebar escura (Datacrazy) ── */
function Sidebar({ onHome }: { onHome: () => void }) {
  const Icon = ({ children, active, title, onClick }: { children: React.ReactNode; active?: boolean; title?: string; onClick?: () => void }) => (
    <div onClick={onClick} title={title} className={`grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-[18px] transition ${active ? "bg-blue-600 text-white" : "text-white/45 hover:bg-white/10 hover:text-white/80"}`}>{children}</div>
  );
  return (
    <aside className="sticky top-0 flex h-screen w-[60px] shrink-0 flex-col items-center gap-1.5 border-r border-white/5 bg-[#0d0f1a] py-4">
      <div className="mb-1 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-black text-white">ᗯ</div>
      <Icon title="Dashboard" onClick={onHome}>▦</Icon>
      <Icon active title="Analytics">📊</Icon>
      <div className="mt-auto"><Icon title="Configurações">⚙</Icon></div>
    </aside>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-neutral-900">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-neutral-400">{sub}</p> : null}
    </div>
  );
}

function Bars({ rows, color = ACCENT }: { rows: { label: string; value: number; pct: number }[]; color?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-neutral-400">Sem dados ainda.</p>;
  return (
    <div className="space-y-2.5">
      {/* key com índice: funis podem ter o MESMO nome (ex. duplicatas) */}
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="mb-1 flex justify-between text-xs"><span className="truncate font-medium text-neutral-700">{r.label}</span><span className="text-neutral-500">{r.value} · {r.pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, r.pct)}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }: { data: GlobalAnalytics["overview"]["daily"] }) {
  const max = Math.max(1, ...data.map((d) => d.sessoes));
  return (
    <div className="flex h-40 items-end gap-3 px-1">
      {data.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-md bg-blue-500/90" style={{ height: `${(d.sessoes / max) * 100}%`, minHeight: d.sessoes ? 4 : 0 }} title={`${d.sessoes}`} /></div>
          <span className="text-[10px] text-neutral-400">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function ComingSoon({ title, desc, source }: { title: string; desc: string; source: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-2xl">🚧</div>
      <h3 className="text-base font-bold text-neutral-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{desc}</p>
      <p className="mx-auto mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Fonte de dados: {source}</p>
    </div>
  );
}

const TABS = [
  { key: "geral", label: "Visão Geral", icon: "🏠" },
  { key: "comparar", label: "Comparar", icon: "⚖️" },
  { key: "vendas", label: "Vendas", icon: "💰" },
  { key: "diagnostico", label: "Diagnóstico", icon: "🩺" },
  { key: "quiz", label: "Quiz", icon: "❓" },
  { key: "criativos", label: "Criativos", icon: "🎨" },
  { key: "vsl", label: "VSL", icon: "▶️" },
  { key: "trafego", label: "Tráfego", icon: "📈" },
  { key: "operacao", label: "Operação", icon: "⚙️" },
  { key: "leads", label: "Leads", icon: "👥" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const isTab = (v: string | null): v is TabKey => !!v && TABS.some((t) => t.key === v);

export default function GlobalAnalyticsView({ data }: { data: GlobalAnalytics }) {
  const router = useRouter();
  // Aba sincronizada com a URL (?tab=): o voltar do navegador navega entre abas
  // e o link de uma aba específica é compartilhável.
  const [tab, setTabState] = useState<TabKey>("geral");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTabState(fromUrl);
    const onPop = () => {
      const t = new URLSearchParams(window.location.search).get("tab");
      setTabState(isTab(t) ? t : "geral");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const setTab = (t: TabKey) => {
    setTabState(t);
    try {
      const u = new URL(window.location.href);
      if (t === "geral") u.searchParams.delete("tab"); else u.searchParams.set("tab", t);
      window.history.pushState(null, "", u.toString());
    } catch { /* noop */ }
  };
  const o = data.overview;
  const topFunnel = data.operacao[0]?.slug;
  // preview do funil em destaque só carrega no clique (iframe pesado na 1ª dobra)
  const [showPreview, setShowPreview] = useState(false);
  // seleção de funis pra comparação (ilimitada)
  const [cmp, setCmp] = useState<string[]>([]);
  const toggleCmp = (slug: string) => setCmp((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const cmpRows = useMemo(() => data.operacao.filter((r) => cmp.includes(r.slug)), [cmp, data.operacao]);
  // seleção de criativos e de VSLs pra comparação
  const [cmpCreat, setCmpCreat] = useState<string[]>([]);
  const toggleCreat = (c: string) => setCmpCreat((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  // ordenação + filtro por funil dos criativos (comináveis: 1 slug + conversão desc)
  const [creatSort, setCreatSort] = useState<"leads" | "clicks" | "conv" | "slug">("leads");
  const [creatFunnel, setCreatFunnel] = useState<string>("");
  const creatSlugs = useMemo(() => Array.from(new Set(data.creatives.flatMap((c) => c.funnels))).sort(), [data.creatives]);
  const creatList = useMemo(() => {
    const base = creatFunnel ? data.creatives.filter((c) => c.funnels.includes(creatFunnel)) : data.creatives;
    const arr = [...base];
    if (creatSort === "clicks") arr.sort((a, b) => b.clicks - a.clicks);
    else if (creatSort === "conv") arr.sort((a, b) => b.conv - a.conv || b.leads - a.leads);
    else if (creatSort === "slug") arr.sort((a, b) => (a.funnels[0] ?? "").localeCompare(b.funnels[0] ?? ""));
    else arr.sort((a, b) => b.leads - a.leads || b.clicks - a.clicks);
    return arr;
  }, [data.creatives, creatFunnel, creatSort]);
  // métricas VTurb (aba VSL) — carrega ao abrir a aba; players extras selecionáveis
  interface VtRow { playerId: string; playerName: string; funnels: { slug: string; name: string }[]; stats: { views: number; plays: number; playRate: number; engagement: number; pitchAudience: number; pitchRetention: number; clicks: number; conversions: number; convRate: number; amountBrl: number } }
  interface VtData { vsls: VtRow[]; allPlayers: { id: string; name: string; linked: boolean }[] }
  const [vturb, setVturb] = useState<VtData | "idle" | "loading" | "error" | "no_token">("idle");
  const [detailPlayer, setDetailPlayer] = useState<string | null>(null);
  const [extraPlayers, setExtraPlayers] = useState<string[]>([]);
  const loadVturb = (extras: string[]) => {
    setVturb("loading");
    fetch(`/api/vturb${extras.length ? `?players=${encodeURIComponent(extras.join(","))}` : ""}`)
      .then((r) => r.json())
      .then((d) => setVturb(d?.error === "no_token" ? "no_token" : d?.vsls ? (d as VtData) : "error"))
      .catch(() => setVturb("error"));
  };
  useEffect(() => { if (tab === "vsl" && vturb === "idle") loadVturb(extraPlayers); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);
  const [cmpVsl, setCmpVsl] = useState<string[]>([]);
  const toggleVsl = (slug: string) => setCmpVsl((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  // "VSL" por funil: quem chegou na lâmina de VSL (conclusão) e a taxa de chegada
  const vsls = useMemo(() => data.operacao.filter((r) => r.visitantes > 0).map((r) => ({
    slug: r.slug, name: r.name, visitantes: r.visitantes, chegaram: r.conclusoes,
    pct: r.visitantes ? Math.round((r.conclusoes / r.visitantes) * 1000) / 10 : 0, leads: r.leads,
  })), [data.operacao]);

  return (
    <div className="flex min-h-screen bg-[#f4f6f9] font-[var(--font-admin)] text-neutral-900">
      <Sidebar onHome={() => router.push("/dashboard")} />
      <div className="flex-1 overflow-x-clip">
        <div className="mx-auto max-w-[1180px] px-7 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} title="Voltar" aria-label="Voltar"
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-base font-bold text-neutral-600 hover:bg-neutral-50">←</button>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight">Analytics</h1>
                <p className="text-sm text-neutral-500">Visão consolidada de todos os funis</p>
              </div>
            </div>
            <Link href="/dashboard" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">▦ Dashboard</Link>
          </div>

          {/* abas */}
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "geral" && (
              <div className="space-y-5">
                {topFunnel ? (
                  <ContainerScroll titleComponent={
                    <div className="pb-4">
                      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Funil em destaque</p>
                      <h2 className="mt-1 text-3xl font-black tracking-tight text-neutral-900">{data.operacao[0].name}</h2>
                      <p className="mt-1 text-sm text-neutral-500">{data.operacao[0].visitantes} sessões · {data.operacao[0].taxaConclusao}% conclusão</p>
                    </div>
                  }>
                    {showPreview ? (
                      <iframe src={`/q/${topFunnel}?preview=1`} title="preview" loading="lazy" className="h-full w-full" />
                    ) : (
                      <button onClick={() => setShowPreview(true)} className="grid h-full w-full place-items-center bg-neutral-900 text-white">
                        <span className="flex flex-col items-center gap-2">
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-2xl">▶</span>
                          <span className="text-sm font-semibold">Ver preview do funil</span>
                          <span className="text-xs text-white/50">carrega só quando você clicar (página mais rápida)</span>
                        </span>
                      </button>
                    )}
                  </ContainerScroll>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Card label="Funis" value={String(o.totalFunis)} sub="ativos" />
                  <Card label="Sessões" value={String(o.totalSessoes)} sub="visitantes" />
                  <Card label="Respostas" value={String(o.totalRespostas)} sub="iniciaram" />
                  <Card label="Leads" value={String(o.totalLeads)} sub="contatos" />
                  <Card label="Conclusões" value={`${o.taxaConclusao}%`} sub={`${o.totalConclusoes} concluíram`} />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                  <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-neutral-700">Sessões (7 dias)</h2>
                    <div className="mt-4"><DailyChart data={o.daily} /></div>
                  </section>
                  <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <h2 className="mb-3 text-sm font-semibold text-neutral-700">Sessões por funil</h2>
                    <Bars rows={o.porFunil.map((p) => ({ label: p.name, value: p.sessoes, pct: p.pct }))} />
                  </section>
                </div>
              </div>
            )}

            {tab === "comparar" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-800">Selecione os funis pra comparar</h2>
                    <span className="text-xs text-neutral-400">{cmp.length} selecionado{cmp.length === 1 ? "" : "s"} · sem limite</span>
                  </div>
                  <p className="mb-3 text-xs text-neutral-400">Clique nos funis (2, 3, 4, 6… quantos quiser). O melhor valor de cada métrica fica verde.</p>
                  <div className="flex flex-wrap gap-2">
                    {data.operacao.map((r) => {
                      const on = cmp.includes(r.slug);
                      return (
                        <button key={r.slug} onClick={() => toggleCmp(r.slug)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"}`}>
                          {on ? "✓ " : ""}{r.name}
                        </button>
                      );
                    })}
                  </div>
                  {cmp.length ? <button onClick={() => setCmp([])} className="mt-3 text-xs font-semibold text-neutral-400 hover:text-neutral-700">limpar seleção</button> : null}
                </section>
                {cmpRows.length >= 2 ? (
                  <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                          <tr>
                            <th className="px-4 py-3">Métrica</th>
                            {cmpRows.map((r) => <th key={r.slug} className="max-w-[180px] truncate px-3 py-3" title={r.name}>{r.name}<div className="font-normal normal-case text-neutral-400">/{r.slug}</div></th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ["Visitantes", (r: typeof cmpRows[number]) => r.visitantes, (v: number) => String(v)],
                            ["Respostas", (r: typeof cmpRows[number]) => r.respostas, (v: number) => String(v)],
                            ["Resposta / visitante", (r: typeof cmpRows[number]) => (r.visitantes ? Math.round((r.respostas / r.visitantes) * 1000) / 10 : 0), (v: number) => `${v}%`],
                            ["Leads", (r: typeof cmpRows[number]) => r.leads, (v: number) => String(v)],
                            ["Lead / visitante", (r: typeof cmpRows[number]) => (r.visitantes ? Math.round((r.leads / r.visitantes) * 1000) / 10 : 0), (v: number) => `${v}%`],
                            ["Conclusões (VSL)", (r: typeof cmpRows[number]) => r.conclusoes, (v: number) => String(v)],
                            ["Taxa de conclusão", (r: typeof cmpRows[number]) => r.taxaConclusao, (v: number) => `${v}%`],
                            ["Score", (r: typeof cmpRows[number]) => r.score, (v: number) => String(v)],
                          ] as const).map(([label, get, fmt]) => {
                            const vals = cmpRows.map((r) => get(r));
                            const best = Math.max(...vals);
                            return (
                              <tr key={label} className="border-t border-neutral-100">
                                <td className="px-4 py-2.5 font-medium text-neutral-600">{label}</td>
                                {vals.map((v, i) => (
                                  <td key={cmpRows[i].slug} className={`px-3 py-2.5 font-bold ${v === best && best > 0 ? "text-green-600" : "text-neutral-800"}`}>
                                    {fmt(v)}{v === best && best > 0 && vals.filter((x) => x === best).length === 1 ? " 🏆" : ""}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-400">🏆 = melhor da linha (único). Métricas do período todo — os mesmos números da aba Operação.</p>
                  </section>
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">Selecione pelo menos 2 funis pra ver a comparação lado a lado.</div>
                )}
              </div>
            )}

            {tab === "quiz" && (
              <div className="space-y-4">
                {data.quiz.length ? data.quiz.map((q) => (
                  <section key={q.question} className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-neutral-800">{q.question}</h3><span className="text-xs text-neutral-400">{q.total} respostas</span></div>
                    <Bars rows={q.options.map((opt) => ({ label: opt.label, value: opt.value, pct: opt.pct }))} color="#8b5cf6" />
                  </section>
                )) : <ComingSoon title="Sem respostas ainda" desc="Quando o público responder os quizzes, a distribuição de cada pergunta aparece aqui." source="quiz_answers" />}
              </div>
            )}

            {tab === "trafego" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-neutral-700">Origens (utm_source)</h2><Bars rows={data.traffic.sources.map((s) => ({ label: s.name, value: s.value, pct: s.pct }))} /></section>
                <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-neutral-700">Campanhas (utm_campaign)</h2><Bars rows={data.traffic.campaigns.map((c) => ({ label: c.name, value: c.value, pct: c.pct }))} color="#ec4899" /></section>
              </div>
            )}

            {tab === "operacao" && (
              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <tr><th className="px-4 py-3">Funil</th><th className="px-3 py-3">Sessões</th><th className="px-3 py-3">Respostas</th><th className="px-3 py-3">Leads</th><th className="px-3 py-3">Conclusão</th><th className="px-3 py-3">Score</th><th className="px-3 py-3"></th></tr>
                  </thead>
                  <tbody>
                    {data.operacao.length ? data.operacao.map((r) => (
                      <tr key={r.slug} className="border-t border-neutral-100">
                        <td className="px-4 py-3 font-semibold text-neutral-800">{r.name}</td>
                        <td className="px-3 py-3 text-neutral-600">{r.visitantes}</td>
                        <td className="px-3 py-3 text-neutral-600">{r.respostas}</td>
                        <td className="px-3 py-3 text-neutral-600">{r.leads}</td>
                        <td className="px-3 py-3 font-semibold text-neutral-800">{r.taxaConclusao}%</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.score >= 70 ? "bg-green-100 text-green-700" : r.score >= 40 ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500"}`}>{r.score}</span></td>
                        <td className="px-3 py-3 text-right"><button onClick={() => router.push(`/dashboard/${r.slug}`)} className="text-xs font-semibold text-blue-600 hover:underline">Ver →</button></td>
                      </tr>
                    )) : <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Nenhum funil ainda.</td></tr>}
                  </tbody>
                </table>
                </div>
              </section>
            )}

            {tab === "leads" && (
              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-neutral-700">Leads recentes <span className="ml-1 text-xs font-normal text-neutral-400">({data.leads.total} no total)</span></h2>
                  <a href="/api/export-leads" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700">⬇ Exportar CSV (todos)</a>
                </div>
                {data.leads.recent.length ? (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400"><tr><th className="px-4 py-3">Nome</th><th className="px-3 py-3">WhatsApp</th><th className="px-3 py-3">Funil</th><th className="px-3 py-3">Quando</th></tr></thead>
                    <tbody>
                      {data.leads.recent.map((l, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="px-4 py-3 font-semibold text-neutral-800">{l.name}</td>
                          <td className="px-3 py-3 text-neutral-600">{l.phone}</td>
                          <td className="px-3 py-3 text-neutral-500">{l.funnel}</td>
                          <td className="px-3 py-3 text-neutral-400">{l.when ? new Date(l.when).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : <div className="p-6"><ComingSoon title="Sem leads capturados" desc="Os leads da lâmina de captura aparecem aqui (e disparam os webhooks configurados). Requer a migração 0010 aplicada." source="funnel_leads" /></div>}
              </section>
            )}

            {tab === "vendas" && <ComingSoon title="Vendas" desc="Receita, ticket médio e conversão de checkout. Integra com Hotmart/UTMify via webhook de venda." source="webhook de venda / UTMify (próxima etapa)" />}
            {tab === "diagnostico" && <ComingSoon title="Diagnóstico" desc="Perfil agregado dos respondentes (dores, objeções, segmentos) cruzando respostas do quiz com conversão." source="quiz_answers × funnel_leads (próxima etapa)" />}
            {tab === "criativos" && (data.creatives.length ? (
              <div className="space-y-4">
                {cmpCreat.length >= 2 ? (() => {
                  // ranking: conversão (desempate: leads) → melhor e pior explícitos
                  const sel = data.creatives.filter((x) => cmpCreat.includes(x.content));
                  const ranked = [...sel].sort((a, b) => b.conv - a.conv || b.leads - a.leads);
                  const bestKey = ranked[0]?.content, worstKey = ranked[ranked.length - 1]?.content;
                  const bestConv = Math.max(...sel.map((x) => x.conv)), worstConv = Math.min(...sel.map((x) => x.conv));
                  const bestLeads = Math.max(...sel.map((x) => x.leads)), worstLeads = Math.min(...sel.map((x) => x.leads));
                  return (
                    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-neutral-800">⚖️ Comparação de criativos ({cmpCreat.length})</h2>
                        <button onClick={() => setCmpCreat([])} className="text-xs font-semibold text-neutral-400 hover:text-neutral-700">limpar</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ranked.map((c) => {
                          const isBest = c.content === bestKey && bestKey !== worstKey;
                          const isWorst = c.content === worstKey && bestKey !== worstKey;
                          return (
                            <div key={c.content} className={`relative rounded-xl border-2 bg-white p-4 ${isBest ? "border-green-400" : isWorst ? "border-red-300" : "border-neutral-200"}`}>
                              {isBest ? <span className="absolute -top-2.5 left-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">▲ Melhor</span> : null}
                              {isWorst ? <span className="absolute -top-2.5 left-3 rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-bold uppercase text-white">▼ Pior</span> : null}
                              <p className="truncate pt-1 text-xs font-bold text-neutral-800" title={c.content}>{c.content}</p>
                              <p className="mt-0.5 truncate text-[11px] text-neutral-400" title={c.funnels.map((s) => `/${s}`).join(", ")}>📍 {c.funnels.length ? c.funnels.map((s) => `/${s}`).join(", ") : "—"}</p>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-[10px] uppercase text-neutral-400">Cliques</p><p className="text-lg font-bold text-neutral-800">{c.clicks}</p></div>
                                <div><p className="text-[10px] uppercase text-neutral-400">Leads</p><p className={`text-lg font-bold ${c.leads === bestLeads && bestLeads > 0 ? "text-green-600" : c.leads === worstLeads && bestLeads !== worstLeads ? "text-red-500" : "text-neutral-800"}`}>{c.leads}</p></div>
                                <div><p className="text-[10px] uppercase text-neutral-400">Conv.</p><p className={`text-lg font-bold ${c.conv === bestConv && bestConv > 0 ? "text-green-600" : c.conv === worstConv && bestConv !== worstConv ? "text-red-500" : "text-neutral-800"}`}>{c.conv}%</p></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11px] text-neutral-500">▲/▼ pelo ranking de <strong>conversão</strong> (desempate: leads). Verde = melhor da métrica · vermelho = pior.</p>
                    </section>
                  );
                })() : null}
                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-neutral-800">Criativos / anúncios</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* filtro por funil + ordenação — combináveis (ex.: 1 slug + conversão desc) */}
                      <select value={creatFunnel} onChange={(e) => setCreatFunnel(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 outline-none focus:border-blue-500" aria-label="Filtrar por funil">
                        <option value="">Todos os funis</option>
                        {creatSlugs.map((s) => <option key={s} value={s}>/{s}</option>)}
                      </select>
                      <select value={creatSort} onChange={(e) => setCreatSort(e.target.value as typeof creatSort)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 outline-none focus:border-blue-500" aria-label="Ordenar por">
                        <option value="leads">↓ Mais leads</option>
                        <option value="clicks">↓ Mais cliques</option>
                        <option value="conv">↓ Maior conversão</option>
                        <option value="slug">A–Z por /slug</option>
                      </select>
                      <span className="text-xs text-neutral-400">{creatList.length} de {data.creatives.length} · ✓ 2+ pra comparar</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-neutral-400">
                        <tr><th className="w-8 px-2 py-2"></th><th className="px-3 py-2 font-semibold">Criativo</th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 font-semibold">Origem</th><th className="px-3 py-2 font-semibold">Campanha</th><th className="px-3 py-2 text-right font-semibold">Cliques</th><th className="px-3 py-2 text-right font-semibold">Leads</th><th className="px-3 py-2 text-right font-semibold">Conversão</th></tr>
                      </thead>
                      <tbody>
                        {creatList.map((c) => (
                          <tr key={c.content} className={`border-t border-neutral-100 ${cmpCreat.includes(c.content) ? "bg-blue-50/50" : ""}`}>
                            <td className="px-2 py-2.5"><input type="checkbox" checked={cmpCreat.includes(c.content)} onChange={() => toggleCreat(c.content)} className="h-3.5 w-3.5 accent-blue-600" aria-label={`Comparar ${c.content}`} /></td>
                            <td className="max-w-[240px] truncate px-3 py-2.5 font-medium text-neutral-800" title={c.content}>{c.content}</td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-xs text-neutral-600" title={c.funnels.map((s) => `/${s}`).join(", ")}>{c.funnels.length ? c.funnels.map((s) => `/${s}`).join(", ") : "—"}</td>
                            <td className="px-3 py-2.5 text-neutral-500">{c.source || "—"}</td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 text-neutral-500" title={c.campaign}>{c.campaign || "—"}</td>
                            <td className="px-3 py-2.5 text-right text-neutral-600">{c.clicks}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">{c.leads}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.conv >= 10 ? "bg-green-50 text-green-600" : c.conv > 0 ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-400"}`}>{c.conv}%</span></td>
                          </tr>
                        ))}
                        {!creatList.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-400">Nenhum criativo nesse funil.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-400">Cliques = sessões · Leads = capturas · Conversão = leads ÷ cliques · Funil = /slug onde o criativo rodou (mais tráfego primeiro). Gasto/CPL/ROAS entram ao ligar a UTMify (próxima etapa).</p>
                </section>
              </div>
            ) : <ComingSoon title="Criativos" desc="Ainda sem dados de criativo. Rode tráfego com utm_content nos anúncios pra preencher esta tabela." source="funnel_sessions × funnel_leads" />)}
            {tab === "vsl" && (vsls.length ? (
              <div className="space-y-4">
                {/* ── Métricas do PLAYER (VTurb Analytics API) ── */}
                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-neutral-800">▶️ Métricas do vídeo (VTurb) <span className="ml-1 text-xs font-normal text-neutral-400">últimos 30 dias</span></h2>
                    <div className="flex items-center gap-2">
                      {typeof vturb === "object" && vturb.allPlayers.some((p) => !p.linked) ? (
                        <select defaultValue="" onChange={(e) => { const id = e.target.value; if (!id) return; const next = [...extraPlayers, id]; setExtraPlayers(next); loadVturb(next); e.currentTarget.value = ""; }}
                          className="max-w-[240px] rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 outline-none focus:border-blue-500" aria-label="Adicionar player">
                          <option value="">+ adicionar player da conta…</option>
                          {/* agrupado por prefixo do nome (a API do VTurb não expõe as pastas) */}
                          {(() => {
                            const avail = vturb.allPlayers.filter((p) => !p.linked && !extraPlayers.includes(p.id));
                            const groups = new Map<string, typeof avail>();
                            for (const p of avail) {
                              const g = (p.name.split(/\s[-–|]\s|\s-\s?|-\s/)[0] || p.name).trim().toUpperCase().slice(0, 28) || "OUTROS";
                              if (!groups.has(g)) groups.set(g, []);
                              groups.get(g)!.push(p);
                            }
                            return [...groups.entries()]
                              .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
                              .map(([g, ps]) => (
                                <optgroup key={g} label={`📁 ${g} (${ps.length})`}>
                                  {ps.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </optgroup>
                              ));
                          })()}
                        </select>
                      ) : null}
                      <button onClick={() => loadVturb(extraPlayers)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">↻ Atualizar</button>
                    </div>
                  </div>
                  {vturb === "loading" || vturb === "idle" ? (
                    <div className="space-y-2 animate-pulse">{[0, 1].map((i) => <div key={i} className="h-10 rounded-lg bg-neutral-100" />)}</div>
                  ) : vturb === "no_token" ? (
                    <p className="py-4 text-center text-sm text-neutral-400">Token do VTurb não configurado no servidor (VTURB_API_TOKEN).</p>
                  ) : vturb === "error" ? (
                    <p className="py-4 text-center text-sm text-red-500">Não consegui falar com a API do VTurb agora. Tenta o ↻ em instantes.</p>
                  ) : vturb.vsls.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-neutral-400">
                          <tr><th className="px-3 py-2 font-semibold">VSL / Player</th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 text-right font-semibold">Views</th><th className="px-3 py-2 text-right font-semibold">Plays</th><th className="px-3 py-2 text-right font-semibold">Play Rate</th><th className="px-3 py-2 text-right font-semibold">Engajamento</th><th className="px-3 py-2 text-right font-semibold">Aud. Pitch</th><th className="px-3 py-2 text-right font-semibold">Ret. Pitch</th><th className="px-3 py-2 text-right font-semibold">Cliques</th><th className="px-3 py-2 text-right font-semibold">Conv.</th></tr>
                        </thead>
                        <tbody>
                          {vturb.vsls.map((v) => (
                            <tr key={v.playerId} onClick={() => setDetailPlayer(detailPlayer === v.playerId ? null : v.playerId)}
                              className={`cursor-pointer border-t border-neutral-100 transition hover:bg-neutral-50 ${detailPlayer === v.playerId ? "bg-sky-50/60" : ""}`}
                              title="Clique pra abrir a curva de retenção e segmentações">
                              <td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-neutral-800" title={v.playerName}>📈 {v.playerName}</td>
                              <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs text-neutral-600" title={v.funnels.map((f) => `/${f.slug}`).join(", ")}>{v.funnels.length ? v.funnels.map((f) => `/${f.slug}`).join(", ") : "— (manual)"}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-600">{v.stats.views.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-600">{v.stats.plays.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">{v.stats.playRate}%</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">{v.stats.engagement}%</td>
                              <td className="px-3 py-2.5 text-right text-neutral-600">{v.stats.pitchAudience.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">{v.stats.pitchRetention}%</td>
                              <td className="px-3 py-2.5 text-right text-neutral-600">{v.stats.clicks.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.stats.convRate > 0 ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-400"}`}>{v.stats.conversions} · {v.stats.convRate}%</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-neutral-400">Nenhum player VTurb detectado nos embeds das VSLs. Usa o seletor acima pra adicionar um player da conta.</p>
                  )}
                  {detailPlayer ? <VslDetail playerId={detailPlayer} onClose={() => setDetailPlayer(null)} /> : null}
                  <p className="mt-3 text-[11px] text-neutral-400">Fonte: VTurb Analytics API (players detectados automaticamente no embed de cada funil). Play Rate = plays ÷ views · Ret. Pitch = % que passa do pitch. Clique numa linha pra ver retenção minuto a minuto e segmentações.</p>
                </section>
                {cmpVsl.length >= 2 ? (
                  <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-neutral-800">⚖️ Comparação de VSLs ({cmpVsl.length})</h2>
                      <button onClick={() => setCmpVsl([])} className="text-xs font-semibold text-neutral-400 hover:text-neutral-700">limpar</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {vsls.filter((v) => cmpVsl.includes(v.slug)).map((v) => {
                        const sel = vsls.filter((x) => cmpVsl.includes(x.slug));
                        const bestPct = Math.max(...sel.map((x) => x.pct));
                        return (
                          <div key={v.slug} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <p className="truncate text-xs font-bold text-neutral-800" title={v.name}>{v.name}</p>
                            <p className="mt-0.5 text-[11px] text-neutral-400">📍 /{v.slug}</p>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div><p className="text-[10px] uppercase text-neutral-400">Visitantes</p><p className="text-lg font-bold text-neutral-800">{v.visitantes}</p></div>
                              <div><p className="text-[10px] uppercase text-neutral-400">Na VSL</p><p className="text-lg font-bold text-neutral-800">{v.chegaram}</p></div>
                              <div><p className="text-[10px] uppercase text-neutral-400">% chegada</p><p className={`text-lg font-bold ${v.pct === bestPct && bestPct > 0 ? "text-green-600" : "text-neutral-800"}`}>{v.pct}%</p></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                <section className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-800">VSL por funil</h2>
                    <span className="text-xs text-neutral-400">✓ marque 2+ pra comparar</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-neutral-400">
                        <tr><th className="w-8 px-2 py-2"></th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 text-right font-semibold">Visitantes</th><th className="px-3 py-2 text-right font-semibold">Chegaram na VSL</th><th className="px-3 py-2 text-right font-semibold">% de chegada</th><th className="px-3 py-2 text-right font-semibold">Leads</th><th className="px-3 py-2 text-right"></th></tr>
                      </thead>
                      <tbody>
                        {vsls.map((v) => (
                          <tr key={v.slug} className={`border-t border-neutral-100 ${cmpVsl.includes(v.slug) ? "bg-blue-50/50" : ""}`}>
                            <td className="px-2 py-2.5"><input type="checkbox" checked={cmpVsl.includes(v.slug)} onChange={() => toggleVsl(v.slug)} className="h-3.5 w-3.5 accent-blue-600" aria-label={`Comparar ${v.name}`} /></td>
                            <td className="max-w-[260px] px-3 py-2.5"><p className="truncate font-medium text-neutral-800" title={v.name}>{v.name}</p><p className="text-[11px] text-neutral-400">/{v.slug}</p></td>
                            <td className="px-3 py-2.5 text-right text-neutral-600">{v.visitantes}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-neutral-800">{v.chegaram}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.pct >= 20 ? "bg-green-50 text-green-600" : v.pct > 0 ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-400"}`}>{v.pct}%</span></td>
                            <td className="px-3 py-2.5 text-right text-neutral-600">{v.leads}</td>
                            <td className="px-3 py-2.5 text-right"><button onClick={() => router.push(`/dashboard/${v.slug}`)} className="text-xs font-semibold text-blue-600 hover:underline">Ver →</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-400">Chegaram na VSL = sessões que alcançaram a lâmina de VSL (conclusão do funil), medidas pelo nosso tracking. As métricas do PLAYER (play rate, engajamento, pitch) estão na seção VTurb acima.</p>
                </section>
              </div>
            ) : <ComingSoon title="VSL" desc="Sem funis com tráfego ainda. Assim que houver sessões, as métricas de chegada na VSL aparecem aqui." source="funnel_sessions (max_step ≥ lâmina VSL)" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
