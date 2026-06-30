import type { Funnel, Step } from "./types";
import { newStep } from "./types";
import { clubeDasBolsas } from "./funnels/clube-das-bolsas";
import { clubeDasBolsasTypebot } from "./typebot/clube-das-bolsas";
import { cdbWhatsappTypebot } from "./typebot/cdb-whatsapp";
import type { TbFunnel } from "./typebot/types";

// Fotos + logo reais do inlead.digital/cdb01 (mesmo CDN do seed Clube das Bolsas)
const CDB_CDN = "https://media.inlead.cloud/uploads/17937";
const CDB_LOGO = `${CDB_CDN}/2026-04-08/md-jzx89-logo-cdb.png`;
const CDB_GALLERY = [
  `${CDB_CDN}/2026-01-14/md-RCBzs-mac-10.png`,
  `${CDB_CDN}/2026-01-14/md-c5HT4-mac-9.png`,
  `${CDB_CDN}/2026-01-14/md-tP27T-mac-11.png`,
];
const CDB_SONIA = `${CDB_CDN}/2025-10-01/md-FWlAd-logo-55.png`;
const CDB_APOSTILA = `${CDB_CDN}/2026-03-19/md-Vw2vD-1d8ebb39-c0ea-4334-a40b-8600e8750876.png`;

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
  /** motor do funil — ausente = quiz/layers; "typebot" = chat conversacional */
  engine?: "typebot";
  /** monta o funil typebot (quando engine="typebot") */
  buildTypebot?: () => TbFunnel;
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
    description: "Experiência imersiva: trilha sonora + sons + design Zenlya completo até a VSL",
    paletteId: "roxo-zen",
    comingSoon: true,
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
    // Estrutura de lâminas do vivadevelas (Poppins/âmbar/pílulas/glow/medidor)
    // com a COPY + FOTOS reais do inlead.digital/cdb01 (Clube das Bolsas).
    id: "inlead",
    name: "Modelo Inlead (bolsas)",
    description: "Estrutura vivadevelas (Poppins, pílulas âmbar, badge glow, medidor) com a copy + fotos do inlead cdb01",
    paletteId: "ambar-velas",
    build: () => [
      { ...newStep("hero", "hero"), badge: "🎁", title: "Sua ==Bolsa de Estudos de 6 meses== está a poucos passos", subtitle: "O melhor treinamento do Brasil para ganhar **R$5 mil por mês** com bolsas artesanais. Passe por uma pequena seleção respondendo algumas perguntas rápidas.", gallery: CDB_GALLERY, cta: "Quero liberar minha Bolsa de Estudos" } as Step,
      { ...newStep("name", "name"), emoji: "👛", title: "Como posso te chamar?", subtitle: "Vou personalizar sua seleção.", cta: "Continuar" } as Step,
      { ...newStep("confirm", "confirm"), emoji: "🧡", title: "Que prazer, {nome}!", body: "Essas perguntas vão mostrar se o seu perfil se encaixa no ideal pra receber o ==acesso gratuito== no **Clube das Bolsas**." } as Step,
      { ...newStep("question", "q-idade"), question: "Quantos anos você tem, {nome}?", help: "É pra te colocar no grupo certo de mulheres da sua faixa etária.", options: [{ label: "18 a 34 anos" }, { label: "34 a 54 anos" }, { label: "54 a 64 anos" }, { label: "+65 anos" }] } as Step,
      { ...newStep("question", "q-regiao"), question: "Em qual região do Brasil você mora?", help: "Para te encaixar no grupo da sua região, se ainda houver vagas.", options: [{ label: "Norte", emoji: "🌴" }, { label: "Nordeste", emoji: "🌞" }, { label: "Centro-Oeste", emoji: "🌾" }, { label: "Sudeste", emoji: "🏙️" }, { label: "Sul", emoji: "❄️" }] } as Step,
      { ...newStep("question", "q-situacao"), question: "Em qual dessas situações você se vê hoje?", options: [{ label: "Trabalhando muito e ganhando pouco", emoji: "😪" }, { label: "Sem uma profissão definida", emoji: "😖" }, { label: "Buscando liberdade e renda extra", emoji: "🤑" }, { label: "Insatisfeita e querendo mudança", emoji: "😔" }] } as Step,
      { ...newStep("question", "q-experiencia"), question: "Qual seu nível com bolsas artesanais?", layout: "cards", options: [{ label: "Nunca fiz", emoji: "🌸" }, { label: "Sou iniciante", emoji: "💫" }, { label: "Já tenho experiência", emoji: "🌹" }] } as Step,
      { ...newStep("question", "q-motivacao"), question: "Se você ganhasse ==R$5.000 por mês== com bolsas, qual seria a 1ª coisa que faria?", options: [{ label: "Sair do meu emprego atual", emoji: "🏃" }, { label: "Abrir meu próprio ateliê", emoji: "🏠" }, { label: "Ajudar minha família", emoji: "❤️" }, { label: "Realizar um sonho antigo", emoji: "🌟" }] } as Step,
      { ...newStep("slider", "q-desejo"), question: "De 0 a 10, quanto você queria ter uma ==renda só sua==?", defaultValue: 9 } as Step,
      { ...newStep("question", "q-apoio"), question: "Durante o curso, você teria alguém pra te apoiar (emocional ou financeiramente)?", options: [{ label: "Sim, com certeza", emoji: "😍" }, { label: "Talvez", emoji: "🧐" }, { label: "Não", emoji: "😕" }] } as Step,
      { ...newStep("loading", "loading"), logo: CDB_LOGO, title: "Cruzando seu perfil com as vagas…", bars: ["Carregando suas respostas", "Cruzando com as vagas disponíveis", "Preparando seu resultado"], slides: ["Espere só um instante, {nome}…"], checkpoints: [{ at: 60, question: "{nome}, você quer começar ainda este mês?", options: ["Sim, com tudo! 🔥", "Quero entender melhor"] }] } as Step,
      { ...newStep("gauge", "gauge"), title: "Sua compatibilidade com o perfil ideal", subtitle: "Com base nas suas respostas", range: [94, 94], verdict: "{valor}%", caption: "O mínimo necessário era **87%** — e você foi ==muito além==." } as Step,
      { ...newStep("result", "result"), range: [94, 94], minShown: 87, title: "Uau, {nome}! 😱", subtitle: "Você tem tudo que a gente procura!", body: "Você atingiu a compatibilidade com o perfil ideal pra receber a ==Bolsa de Estudos de 6 meses== no Clube das Bolsas! 🎉", cta: "Quero ativar minha Bolsa de Estudos" } as Step,
      { ...newStep("offer", "offer"), image: CDB_SONIA, badge: "Bolsa garantida ✅", title: "Prazer, eu me chamo ==Sônia== 🧡", body: "Sua Bolsa de Estudos de 6 meses está garantida! Sou professora de Bolsas há mais de 5 anos, já formei **+800 alunas** e compartilho minha rotina pra +100 mil seguidoras.\n\nE pra começar do jeito certo, separei um presente de boas-vindas que você vai AMAR!", cta: "QUERO O PRESENTE" } as Step,
      { ...newStep("capture", "captura"), title: "Deixe seu ==WhatsApp== pra receber a apostila 👇", body: "Vou te mandar uma Apostila SUPER COMPLETA de como fazer Bolsas de celular em Crochê. Confere o número certinho, tá bom? 🙏", image: CDB_APOSTILA, nameLabel: "Como você gostaria que eu te chamasse?", phoneLabel: "Seu WhatsApp pra eu enviar a apostila de graça:", phonePlaceholder: "Digite seu Whatsapp com DDD", cta: "Quero receber o presente no meu Whatsapp" } as Step,
      { ...newStep("post_capture", "pos-captura"), title: "Pronto, {nome}!", body: "Vou anotar seu contato e em alguns minutos te mando uma mensagem no Whatsapp.\n\n🚨 Só consigo te mandar a apostila se você responder a mensagem.\n\nAgora, vamos ativar sua bolsa de estudos! ⬇️", cta: "Quero ativar a Bolsa de Estudos" } as Step,
      { ...newStep("bridge", "bridge"), title: "Assista o vídeo que explica ==tudo== que você vai aprender", body: "Ele mostra, passo a passo, como ativar a bolsa de estudos de 6 meses que você conquistou.", warn: "Para não perder sua bolsa, é obrigatório ver ATÉ O FINAL o vídeo da próxima página.", cta: "Quero ativar minha Bolsa de Estudos" } as Step,
      { ...newStep("vsl", "vsl"), title: "Veja como ativar sua Bolsa de Estudos 👇", checkoutUrl: "https://clubedasbolsas3.com.br/cdb01/", ctaText: "QUERO ATIVAR MINHA BOLSA AGORA", pitchRevealAt: 8 } as Step,
    ],
  },
  {
    id: "typebot-cdb",
    name: "💬 Typebot — Clube das Bolsas",
    description: "Funil conversacional em chat (estilo Typebot): abertura → captura WhatsApp → quiz → resultado 94% → VSL",
    paletteId: "laranja-cdb",
    engine: "typebot",
    build: () => [],
    buildTypebot: () => clubeDasBolsasTypebot(),
  },
  {
    id: "typebot-cdb-wpp",
    name: "💬 Typebot — CDB [BOLSAS] WhatsApp",
    description: "Chat WhatsApp 1:1 do Doc: abertura + áudio → quiz 11 perguntas → resultado 94% → apresentação Sônia (áudio) → captura → VSL",
    paletteId: "laranja-cdb",
    engine: "typebot",
    build: () => [],
    buildTypebot: () => cdbWhatsappTypebot(),
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
  // Funil typebot (chat): guarda os dados em settings.typebot + engine="typebot".
  if (preset.engine === "typebot" && preset.buildTypebot) {
    return {
      slug, name, niche: "",
      paletteId: preset.paletteId,
      steps: [],
      font: "poppins",
      settings: { engine: "typebot", typebot: preset.buildTypebot() },
    };
  }
  return {
    slug,
    name,
    niche: "",
    logo: preset.id === "modelo-cdb" || preset.id === "inlead" ? clubeDasBolsas.logo : undefined,
    paletteId: preset.paletteId,
    steps: preset.build(),
    font: preset.id === "inlead" ? "poppins" : undefined,
    clickSound: preset.id === "imersao" || preset.id === "inlead",
  };
}
