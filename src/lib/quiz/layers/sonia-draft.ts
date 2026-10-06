import type { Funnel } from "../types";
import type { InleadStep } from "./types";
import { SONIA_DEFAULTS } from "./sonia";

// Local-only template. NOT imported by seed/public registry. v1 user drafts stay untouched.
export const SONIA_DRAFT_KEY = "quizfunel:sonia:local-draft:v2";
export const SONIA_REDIRECT = "https://app.goredirect.com.br/fd61/selecione-seu-numero";
export function createSoniaDraft(): Funnel {
  return {
    slug: "sorteio-da-sonia-rascunho-local", name: "Sorteio da Sônia", paletteId: "default",
    settings: { engine: "layers", design: { backgroundColor: "#06152E", themeColor: "#D6AC54", contentColor: "#F7F2E8", container: "max-w-[26.25rem]", gap: "1.5", rounded: "rounded-2xl", elementSize: "56px" } },
    steps: [{
      id: "sonia-convite", title: "Convite",
      layers: [
        { id: "sonia-logo", type: "image", content: { image: { src: "/sorteio-da-sonia/logo-sorteio-da-sonia.png", width: 1918, height: 820 } }, design: { basis: 70 } },
        { id: "sonia-convite-texto", type: "text", content: { text: '<h1 class="ql-align-center" style="font-family:Georgia,serif;font-size:clamp(28px,7vw,36px);font-weight:600;line-height:1.2">hoje, às 18:00, vou selecionar 5 mulheres AO VIVO que vão receber uma MEGA surpresa</h1>' } },
        { id: "sonia-convite-instrucao", type: "text", content: { text: '<p class="ql-align-center" style="color:#B9C3D2;line-height:1.6">Pra poder ser uma das selecionadas, clique agora em “CONFIRMAR”! Boa sorte!!!</p>' }, design: { fontSize: 18 } },
        { id: "sonia-confirmar", type: "button", content: { label: "CONFIRMAR", type: "next", destination: "sonia-selecao" }, design: { backgroundColor: "#D6AC54", color: "#06152E", sombraChapada: true, effect: "sonia-pulse" } },
      ],
    }, {
      id: "sonia-selecao", title: "Seleção de números",
      layers: [{ id: "sonia-numeros", type: "sonia-numbers", content: { ...SONIA_DEFAULTS, destination: SONIA_REDIRECT } }],
    }] as unknown as InleadStep[] as unknown as Funnel["steps"],
  };
}
