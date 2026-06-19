import type { Metadata } from "next";
import FunnelAnalytics from "@/components/dashboard/FunnelAnalytics";
import { funnelMetrics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Métricas do funil · CTFUNNEL" };
export const dynamic = "force-dynamic";

export default async function FunnelMetricsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await funnelMetrics(slug);
  return <FunnelAnalytics slug={slug} m={m} />;
}
