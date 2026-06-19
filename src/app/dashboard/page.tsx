import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Dashboard from "@/components/dashboard/Dashboard";
import { listFunnelsDb } from "@/lib/quiz/funnels-db";
import { dashboardMetrics } from "@/lib/quiz/metrics";

const inter = Inter({ subsets: ["latin"], variable: "--font-admin" });

export const metadata: Metadata = { title: "Dashboard · CTFUNNEL" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [funnels, metrics] = await Promise.all([listFunnelsDb(), dashboardMetrics()]);
  return (
    <div className={inter.variable}>
      <Dashboard funnels={funnels} metrics={metrics} />
    </div>
  );
}
