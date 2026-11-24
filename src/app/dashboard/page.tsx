import { hasPreviewVslDraft } from "@/lib/workspace-preview-vsl-drafts";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { headers } from "next/headers";
import { isOfficialWorkspaceHost, isRealDataPreview, isWorkspacePreview } from "@/lib/workspace-preview";
import { previewFunnels, previewAnalytics } from "@/lib/workspace-preview-data";
import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/Dashboard";
import { listFunnelsDb } from "@/lib/quiz/funnels-db";
import { dashboardMetrics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Dashboard · CTFUNNEL" };
export const dynamic = "force-dynamic";

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function DashboardPage() {
  const host = (await headers()).get("host");
  if (isOfficialWorkspaceHost(host)) {
    // Painel oficial: funis e indicadores ao vivo; as páginas VSL seguem da captura.
    const [snapshot, metrics] = await Promise.all([getWorkspaceSnapshot(), dashboardMetrics()]);
    const pages = snapshot.vsl.rows.map(({ name, slug, tracked }) => ({ name, slug, tracked }));
    return <Dashboard accountEmail={snapshot.accountEmail} funnels={snapshot.funnels} metrics={metrics} pagesCapturedAt={snapshot.vsl.captured_at} pages={pages} />;
  }
  if (isRealDataPreview(host)) {
    const snapshot = await getWorkspaceSnapshot();
    const capturedPages = snapshot.vsl.rows.map(({ name, slug, tracked }) => ({ name, slug, tracked }));
    const capturedSlugs = new Set(capturedPages.map(page => page.slug));
    const newPages = snapshot.funnels
      .filter(funnel => !capturedSlugs.has(funnel.slug) && hasPreviewVslDraft(funnel.slug))
      .map(({ name, slug }) => ({ name, slug }));
    return <Dashboard accountEmail={snapshot.accountEmail} funnels={snapshot.funnels} metrics={snapshot.analytics.overview} preview snapshotAt={snapshot.capturedAt} pagesCapturedAt={snapshot.vsl.captured_at} pages={[...newPages, ...capturedPages]} />;
  }
  if (isWorkspacePreview(host)) return <Dashboard funnels={previewFunnels} metrics={previewAnalytics.overview} preview />;
  const [funnels, metrics] = await Promise.all([listFunnelsDb(), dashboardMetrics()]);
  return <Dashboard funnels={funnels} metrics={metrics} />;
}
