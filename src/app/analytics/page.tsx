import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { headers } from "next/headers";
import { isRealDataPreview, isWorkspacePreview } from "@/lib/workspace-preview";
import { previewAnalytics } from "@/lib/workspace-preview-data";
import type { Metadata } from "next";
import GlobalAnalyticsView from "@/components/dashboard/GlobalAnalyticsView";
import { globalAnalytics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Analytics · CTFUNNEL" };
export const dynamic = "force-dynamic";

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function AnalyticsPage() {
  const host = (await headers()).get("host");
  if (isRealDataPreview(host)) {
    const snapshot = await getWorkspaceSnapshot();
    return <GlobalAnalyticsView data={snapshot.analytics} preview snapshotAt={snapshot.capturedAt} attributionCapturedAt={snapshot.attributionCapturedAt} attributionDaily={snapshot.attributionDaily} adAccounts={snapshot.adAccounts} vslSnapshot={snapshot.vsl} salesSnapshot={snapshot.sales} quizSnapshot={snapshot.quiz} diagnosisSnapshot={snapshot.diagnosis} leadsDaily={snapshot.leadsDaily} />;
  }
  if (isWorkspacePreview(host)) return <GlobalAnalyticsView data={previewAnalytics} preview />;
  const data = await globalAnalytics();
  return <GlobalAnalyticsView data={data} />;
}
