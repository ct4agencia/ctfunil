import type { Metadata } from "next";
import GlobalAnalyticsView from "@/components/dashboard/GlobalAnalyticsView";
import { globalAnalytics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Analytics · CTFUNNEL" };
export const dynamic = "force-dynamic";

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function AnalyticsPage() {
  const data = await globalAnalytics();
  return <GlobalAnalyticsView data={data} />;
}
