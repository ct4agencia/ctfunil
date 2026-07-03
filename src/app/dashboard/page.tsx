import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/Dashboard";
import { listFunnelsDb } from "@/lib/quiz/funnels-db";
import { dashboardMetrics } from "@/lib/quiz/metrics";

export const metadata: Metadata = { title: "Dashboard · CTFUNNEL" };
export const dynamic = "force-dynamic";

// Fonte: a Inter (--font-admin) vem do root layout — declarar de novo aqui
// duplicava o download/preload da fonte.
export default async function DashboardPage() {
  const [funnels, metrics] = await Promise.all([listFunnelsDb(), dashboardMetrics()]);
  return <Dashboard funnels={funnels} metrics={metrics} />;
}
