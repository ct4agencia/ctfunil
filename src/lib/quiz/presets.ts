import type { Funnel, Step } from "./types";
import { newStep } from "./types";
import { clubeDasBolsas } from "./funnels/clube-das-bolsas";

/**
 * Modelos (presets) de funil. Cada novo funil nasce de um modelo — conceito
 * do inlead (CDB = um modelo, Zenlya = outro). Por enquanto: CDB + Em branco.
 */
export interface Preset {
  id: string;
  name: string;
  description: string;
  paletteId: string;
  build: () => Step[];
  /** modelo ainda não disponível (mostrado como [em construção]) */
  comingSoon?: boolean;
}

function clone<T>(v: T): T {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); }
}

export const PRESETS: Preset[] = [
  {
    id: "modelo-cdb",
    name: "Modelo CDB (Bolsas/inlead)",
    description: "Roleta → quiz → resultado 94% → oferta → captura → VSL",
    paletteId: "laranja-cdb",
    build: () => clone(clubeDasBolsas.steps),
  },
  {
    id: "imersao",
    name: "Imersão (estilo Zenlya)",
    description: "Experiência imersiva: trilha sonora + sons de clique/loading, design Zenlya completo até a VSL",
    paletteId: "roxo-zen",
    build: () => [
      newStep("name", "name"),
      newStep("confirm", "confirm"),
      { ...newStep("question", "q1"), question: "Qual sua maior dificuldade hoje?" } as Step,
      newStep("loading", "loading"),
      newStep("result", "result"),
      newStep("offer", "offer"),
      newStep("capture", "captura"),
      newStep("vsl", "vsl"),
    ],
  },
  {
    id: "velas",
    name: "Velas (vivadevelas)",
    description: "Repaginação vivadevelas: Poppins, pílulas âmbar, badge com glow, gauge + checklist até a VSL",
    paletteId: "ambar-velas",
    build: () => [
      { ...newStep("hero", "hero"), badge: "🎁", title: "Para receber o ==ACESSO GRATUITO==", subtitle: "Você só precisa passar por uma **pequena seleção** respondendo algumas perguntas rápidas.", cta: "Começar seleção →" } as Step,
      { ...newStep("name", "name"), emoji: "🕯️", title: "Como posso te chamar?", cta: "Continuar" } as Step,
      { ...newStep("confirm", "confirm"), emoji: "🔥", title: "Prazer, {nome}!", body: "Essas perguntas vão mostrar se o seu perfil se encaixa no ideal para receber o ==acesso gratuito== ao **Velas Lucrativas**." } as Step,
      { ...newStep("question", "q1"), question: "Você já fez ou vende velas hoje?", layout: "cards", options: [{ label: "Nunca fiz", emoji: "🌱" }, { label: "Faço por hobby", emoji: "🎨" }, { label: "Já vendo", emoji: "💰" }] } as Step,
      { ...newStep("slider", "q2"), question: "De 0 a 10, quanto você queria uma ==renda só sua==?", defaultValue: 9 } as Step,
      { ...newStep("loading", "loading"), title: "Analisando seu perfil de artesã…", bars: ["Conferindo suas respostas", "Calculando seu potencial", "Preparando seu acesso"] } as Step,
      { ...newStep("gauge", "gauge"), title: "Seu potencial com velas", subtitle: "Com base no seu perfil", verdict: "{valor}%", caption: "Acima da média — dá pra lucrar **R$6.000/mês** fazendo velas como estas." } as Step,
      { ...newStep("result", "result"), title: "Parabéns, {nome}! Você foi ==aprovada==.", subtitle: "Seu acesso gratuito está liberado." } as Step,
      { ...newStep("offer", "offer"), badge: "ACESSO GRATUITO", title: "Bem-vinda ao ==Velas Lucrativas==", body: "Aprenda a fazer e vender velas artesanais e lucrar pelo menos **R$6.000** todos os meses." } as Step,
      { ...newStep("capture", "captura"), title: "Falta só ==1 passo==", body: "Deixe seu WhatsApp para receber o acesso agora 👇" } as Step,
      newStep("vsl", "vsl"),
    ],
  },
  {
    id: "typebot",
    name: "Typebot (chat conversacional)",
    description: "Funil estilo chat (balões de conversa) — motor conversacional",
    paletteId: "azul-confianca",
    comingSoon: true,
    build: () => [newStep("hero", "hero")],
  },
  {
    id: "blank",
    name: "Em branco",
    description: "Comece do zero com o essencial",
    paletteId: "azul-confianca",
    build: () => [newStep("hero", "hero"), newStep("question", "q1"), newStep("capture", "captura"), newStep("vsl", "vsl")],
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Monta um Funnel novo a partir de um preset + nome/slug. */
export function funnelFromPreset(preset: Preset, name: string, slug: string): Funnel {
  return {
    slug,
    name,
    niche: "",
    logo: preset.id === "modelo-cdb" ? clubeDasBolsas.logo : undefined,
    paletteId: preset.paletteId,
    steps: preset.build(),
    font: preset.id === "velas" ? "poppins" : undefined,
    clickSound: preset.id === "imersao" || preset.id === "velas",
  };
}
