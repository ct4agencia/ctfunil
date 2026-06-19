import type { Metadata } from "next";
import { Inter } from "next/font/google";
import GlobalAnalyticsView from "@/components/dashboard/GlobalAnalyticsView";
import { globalAnalytics } from "@/lib/quiz/metrics";

const inter = Inter({ subsets: ["latin"], variable: "--font-admin" });

export const metadata: Metadata = { title: "Analytics · CTFUNNEL" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await globalAnalytics();
  return (
    <div className={inter.variable}>
      <GlobalAnalyticsView data={data} />
    </div>
  );
}
