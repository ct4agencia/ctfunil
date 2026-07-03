import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BuilderRenderer from "@/components/builder/BuilderRenderer";
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
  // O BuilderRenderer faz code-split por engine (só baixa o construtor usado).
  return <BuilderRenderer funnel={funnel} />;
}
