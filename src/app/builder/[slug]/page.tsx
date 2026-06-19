import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FunnelBuilder from "@/components/builder/FunnelBuilder";
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
  return <FunnelBuilder initial={funnel} />;
}
