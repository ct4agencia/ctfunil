import { libraryContext, libraryHref, type LibraryContextQuery } from "@/lib/quiz/library-context";
import type { ReactNode } from "react";
import { preserveReportOrigin, reportOrigin } from "@/lib/quiz/report-origin";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { isOfficialWorkspaceHost, isRealDataPreview } from "@/lib/workspace-preview";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { notFound } from "next/navigation";
import { hasPreviewFunnelDraft } from "@/lib/workspace-preview-vsl-drafts";
import ReportDateRange from "@/components/dashboard/ReportDateRange";
import type { DateRange } from "@/components/ui/WorkspaceDateRange";
import SnapshotTimestamp from "@/components/dashboard/SnapshotTimestamp";
import SnapshotQuizView from "@/components/dashboard/SnapshotQuizView";
import SnapshotDiagnosisView from "@/components/dashboard/SnapshotDiagnosisView";
import SnapshotVslView from "@/components/dashboard/SnapshotVslView";
import PerformanceView from "@/components/dashboard/PerformanceView";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { funnelMetrics } from "@/lib/quiz/metrics";
import { resolveFunnel } from "@/lib/quiz/funnels-db";
import { funnelPublicUrl } from "@/lib/quiz/public-url";
import { PERIODOS, civilRangeFromPeriod, janelaDeChave, parseCivilRange, rotuloDoPeriodo, spDateYmd, spYmd } from "@/lib/quiz/periodo";

export const metadata: Metadata = { title: "Performance do funil · CTFUNNEL" };
export const dynamic = "force-dynamic";

async function SnapshotFunnelReport({ slug, range, comparison, origin, responseFunnel, library, official = false }: {
  slug: string; range: DateRange; comparison: string[]; origin: ReturnType<typeof reportOrigin>; responseFunnel?: string; library: URLSearchParams; official?: boolean;
}) {
  const snapshot = await getWorkspaceSnapshot();
  const funnel = snapshot.funnels.find(item => item.slug === slug);
  // Painel oficial: todo funil usa os indicadores ao vivo, não a captura.
  const metrics = official ? undefined : snapshot.analytics.operacao.find(item => item.slug === slug);
  const video = snapshot.vsl.rows.find(item => item.slug === slug);
  const quiz = snapshot.quiz.quiz.filter(item => item.slug === slug);
  const diagnosis = snapshot.diagnosis.questions.filter(item => item.slug === slug);
  if (!funnel) notFound();
  if (!metrics && !official) {
    const periodWindow = {
      from: range.from ? janelaDeChave("dia", range.from).janela.from : undefined,
      to: range.to ? janelaDeChave("dia", range.to).janela.to : undefined,
    };
    const admin = await requireAdmin();
    const published = admin.ok && await admin.supabase.from("funnels").select("name,steps,settings")
      .eq("slug", slug).eq("status", "published").maybeSingle();
    const live = admin.ok && published && !published.error && published.data
      ? await funnelMetrics(slug, periodWindow, { client: admin.supabase, funnel: published.data })
      : null;
    const editorParams = new URLSearchParams({ editar: "1", ...Object.fromEntries(library) });
    const liveDays = [...new Set([range.from, range.to, spYmd()].filter(Boolean))].sort();

    return <WorkspaceFrame title="Desempenho" accountEmail={snapshot.accountEmail}>
      <header className="ct-page-heading"><h1>{funnel.name}</h1><p>/{funnel.slug}</p></header>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link className="ct-action-link" href={`/builder/${encodeURIComponent(slug)}?${editorParams}`}>Abrir construtor</Link>
        <ReportDateRange days={liveDays} range={range} />
      </div>
      {live ? <PerformanceView m={live} /> : <section className="ct-panel space-y-3 p-5" aria-labelledby="report-pending-title">
        <h2 id="report-pending-title" className="font-semibold">Indicadores indisponíveis</h2>
        <p className="text-sm text-ct-dim">Não foi possível consultar os indicadores publicados deste funil.</p>
      </section>}
    </WorkspaceFrame>;
  }
  const videoDays = snapshot.vsl.daily.filter(row => row.slug === slug);
  const quizDays = snapshot.quiz.daily?.filter(row => row.slug === slug);
  const diagnosisDays = snapshot.diagnosis.daily?.filter(row => row.slug === slug);
  const leadDays = snapshot.leadsDaily?.rows.filter(row => row.slug === slug) ?? [];
  const leadsCaptureDay = snapshot.leadsDaily ? spDateYmd(new Date(snapshot.leadsDaily.capturedAt)) : "";
  const showLeadsPeriod = Boolean(leadsCaptureDay && range.from && range.to && leadDays.length);
  const filteredLeads = showLeadsPeriod && range.from <= leadsCaptureDay
    ? leadDays.reduce((total, row) => row.day >= range.from && row.day <= range.to ? total + row.leads : total, 0)
    : undefined;
  const series = [...videoDays, ...(quizDays ?? []), ...(diagnosisDays ?? []), ...leadDays];
  const today = spYmd();
  const days = Array.from(new Set([today, ...series.map(row => row.day).filter(day => day <= today)])).sort();
  // No painel oficial, qualquer funil do banco pode entrar na comparação ao vivo.
  const availableFunnelSlugs = new Set((official ? snapshot.funnels : snapshot.analytics.operacao).map(row => row.slug));
  const compared = [...new Set(comparison)].filter(item => availableFunnelSlugs.has(item));
  const editorParams = new URLSearchParams(range.from ? { editar: "1", tab: "leads", ...range }
    : (compared.length || origin) ? { editar: "1", tab: "leads" } : undefined);
  for (const item of compared) editorParams.append("comparar", item);
  preserveReportOrigin(editorParams, origin, responseFunnel, slug);
  if (library.size) {
    editorParams.set("editar", "1");
    for (const [key, value] of library) editorParams.set(key, value);
  }
  const editorQuery = editorParams.size ? `?${editorParams}` : "";
  const comparisonQuery = new URLSearchParams({ tab: "comparar" });
  for (const item of compared) comparisonQuery.append("comparar", item);
  const operationQuery = new URLSearchParams(comparisonQuery);
  operationQuery.set("tab", "operacao");
  const originQuery = new URLSearchParams();
  if (origin) {
    originQuery.set("tab", origin);
    if ((origin === "quiz" || origin === "diagnostico") && responseFunnel === slug) originQuery.set("respFunil", slug);
    if (range.from && range.to) {
      const prefix = origin === "vsl" ? "vsl" : origin === "leads" ? "lead" : "resp";
      originQuery.set(`${prefix}De`, range.from);
      originQuery.set(`${prefix}Ate`, range.to);
    }
  }
  const originLabels = {
    vsl: "Voltar às VSLs",
    quiz: "Voltar ao Quiz",
    diagnostico: "Voltar ao Diagnóstico",
    leads: "Voltar aos Leads no Analytics",
  };
  const liveHref = funnel.status === "published" ? funnelPublicUrl({ slug, domain: funnel.domain }) : null;

  function renderCapturedPanel(label: string, capturedAt: string, hasDaily: boolean, render: (period?: DateRange) => ReactNode) {
    const captureDay = spDateYmd(new Date(capturedAt));
    const activeRange = Boolean(range.from && range.to);
    if (activeRange && hasDaily && range.from > captureDay) {
      return <section className="ct-panel mt-4 p-4" aria-label={label}>
        <h2 className="font-semibold">{label}</h2>
        <p className="mt-1 text-sm text-ct-dim">O intervalo começa após a captura de <SnapshotTimestamp capturedAt={capturedAt} />.</p>
      </section>;
    }
    const partial = activeRange && hasDaily && range.to > captureDay;
    const period = hasDaily ? { from: range.from, to: partial ? captureDay : range.to } : undefined;
    return <div className="mt-4" aria-label={label} role="group">
      {partial && <p className="mb-2 text-xs text-ct-dim">Subtotal até a captura de <SnapshotTimestamp capturedAt={capturedAt} />.</p>}
      {activeRange && !hasDaily && <p className="mb-2 text-xs text-ct-dim">Dados acumulados. Este painel não tem série diária para o funil.</p>}
      {render(period)}
    </div>;
  }

  // No painel oficial, o construtor abre o funil do banco: um atalho para editar
  // e outro para os leads do período, ambos com o caminho de volta.
  const builderParams = new URLSearchParams(editorParams);
  for (const key of ["editar", "tab", "from", "to"]) builderParams.delete(key);
  const leadsParams = new URLSearchParams(builderParams);
  leadsParams.set("tab", "leads");
  if (range.from && range.to) {
    leadsParams.set("from", range.from);
    leadsParams.set("to", range.to);
  }
  const builderHref = `/builder/${encodeURIComponent(slug)}`;
  const heading = <header className="ct-page-heading">
    <div><h1>{funnel.name}</h1><p>/{slug}</p></div>
    {liveHref && <a href={liveHref} target="_blank" rel="noreferrer" className="ct-action-link">Ver página publicada</a>}
  </header>;
  const navigation = <nav aria-label="Navegação do relatório" className="mb-4 flex flex-wrap gap-4 text-sm">
    <Link className="text-ct-blue" href={libraryHref(library)}>Meus funis</Link>
    <Link className="text-ct-blue" href={`/analytics?${operationQuery}`}>Operação no Analytics</Link>
    {origin && <Link className="text-ct-blue" href={`/analytics?${originQuery}`}>{originLabels[origin]}</Link>}
    {compared.length >= 2 && compared.includes(slug) && <Link className="text-ct-blue"
      href={`/analytics?${comparisonQuery}`}>Voltar à comparação</Link>}
    {official ? <>
      <Link className="text-ct-blue" href={builderParams.size ? `${builderHref}?${builderParams}` : builderHref}>Abrir construtor</Link>
      <Link className="text-ct-blue" href={`${builderHref}?${leadsParams}`}>Consultar leads</Link>
    </> : hasPreviewFunnelDraft(slug) && <Link className="text-ct-blue" href={`${builderHref}${editorQuery}`}>Abrir cópia editável</Link>}
  </nav>;
  const capturedPanels = <>
    {video && renderCapturedPanel("Progresso de vídeo", snapshot.vsl.captured_at, videoDays.length > 0, period =>
      <SnapshotVslView data={{ ...snapshot.vsl, rows: [video], daily: videoDays }} individual reportRange={period} />)}
    {quiz.length > 0 && renderCapturedPanel("Respostas do Quiz", snapshot.quiz.captured_at, Boolean(quizDays?.length), period =>
      <SnapshotQuizView data={{ ...snapshot.quiz, quiz, daily: quizDays }} individual reportRange={period} />)}
    {diagnosis.length > 0 && renderCapturedPanel("Capturas do Diagnóstico", snapshot.diagnosis.captured_at, Boolean(diagnosisDays?.length), period =>
      <SnapshotDiagnosisView data={{ ...snapshot.diagnosis, questions: diagnosis, daily: diagnosisDays }} individual reportRange={period} />)}
  </>;

  if (!metrics) {
    // Painel oficial: indicadores ao vivo no período escolhido. VSL, Quiz e
    // Diagnóstico ainda não têm fonte ao vivo e seguem da captura, com a data.
    const periodWindow = {
      from: range.from ? janelaDeChave("dia", range.from).janela.from : undefined,
      to: range.to ? janelaDeChave("dia", range.to).janela.to : undefined,
    };
    const admin = await requireAdmin();
    const result = admin.ok ? await funnelMetrics(slug, periodWindow) : null;
    const live = result?.found ? result : null;
    const reportDays = [...new Set([...days, range.from, range.to].filter(Boolean))].sort();
    return <WorkspaceFrame title="Desempenho do funil" accountEmail={snapshot.accountEmail}>
      {heading}
      {navigation}
      <section className="ct-panel flex flex-wrap items-center justify-between gap-3 p-4" aria-labelledby="report-period">
        <div><h2 id="report-period" className="font-semibold">Período do relatório</h2>
          <p className="text-sm text-ct-dim">Indicadores ao vivo. Os painéis capturados contam até a data da captura.</p></div>
        <ReportDateRange days={reportDays} range={range} />
      </section>
      <div className="mt-4">
        {live ? <PerformanceView m={live} /> : <section className="ct-panel space-y-3 p-5" aria-labelledby="report-pending-title">
          <h2 id="report-pending-title" className="font-semibold">Indicadores indisponíveis</h2>
          <p className="text-sm text-ct-dim">Não foi possível consultar os indicadores deste funil. Atualize a página para tentar de novo.</p>
        </section>}
      </div>
      {capturedPanels}
    </WorkspaceFrame>;
  }

  const number = new Intl.NumberFormat("pt-BR");
  const summary = [
    ["Sessões", number.format(metrics.visitantes)],
    ["Respostas", number.format(metrics.respostas)],
    ["Leads", number.format(metrics.leads)],
    ["Conclusões", number.format(metrics.conclusoes)],
    ["Taxa de conclusão", `${number.format(metrics.taxaConclusao)}%`],
    ["Score", number.format(metrics.score)],
  ];
  return <WorkspaceFrame title="Desempenho do funil" accountEmail={snapshot.accountEmail}>
    {heading}
    {navigation}
    <section className="ct-panel" aria-labelledby="funnel-summary">
      <header className="ct-section-heading"><div><h2 id="funnel-summary">Resumo acumulado</h2><p>Dados reais em modo de consulta · Captura de <SnapshotTimestamp capturedAt={snapshot.capturedAt} />.</p></div></header>
      <dl className="grid gap-3 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map(([label, value]) => <div className="rounded-xl border border-ct-line bg-ct-raised p-4" key={label}>
          <dt className="text-sm text-ct-dim">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold">{value}</dd>
        </div>)}
      </dl>
    </section>
    {series.length > 0 && <section className="ct-panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4" aria-labelledby="report-period">
      <div><h2 id="report-period" className="font-semibold">Período do relatório</h2>
        <p className="text-sm text-ct-dim">Aplica-se aos painéis com série diária abaixo.</p></div>
      <ReportDateRange days={days} range={range} />
    </section>}
    {snapshot.leadsDaily && showLeadsPeriod && <section aria-labelledby="leads-in-range" className="ct-panel mt-4 p-4">
      <h2 id="leads-in-range" className="text-sm text-ct-dim">Leads no período</h2>
      {filteredLeads === undefined
        ? <p className="mt-1 text-sm">O intervalo começa após a captura diária.</p>
        : <dl className="mt-1">
          <dt className="sr-only">Total registrado na captura</dt>
          <dd className="text-2xl font-semibold">{number.format(filteredLeads)}</dd>
        </dl>}
      <p className="mt-1 text-xs text-ct-dim">
        {filteredLeads !== undefined && range.to > leadsCaptureDay ? "Subtotal até a captura diária de " : "Captura diária de "}
        <SnapshotTimestamp capturedAt={snapshot.leadsDaily.capturedAt} />.
      </p>
    </section>}
    {capturedPanels}
  </WorkspaceFrame>;
}

/**
 * Performance por funil — renderiza o MESMO PerformanceView da sub-aba do
 * builder (antes era o FunnelAnalytics, duplicado e com filtros de período
 * mortos). Uma única fonte de verdade visual.
 */
export default async function FunnelMetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<LibraryContextQuery & { p?: string; d?: string; from?: string; to?: string; comparar?: string | string[]; origem?: string; respFunil?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const host = (await headers()).get("host");
  if (isRealDataPreview(host)) {
    const selectedRange = sp.from === undefined && sp.to === undefined
      ? civilRangeFromPeriod(sp.p, sp.d)
      : parseCivilRange(sp.from, sp.to);
    const range = selectedRange ?? { from: "", to: "" };
    const comparison = typeof sp.comparar === "string" ? [sp.comparar] : sp.comparar ?? [];
    return <SnapshotFunnelReport slug={slug} range={range} comparison={comparison} origin={reportOrigin(sp.origem)} responseFunnel={sp.respFunil} library={libraryContext(sp)} official={isOfficialWorkspaceHost(host)} />;
  }
  // O filtro é feito por LINK, não por estado no cliente: esta página é server
  // component e já é `force-dynamic`. Assim o período entra na URL (dá pra
  // salvar e compartilhar) e a tela não carrega JS nenhum pra isso.
  const { key: periodo, janela } = janelaDeChave(sp.p, sp.d);
  const [m, funnel] = await Promise.all([funnelMetrics(slug, janela), resolveFunnel(slug)]);
  if (!m.found && !funnel) notFound();
  const liveHref = funnelPublicUrl({ slug, domain: funnel?.domain });
  return (
    <WorkspaceFrame title="Desempenho"><div className="ct-controls">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">←</Link>
            <div>
              <h1 className="text-sm font-bold">{m.name}</h1>
              <p className="text-xs text-neutral-500">/{slug} · {m.totalSteps} lâminas · {rotuloDoPeriodo(periodo, sp.d)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/builder/${slug}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">✏️ Editar funil</Link>
            {/* o CSV segue o mesmo período da tela: filtrar e exportar "tudo"
                seria surpresa desagradável na hora de conferir os números */}
            <a
              href={`/api/export-leads?slug=${encodeURIComponent(slug)}`
                + (janela.from ? `&from=${encodeURIComponent(janela.from)}` : "")
                + (janela.to ? `&to=${encodeURIComponent(janela.to)}` : "")}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              ⬇ Exportar leads{janela.from ? " (período)" : ""}
            </a>
            <a href={liveHref} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-5">
        {/* FILTRO DE PERÍODO — até 10/08/2026 esta tela não tinha nenhum, mas o
            estado vazio do PerformanceView mandava "Troque o período acima".
            Feito com <Link> e <form method=get> porque a página é server
            component: o período vira URL (compartilhável, recarregável) e não
            entra um byte de JS pra isso. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Período</span>
          {PERIODOS.map((pr) => (
            <Link
              key={pr.key}
              aria-current={periodo === pr.key ? "page" : undefined}
              href={pr.key === "tudo" ? `/dashboard/${slug}` : `/dashboard/${slug}?p=${pr.key}`}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                periodo === pr.key ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {pr.label}
            </Link>
          ))}
          <form method="get" className="ml-auto flex items-center gap-1.5">
            <input type="hidden" name="p" value="dia" />
            <input
              type="date"
              name="d"
              aria-label="Dia do relatório"
              defaultValue={sp.d || ""}
              max={spYmd(0)}
              className={`rounded-lg border px-2 py-1 text-xs ${periodo === "dia" ? "border-neutral-900 font-semibold" : "border-neutral-200 text-neutral-600"}`}
            />
            <button type="submit" className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
              Ver dia
            </button>
          </form>
        </div>
        <PerformanceView m={m} />
      </div>
    </div></WorkspaceFrame>
  );
}
