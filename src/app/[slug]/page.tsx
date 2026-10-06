import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { createAdminClient } from "@/lib/supabase/server";
import VslView from "@/components/vsl/VslView";
import BlockRenderer from "@/components/vsl/BlockRenderer";
import PixelScripts from "@/components/vsl/PixelScripts";
import FunnelRenderer from "@/components/quiz/FunnelRenderer";
import VisitBeacon from "@/components/quiz/VisitBeacon";
import HeroPreload from "@/components/quiz/HeroPreload";
import { resolveFunnel } from "@/lib/quiz/funnels-db";
import type { Vsl } from "@/lib/types";

// preload:false: 8 arquivos de fonte preloadados competiam com o texto do LCP
// no 4G (medido vs inlead). display:swap (default) pinta com fallback na hora.
const display = Fraunces({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-display", preload: false });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-q", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-poppins", preload: false });

// ISR: HTML servido do cache de borda (igual o inlead faz via Cloudflare).
// Salvar no builder revalida na hora (revalidatePath em saveFunnelAction);
// o geo {estado} vem do client (/api/geo) pra não forçar dynamic.
export const revalidate = 300;
// vazio = nenhum slug pré-gerado no build; cada slug vira ISR no 1º acesso
export async function generateStaticParams() {
  return [];
}

// admin client (sem cookies): a rota é ISR/estática — cookies() aqui explodia
// com DYNAMIC_SERVER_USAGE pra qualquer slug desconhecido (ex.: favicon.ico).
async function getVsl(slug: string): Promise<Vsl | null> {
  const supabase = createAdminClient();
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
    const usePoppins = funnel.font === "poppins" || funnel.paletteId === "ambar-velas";
    return (
      <div
        className={`${display.variable} ${sans.variable} ${poppins.variable}`}
        style={{
          fontFamily: usePoppins ? "var(--font-poppins), system-ui, sans-serif" : "var(--font-sans-q), system-ui, sans-serif",
          ["--q-display" as string]: usePoppins ? "var(--font-poppins), system-ui, sans-serif" : "var(--font-display), Georgia, serif",
        } as React.CSSProperties}
      >
        <VisitBeacon slug={slug} />
        <HeroPreload funnel={funnel} />
        <PixelScripts settings={funnel.settings ?? {}} utmifyPixelId={funnel.utmifyPixelId ?? null} hotmartAccountId={funnel.hotmartAccountId ?? null} />
        <FunnelRenderer funnel={funnel} />
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
