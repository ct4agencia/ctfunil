import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FunnelBuilder from "@/components/builder/FunnelBuilder";
import LayersBuilder from "@/components/builder/LayersBuilder";
import { resolveFunnel } from "@/lib/quiz/funnels-db";

export const metadata: Metadata = { title: "Construtor de Quiz" };

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = await resolveFunnel(slug);
  if (!funnel) notFound();
  // Funis do motor "layers" (clones do inlead) usam o construtor de blocos.
  if (funnel.settings?.engine === "layers") return <LayersBuilder initial={funnel} />;
  return <FunnelBuilder initial={funnel} />;
}
