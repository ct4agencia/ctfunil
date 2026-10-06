import type { Funnel } from "@/lib/quiz/types";

/**
 * Preload da imagem do 1º hero (funil layers). A imagem do hero costuma ser o
 * elemento LCP, mas como o funil renderiza no client, o browser só descobre a
 * imagem depois do JS (~1s). Emitindo um <link rel=preload> no SSR, o download
 * começa imediatamente (em paralelo ao bundle) → LCP mais rápido.
 *
 * React 19 (Next 16) içа o <link> pro <head> automaticamente.
 */
type PrimeiraLamina = {
  disabled?: boolean;
  design?: { backgroundImage?: { src?: string } };
  layers?: Array<{ content?: { image?: { src?: string } } }>;
};

export default function HeroPreload({ funnel }: { funnel: Funnel }) {
  if (funnel.settings?.engine !== "layers") return null;
  const steps = (funnel.steps as unknown as PrimeiraLamina[]) || [];
  const first = steps.find((s) => !s?.disabled) || steps[0];
  const ehUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v);

  // O FUNDO DA LÂMINA VEM PRIMEIRO — é ele que costuma ser o elemento LCP.
  //
  // Até 10/08/2026 este componente só olhava `layers[].content.image.src` e
  // devolvia `null` em 14 de 14 funis do motor layers: nenhum guarda a imagem
  // ali. O hero real mora em `design.backgroundImage.src`, renderizado como
  // <img> em LayersRunner.tsx:329. Resultado: o preload existia no código e
  // nunca chegou ao HTML, e a imagem que É o LCP baixava sem prioridade
  // nenhuma, disputando banda de igual para igual com todo o resto.
  let src: string | undefined = ehUrl(first?.design?.backgroundImage?.src)
    ? first!.design!.backgroundImage!.src
    : undefined;

  // fallback: bloco de imagem dentro da lâmina (caminho antigo, mantido para
  // não regredir funil que venha a usá-lo)
  if (!src) {
    for (const l of first?.layers || []) {
      if (ehUrl(l?.content?.image?.src)) { src = l.content!.image!.src; break; }
    }
  }
  if (!src) return null;

  // React iça o <link> para o <head> de qualquer ponto da árvore — comportamento
  // documentado em react.dev/reference/react-dom/components/link: "React will
  // always place the DOM element corresponding to the <link> component within
  // the document's <head>, regardless of where in the React tree it is
  // rendered". Por isso o preload sai no HTML do servidor e o preload scanner
  // do navegador o encontra antes de parsear o body.
  return <link rel="preload" as="image" href={src} fetchPriority="high" />;
}
