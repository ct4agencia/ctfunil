import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import VslView from "@/components/vsl/VslView";
import BlockRenderer from "@/components/vsl/BlockRenderer";
import PixelScripts from "@/components/vsl/PixelScripts";
import QuizRunner from "@/components/quiz/QuizRunner";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
import { resolveFunnel } from "@/lib/quiz/funnels-db";
import { leadGeo } from "@/lib/quiz/geo";
import type { Vsl } from "@/lib/types";

const display = Fraunces({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-display" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-q" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-poppins" });

export const dynamic = "force-dynamic";

async function getVsl(slug: string): Promise<Vsl | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("vsls").select("*").eq("slug", slug).eq("status", "published").single();
  return (data as Vsl) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const funnel = await resolveFunnel(slug);
  if (funnel) {
    const seo = funnel.settings?.seo ?? {};
    return {
      title: seo.title || funnel.name,
      description: seo.description,
      icons: seo.favicon ? { icon: seo.favicon } : undefined,
      openGraph: { title: seo.title || funnel.name, description: seo.description, images: seo.ogImage ? [seo.ogImage] : undefined },
    };
  }
  const vsl = await getVsl(slug);
  if (!vsl) return { title: "Página não encontrada" };
  const seo = vsl.settings?.seo ?? {};
  return { title: seo.title || vsl.name, description: seo.description || vsl.niche || undefined };
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1) FUNIL de quiz (CTFUNNEL) — prioridade
  const funnel = await resolveFunnel(slug);
  if (funnel) {
    const geo = await leadGeo();
    const usePoppins = funnel.font === "poppins" || funnel.paletteId === "ambar-velas";
    return (
      <div
        className={`${display.variable} ${sans.variable} ${poppins.variable}`}
        style={{
          fontFamily: usePoppins ? "var(--font-poppins), system-ui, sans-serif" : "var(--font-sans-q), system-ui, sans-serif",
          ["--q-display" as string]: usePoppins ? "var(--font-poppins), system-ui, sans-serif" : "var(--font-display), Georgia, serif",
        } as React.CSSProperties}
      >
        <PixelScripts settings={funnel.settings ?? {}} utmifyPixelId={funnel.utmifyPixelId ?? null} hotmartAccountId={funnel.hotmartAccountId ?? null} />
        {funnel.settings?.engine === "layers"
          ? <LayersRunner funnel={funnel} geo={geo} />
          : <QuizRunner funnel={funnel} geo={geo} />}
      </div>
    );
  }

  // 2) Fallback: VSL antiga (vsl-platform)
  const vsl = await getVsl(slug);
  if (!vsl) notFound();
  const hasBlocks = Array.isArray(vsl.blocks) && vsl.blocks.length > 0;
  return (
    <>
      <PixelScripts settings={vsl.settings ?? {}} utmifyPixelId={vsl.utmify_pixel_id} hotmartAccountId={vsl.hotmart_account_id} />
      {hasBlocks ? <BlockRenderer vsl={vsl} blocks={vsl.blocks} /> : <VslView vsl={vsl} />}
    </>
  );
}
