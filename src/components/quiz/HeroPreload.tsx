import type { Funnel } from "@/lib/quiz/types";

/**
 * Preload da imagem do 1º hero (funil layers). A imagem do hero costuma ser o
 * elemento LCP, mas como o funil renderiza no client, o browser só descobre a
 * imagem depois do JS (~1s). Emitindo um <link rel=preload> no SSR, o download
 * começa imediatamente (em paralelo ao bundle) → LCP mais rápido.
 *
 * React 19 (Next 16) içа o <link> pro <head> automaticamente.
 */
export default function HeroPreload({ funnel }: { funnel: Funnel }) {
  if (funnel.settings?.engine !== "layers") return null;
  const steps = (funnel.steps as unknown as Array<{ disabled?: boolean; layers?: Array<{ content?: { image?: { src?: string } } }> }>) || [];
  const first = steps.find((s) => !s?.disabled) || steps[0];
  let src: string | undefined;
  for (const l of first?.layers || []) {
    const im = l?.content?.image?.src;
    if (typeof im === "string" && /^https?:\/\//.test(im)) { src = im; break; }
  }
  if (!src) return null;
  return <link rel="preload" as="image" href={src} fetchPriority="high" />;
}
