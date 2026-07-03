import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PerformanceView from "@/components/dashboard/PerformanceView";
import { funnelMetrics } from "@/lib/quiz/metrics";
import { resolveFunnel } from "@/lib/quiz/funnels-db";

export const metadata: Metadata = { title: "Performance do funil · CTFUNNEL" };
export const dynamic = "force-dynamic";

/**
 * Performance por funil — renderiza o MESMO PerformanceView da sub-aba do
 * builder (antes era o FunnelAnalytics, duplicado e com filtros de período
 * mortos). Uma única fonte de verdade visual.
 */
export default async function FunnelMetricsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [m, funnel] = await Promise.all([funnelMetrics(slug), resolveFunnel(slug)]);
  if (!m.found && !funnel) notFound();
  const liveHref = funnel?.domain ? `https://${funnel.domain}/${slug}` : `/${slug}`;
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">←</Link>
            <div>
              <h1 className="text-sm font-bold">{m.name}</h1>
              <p className="text-xs text-neutral-500">/{slug} · {m.totalSteps} lâminas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/builder/${slug}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">✏️ Editar funil</Link>
            <a href={`/api/export-leads?slug=${encodeURIComponent(slug)}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⬇ Exportar leads</a>
            <a href={liveHref} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-5">
        <PerformanceView m={m} />
      </div>
    </div>
  );
}
