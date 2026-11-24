import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { headers } from "next/headers";
import { isOfficialWorkspaceHost, isRealDataPreview, isWorkspacePreview } from "@/lib/workspace-preview";
import { previewAnalytics } from "@/lib/workspace-preview-data";
import type { Metadata } from "next";
import GlobalAnalyticsView from "@/components/dashboard/GlobalAnalyticsView";
import { hasPreviewFunnelDraft } from "@/lib/workspace-preview-vsl-drafts";
import { globalAnalytics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Analytics · CTFUNNEL" };
export const dynamic = "force-dynamic";

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function AnalyticsPage() {
  const host = (await headers()).get("host");
  if (isOfficialWorkspaceHost(host)) {
    // Painel oficial: operação, tráfego, criativos e leads ao vivo. VSL, vendas,
    // quiz e diagnóstico ainda não têm fonte ao vivo e mostram a captura, com a data.
    const [snapshot, data] = await Promise.all([getWorkspaceSnapshot(), globalAnalytics()]);
    return <GlobalAnalyticsView accountEmail={snapshot.accountEmail} data={data} vslSnapshot={snapshot.vsl} salesSnapshot={snapshot.sales} quizSnapshot={snapshot.quiz} diagnosisSnapshot={snapshot.diagnosis} />;
  }
  if (isRealDataPreview(host)) {
    const snapshot = await getWorkspaceSnapshot();
    return <GlobalAnalyticsView accountEmail={snapshot.accountEmail} data={snapshot.analytics} preview snapshotAt={snapshot.capturedAt} attributionCapturedAt={snapshot.attributionCapturedAt} attributionDaily={snapshot.attributionDaily} adAccounts={snapshot.adAccounts} vslSnapshot={snapshot.vsl} salesSnapshot={snapshot.sales} quizSnapshot={snapshot.quiz} diagnosisSnapshot={snapshot.diagnosis} leadsDaily={snapshot.leadsDaily} editableSlugs={snapshot.funnels.map(funnel => funnel.slug).filter(hasPreviewFunnelDraft)} />;
  }
  if (isWorkspacePreview(host)) return <GlobalAnalyticsView data={previewAnalytics} preview />;
  const data = await globalAnalytics();
  return <GlobalAnalyticsView data={data} />;
}
