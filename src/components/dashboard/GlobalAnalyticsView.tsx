"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";
import ContainerScroll from "@/components/ui/ContainerScroll";

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
      {rows.map((r) => (
        <div key={r.label}>
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

export default function GlobalAnalyticsView({ data }: { data: GlobalAnalytics }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("geral");
  const o = data.overview;
  const topFunnel = data.operacao[0]?.slug;

  return (
    <div className="flex min-h-screen bg-[#f4f6f9] font-[var(--font-admin)] text-neutral-900">
      <Sidebar onHome={() => router.push("/dashboard")} />
      <div className="flex-1 overflow-x-clip">
        <div className="mx-auto max-w-[1180px] px-7 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-neutral-500">Visão consolidada de todos os funis</p>
            </div>
            <button onClick={() => router.push("/dashboard")} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600">← Dashboard</button>
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
                    <iframe src={`/q/${topFunnel}?preview=1`} title="preview" className="h-full w-full" />
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
              </section>
            )}

            {tab === "leads" && (
              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3"><h2 className="text-sm font-semibold text-neutral-700">Leads recentes</h2><span className="text-xs text-neutral-400">{data.leads.total} no total</span></div>
                {data.leads.recent.length ? (
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
                ) : <div className="p-6"><ComingSoon title="Sem leads capturados" desc="Os leads da lâmina de captura aparecem aqui (e disparam os webhooks configurados). Requer a migração 0010 aplicada." source="funnel_leads" /></div>}
              </section>
            )}

            {tab === "vendas" && <ComingSoon title="Vendas" desc="Receita, ticket médio e conversão de checkout. Integra com Hotmart/UTMify via webhook de venda." source="webhook de venda / UTMify (próxima etapa)" />}
            {tab === "diagnostico" && <ComingSoon title="Diagnóstico" desc="Perfil agregado dos respondentes (dores, objeções, segmentos) cruzando respostas do quiz com conversão." source="quiz_answers × funnel_leads (próxima etapa)" />}
            {tab === "criativos" && <ComingSoon title="Criativos" desc="Desempenho por criativo/anúncio (CTR, CPL, ROAS) cruzando utm_content com leads e vendas." source="UTMify (Meta/Google) — MCP já conectado" />}
            {tab === "vsl" && <ComingSoon title="VSL" desc="Retenção do vídeo, play-rate e clique no CTA por segundo, no estilo VTurb." source="eventos da lâmina VSL (próxima etapa)" />}
          </div>
        </div>
      </div>
    </div>
  );
}
