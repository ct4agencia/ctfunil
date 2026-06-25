import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import QuizRunner from "@/components/quiz/QuizRunner";
import PixelScripts from "@/components/vsl/PixelScripts";
import { resolveFunnelByDomain } from "@/lib/quiz/funnels-db";
import { leadGeo } from "@/lib/quiz/geo";

const display = Fraunces({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-display" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-q" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-poppins" });

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().split(":")[0].replace(/^www\./, "");
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || !host) return {};
  const funnel = await resolveFunnelByDomain(host);
  if (!funnel) return {};
  const seo = funnel.settings?.seo ?? {};
  return {
    title: seo.title || funnel.name,
    description: seo.description,
    icons: seo.favicon ? { icon: seo.favicon } : undefined,
    openGraph: { title: seo.title || funnel.name, description: seo.description, images: seo.ogImage ? [seo.ogImage] : undefined },
  };
}

/**
 * Raiz multi-domínio do CTFUNNEL.
 *  - host = domínio próprio cadastrado num funil → renderiza esse funil
 *    (o quiz "mora" no domínio comprado, ex: viverdebolsas.com.br).
 *  - domínio da plataforma / *.vercel.app / localhost → vai pro painel.
 */
export default async function Home() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().split(":")[0].replace(/^www\./, "");

  const isPlatform =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");

  if (!isPlatform && host) {
    const funnel = await resolveFunnelByDomain(host);
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
          <PixelScripts
            settings={funnel.settings ?? {}}
            utmifyPixelId={funnel.utmifyPixelId ?? null}
            hotmartAccountId={funnel.hotmartAccountId ?? null}
          />
          <QuizRunner funnel={funnel} geo={geo} />
        </div>
      );
    }
  }

  redirect("/dashboard");
}
