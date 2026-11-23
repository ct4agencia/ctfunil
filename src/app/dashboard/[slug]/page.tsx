import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { isRealDataPreview } from "@/lib/workspace-preview";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { notFound } from "next/navigation";
import { hasPreviewFunnelDraft } from "@/lib/workspace-preview-vsl-drafts";
import SnapshotTimestamp from "@/components/dashboard/SnapshotTimestamp";
import SnapshotQuizView from "@/components/dashboard/SnapshotQuizView";
import SnapshotDiagnosisView from "@/components/dashboard/SnapshotDiagnosisView";
import SnapshotVslView from "@/components/dashboard/SnapshotVslView";
import PerformanceView from "@/components/dashboard/PerformanceView";
import { funnelMetrics } from "@/lib/quiz/metrics";
import { resolveFunnel } from "@/lib/quiz/funnels-db";
import { PERIODOS, janelaDeChave, rotuloDoPeriodo, spYmd } from "@/lib/quiz/periodo";

export const metadata: Metadata = { title: "Performance do funil · CTFUNNEL" };
export const dynamic = "force-dynamic";

async function SnapshotFunnelReport({ slug }: { slug: string }) {
  const snapshot = await getWorkspaceSnapshot();
  const funnel = snapshot.funnels.find(item => item.slug === slug);
  const metrics = snapshot.analytics.operacao.find(item => item.slug === slug);
  const video = snapshot.vsl.rows.find(item => item.slug === slug);
  const quiz = snapshot.quiz.quiz.filter(item => item.slug === slug);
  const diagnosis = snapshot.diagnosis.questions.filter(item => item.slug === slug);
  if (!funnel || !metrics) notFound();
  const number = new Intl.NumberFormat("pt-BR");
  const summary = [
    ["Sessões", number.format(metrics.visitantes)],
    ["Respostas", number.format(metrics.respostas)],
    ["Leads", number.format(metrics.leads)],
    ["Conclusões", number.format(metrics.conclusoes)],
    ["Taxa de conclusão", `${number.format(metrics.taxaConclusao)}%`],
    ["Score", number.format(metrics.score)],
  ];
  const liveHref = funnel.status === "published" && funnel.domain ? `https://${funnel.domain}/${encodeURIComponent(slug)}` : null;

  return <WorkspaceFrame title="Desempenho do funil">
    <header className="ct-page-heading">
      <div><h1>{funnel.name}</h1><p>/{slug}</p></div>
      {liveHref && <a href={liveHref} target="_blank" rel="noreferrer" className="ct-action-link">Ver página publicada</a>}
    </header>
    <nav aria-label="Navegação do relatório" className="mb-4 flex flex-wrap gap-4 text-sm">
      <Link className="text-ct-blue" href="/dashboard">Meus funis</Link>
      <Link className="text-ct-blue" href="/analytics?tab=operacao">Operação no Analytics</Link>
      {hasPreviewFunnelDraft(slug) && <Link className="text-ct-blue" href={`/builder/${encodeURIComponent(slug)}`}>Abrir cópia editável</Link>}
    </nav>
    <section className="ct-panel" aria-labelledby="funnel-summary">
      <header className="ct-section-heading"><div><h2 id="funnel-summary">Resumo acumulado</h2><p>Dados reais em modo de consulta · Captura de <SnapshotTimestamp capturedAt={snapshot.capturedAt} />.</p></div></header>
      <dl className="grid gap-3 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map(([label, value]) => <div className="rounded-xl border border-ct-line bg-ct-raised p-4" key={label}>
          <dt className="text-sm text-ct-dim">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold">{value}</dd>
        </div>)}
      </dl>
    </section>
    {video && <div className="mt-4"><SnapshotVslView data={{ ...snapshot.vsl, rows: [video], daily: snapshot.vsl.daily.filter(row => row.slug === slug) }} individual /></div>}
    {quiz.length > 0 && <div className="mt-4"><SnapshotQuizView data={{ ...snapshot.quiz, quiz, daily: snapshot.quiz.daily?.filter(row => row.slug === slug) }} individual /></div>}
    {diagnosis.length > 0 && <div className="mt-4"><SnapshotDiagnosisView data={{ ...snapshot.diagnosis, questions: diagnosis, daily: snapshot.diagnosis.daily?.filter(row => row.slug === slug) }} individual /></div>}
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
  searchParams: Promise<{ p?: string; d?: string }>;
}) {
  const { slug } = await params;
  if (isRealDataPreview((await headers()).get("host"))) return <SnapshotFunnelReport slug={slug} />;
  const sp = await searchParams;
  // O filtro é feito por LINK, não por estado no cliente: esta página é server
  // component e já é `force-dynamic`. Assim o período entra na URL (dá pra
  // salvar e compartilhar) e a tela não carrega JS nenhum pra isso.
  const { key: periodo, janela } = janelaDeChave(sp.p, sp.d);
  const [m, funnel] = await Promise.all([funnelMetrics(slug, janela), resolveFunnel(slug)]);
  if (!m.found && !funnel) notFound();
  const liveHref = funnel?.domain ? `https://${funnel.domain}/${slug}` : `/${slug}`;
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
