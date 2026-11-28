import { hasPreviewVslDraft } from "@/lib/workspace-preview-vsl-drafts";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { headers } from "next/headers";
import { isOfficialWorkspaceHost, isRealDataPreview, isWorkspacePreview } from "@/lib/workspace-preview";
import { previewFunnels, previewAnalytics } from "@/lib/workspace-preview-data";
import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/Dashboard";
import type { FunnelStats } from "@/components/dashboard/funis/FunnelCard";
import { listFunnelsDb } from "@/lib/quiz/funnels-db";
import { dashboardMetrics, type DashboardMetrics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Dashboard · CTFUNNEL" };
export const dynamic = "force-dynamic";

const capturedDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Métricas dos cartões (Visitas, Interações, Leads, Conclusões) ao vivo, do dashboardMetrics. */
function liveStats(metrics: DashboardMetrics): Record<string, FunnelStats> {
  return Object.fromEntries(metrics.porFunil.map(row => [row.slug, {
    visitas: row.sessoes, interacoes: row.respostas ?? 0, leads: row.leads ?? 0, conclusoes: row.conclusoes ?? 0,
  }]));
}

/** No preview em consulta, as métricas por funil vêm da captura (analytics.operacao). */
function capturedStats(rows: { slug: string; visitantes: number; respostas: number; leads: number; conclusoes: number }[]): Record<string, FunnelStats> {
  return Object.fromEntries(rows.map(row => [row.slug, {
    visitas: row.visitantes, interacoes: row.respostas, leads: row.leads, conclusoes: row.conclusoes,
  }]));
}

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function DashboardPage() {
  const host = (await headers()).get("host");
  if (isOfficialWorkspaceHost(host)) {
    // Painel oficial: funis e indicadores ao vivo; as páginas VSL seguem da captura.
    const [snapshot, metrics] = await Promise.all([getWorkspaceSnapshot(), dashboardMetrics()]);
    const pages = snapshot.vsl.rows.map(({ name, slug, tracked }) => ({ name, slug, tracked }));
    return <Dashboard accountEmail={snapshot.accountEmail} funnels={snapshot.funnels} metrics={metrics} pagesCapturedAt={snapshot.vsl.captured_at} pages={pages} stats={liveStats(metrics)} statsMissing="Sem sessões registradas." />;
  }
  if (isRealDataPreview(host)) {
    const snapshot = await getWorkspaceSnapshot();
    const capturedPages = snapshot.vsl.rows.map(({ name, slug, tracked }) => ({ name, slug, tracked }));
    const capturedSlugs = new Set(capturedPages.map(page => page.slug));
    const newPages = snapshot.funnels
      .filter(funnel => !capturedSlugs.has(funnel.slug) && hasPreviewVslDraft(funnel.slug))
      .map(({ name, slug }) => ({ name, slug }));
    const day = capturedDate.format(new Date(snapshot.capturedAt));
    return <Dashboard accountEmail={snapshot.accountEmail} funnels={snapshot.funnels} metrics={snapshot.analytics.overview} preview snapshotAt={snapshot.capturedAt} pagesCapturedAt={snapshot.vsl.captured_at} pages={[...newPages, ...capturedPages]}
      stats={capturedStats(snapshot.analytics.operacao)} statsSource={`Visitas, interações, leads e conclusões da captura de ${day}. Funis criados depois aparecem com “—”.`} statsMissing={`Funil fora da captura de ${day}.`} />;
  }
  if (isWorkspacePreview(host)) return <Dashboard funnels={previewFunnels} metrics={previewAnalytics.overview} preview />;
  const [funnels, metrics] = await Promise.all([listFunnelsDb(), dashboardMetrics()]);
  return <Dashboard funnels={funnels} metrics={metrics} stats={liveStats(metrics)} statsMissing="Sem sessões registradas." />;
}
