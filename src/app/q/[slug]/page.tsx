import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { display, sans, poppins } from "@/app/fonts/funnel-fonts";
import FunnelRenderer from "@/components/quiz/FunnelRenderer";
import VisitBeacon from "@/components/quiz/VisitBeacon";
import HeroPreload from "@/components/quiz/HeroPreload";
import PixelScripts from "@/components/vsl/PixelScripts";
import { resolvePublicFunnel } from "@/lib/quiz/funnels-db";
import { leadGeo } from "@/lib/quiz/geo";

// preload:false: fontes com display:swap pintam com fallback e não competem
// com o texto do LCP no 4G (mesma otimização da rota /[slug]).
// Poppins (vivadevelas) — display + corpo alternativos

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const funnel = await resolvePublicFunnel(slug);
  if (!funnel) return { title: "Quiz" };
  const seo = funnel.settings?.seo ?? {};
  const favicon = seo.favicon || funnel.logo;
  return {
    title: seo.title || funnel.name,
    description: seo.description,
    ...(favicon ? { icons: { icon: favicon } } : {}),
    openGraph: {
      title: seo.title || funnel.name,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";
  const funnel = await resolvePublicFunnel(slug);
  if (!funnel) notFound();
  const geo = isPreview ? {} : await leadGeo();

  // Poppins quando o funil pede explicitamente OU usa a paleta âmbar (vivadevelas).
  // O 2º caso garante o visual mesmo se o campo `font` ainda não persistir (migração 0010).
  const usePoppins = funnel.font === "poppins" || funnel.paletteId === "ambar-velas";
  return (
    <div
      className={`${display.variable} ${sans.variable} ${poppins.variable}`}
      style={
        {
          fontFamily: usePoppins
            ? "var(--font-poppins), system-ui, sans-serif"
            : "var(--font-sans-q), system-ui, sans-serif",
          ["--q-display" as string]: usePoppins
            ? "var(--font-poppins), system-ui, sans-serif"
            : "var(--font-display), Georgia, serif",
        } as React.CSSProperties
      }
    >
      {isPreview ? null : (
        <>
          <VisitBeacon slug={slug} />
          <HeroPreload funnel={funnel} />
          <PixelScripts
            settings={funnel.settings ?? {}}
            utmifyPixelId={funnel.utmifyPixelId ?? null}
            hotmartAccountId={funnel.hotmartAccountId ?? null}
          />
        </>
      )}
      <FunnelRenderer funnel={funnel} geo={geo} preview={isPreview} />
    </div>
  );
}
