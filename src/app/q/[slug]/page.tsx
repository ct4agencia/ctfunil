import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import QuizRunner from "@/components/quiz/QuizRunner";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
import ChatRunner from "@/components/quiz/typebot/ChatRunner";
import PixelScripts from "@/components/vsl/PixelScripts";
import { resolveFunnel } from "@/lib/quiz/funnels-db";
import { leadGeo } from "@/lib/quiz/geo";

const display = Fraunces({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-display" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-q" });
// Poppins (vivadevelas) — display + corpo alternativos
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-poppins" });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const funnel = await resolveFunnel(slug);
  if (!funnel) return { title: "Quiz" };
  const seo = funnel.settings?.seo ?? {};
  return {
    title: seo.title || funnel.name,
    description: seo.description,
    icons: seo.favicon ? { icon: seo.favicon } : undefined,
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
  const funnel = await resolveFunnel(slug);
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
        <PixelScripts
          settings={funnel.settings ?? {}}
          utmifyPixelId={funnel.utmifyPixelId ?? null}
          hotmartAccountId={funnel.hotmartAccountId ?? null}
        />
      )}
      {funnel.settings?.engine === "typebot"
        ? <ChatRunner funnel={funnel} preview={isPreview} />
        : funnel.settings?.engine === "layers"
          ? <LayersRunner funnel={funnel} geo={geo} preview={isPreview} />
          : <QuizRunner funnel={funnel} preview={isPreview} geo={geo} />}
    </div>
  );
}
