import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import QuizRunner from "@/components/quiz/QuizRunner";
import PixelScripts from "@/components/vsl/PixelScripts";
import { resolveFunnel } from "@/lib/quiz/funnels-db";

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
  return { title: funnel ? funnel.name : "Quiz" };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = await resolveFunnel(slug);
  if (!funnel) notFound();

  const usePoppins = funnel.font === "poppins";
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
      <PixelScripts
        settings={funnel.settings ?? {}}
        utmifyPixelId={funnel.utmifyPixelId ?? null}
        hotmartAccountId={funnel.hotmartAccountId ?? null}
      />
      <QuizRunner funnel={funnel} />
    </div>
  );
}
