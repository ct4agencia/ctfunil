/**
 * Tipos do domínio — espelham o schema em supabase/migrations/0001_init.sql.
 */

export type VslStatus = "draft" | "published";

/** Copy editável da VSL (coluna `content` jsonb). Todos os campos opcionais;
 *  o componente cai em defaults quando ausente. */
export interface VslContent {
  cta_text?: string; // texto do botão verde
  guarantee_headline?: string; // H2 da garantia
  guarantee_intro?: string; // frase em destaque do card
  guarantee_body?: string; // parágrafo "7 dias para assistir..."
  guarantee_chip?: string; // chip "Garantia de 7 dias — risco zero..."
  vagas_suffix?: string; // texto após o número ("PROMOCIONAIS JÁ FORAM...")
  copyright_name?: string; // nome no rodapé
  popup?: VslPopup; // popup de captura de lead
}

/** Popup de captura de lead (nome + telefone), revelado por tempo de vídeo. */
export type PopupAlign = "left" | "center" | "right";

export interface VslPopup {
  enabled?: boolean;
  reveal_at?: number; // segundos do vídeo
  title?: string;
  subtitle?: string;
  button?: string;
  button_id?: string; // ID/Name do componente (casa com o webhook "Click em componente")
  thank_you?: string; // mensagem pós-captura ("obrigado")
  thank_you_sticky?: boolean; // true = fica na tela; false = some após alguns segundos
  btn_pulse?: boolean; // efeito pulse no botão
  btn_shine?: boolean; // efeito reflexo no botão
  // Layout / aparência
  blur?: boolean; // true = sobrepõe a página com blur; false = abaixo do vídeo
  align?: PopupAlign; // alinhamento do conteúdo
  font_family?: string; // fonte
  font_size?: number; // tamanho base (px)
  bg_color?: string; // cor de fundo do card (vazio = usa tema)
  text_color?: string; // cor do texto
  accent_color?: string; // cor do botão (vazio = verde/tema)
  radius?: number; // arredondamento (px) — "formato"
}

/** Configurações da página (coluna `settings` jsonb): Pixel/Scripts + SEO. */
export interface VslSettings {
  pixels?: {
    google_analytics_id?: string;
    gtm_id?: string;
    google_site_verification?: string;
    facebook_pixel_id?: string;
    utmify_google_pixel_id?: string; // pixel Google da UTMify (window.googlePixelId)
    head_script?: string;
    body_script?: string;
    footer_script?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    favicon_url?: string;
    og_image_url?: string;
  };
}

/** Linha completa da tabela `vsls`. */
export interface Vsl {
  id: string;
  slug: string;
  name: string;
  niche: string | null;
  status: VslStatus;
  domain: string | null;

  checkout_url: string | null;
  hotmart_product_id: string | null;
  hotmart_src: string | null;

  vturb_player_id: string | null;
  vturb_account_id: string | null;

  pitch_reveal_at: number;
  vagas_reveal_at: number;

  vagas_inicial: number;
  vagas_limite: number;
  vagas_total: number;

  primary_color: string;
  cta_keep_green: boolean;

  content: VslContent;
  settings: VslSettings;
  blocks: Block[];

  img_garantia: string | null;
  img_pagamentos: string | null;
  img_selo: string | null;

  utmify_pixel_id: string | null;
  hotmart_account_id: string | null;

  created_at: string;
  updated_at: string;
}

/** Campos editáveis no formulário do admin (sem os gerenciados pelo banco). */
export type VslInput = Omit<Vsl, "id" | "created_at" | "updated_at">;

/** Defaults pra um novo produto (espelham os DEFAULT do SQL). */
export const DEFAULT_VSL: VslInput = {
  slug: "",
  name: "",
  niche: null,
  status: "draft",
  domain: null,
  checkout_url: null,
  hotmart_product_id: null,
  hotmart_src: null,
  vturb_player_id: null,
  vturb_account_id: null,
  pitch_reveal_at: 919,
  vagas_reveal_at: 891,
  vagas_inicial: 37,
  vagas_limite: 48,
  vagas_total: 50,
  primary_color: "#0284c7",
  cta_keep_green: true,
  content: {},
  settings: {},
  blocks: [],
  img_garantia: null,
  img_pagamentos: null,
  img_selo: null,
  utmify_pixel_id: null,
  hotmart_account_id: null,
};

// ── Blocos (page builder) ─────────────────────────────────────
export type BlockType =
  | "text"
  | "destaque"
  | "image"
  | "button"
  | "video"
  | "vagas"
  | "capture"
  | "spacer"
  | "html";

export interface Block {
  id: string;
  type: BlockType;
  enabled: boolean;
  props: Record<string, unknown>;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Texto",
  destaque: "Texto destaque",
  image: "Imagem",
  button: "Botão / CTA",
  video: "Vídeo",
  vagas: "Barra (escassez/cabeçalho)",
  capture: "Captura (WhatsApp)",
  spacer: "Espaçador",
  html: "HTML",
};

/** Props padrão por tipo de bloco. */
export const DEFAULT_BLOCK_PROPS: Record<BlockType, Record<string, unknown>> = {
  text: {
    content: "Seu texto aqui",
    fontSize: 16,
    color: "#ffffff",
    align: "center" as PopupAlign,
    weight: 600,
    maxWidth: 600,
  },
  destaque: {
    content: "TEXTO EM DESTAQUE",
    bgColor: "#F5C842", // cor de preenchimento (grifado)
    textColor: "#0a1428",
    fontSize: 16,
    weight: 800,
    align: "center" as PopupAlign,
    radius: 8,
    revealAfter: 0,
  },
  image: {
    url: "",
    maxWidth: 400,
    align: "center" as PopupAlign,
    radius: 12,
  },
  button: {
    label: "QUERO GARANTIR",
    linkType: "checkout" as "checkout" | "url",
    url: "",
    bgColor: "", // vazio = verde
    textColor: "#ffffff",
    align: "center" as PopupAlign,
    radius: 16,
    revealAfter: 0, // segundos do vídeo (0 = sempre visível)
    pulse: true,
    shine: true, // reflexo passando da esquerda p/ direita
    componentId: "",
  },
  video: {
    maxWidth: 400,
  },
  vagas: {
    mode: "escassez", // "escassez" (conta vagas) | "texto" (cabeçalho fixo)
    text: "🔥 OFERTA POR TEMPO LIMITADO",
    inicial: 37,
    limite: 48,
    total: 50,
    suffix: "PROMOCIONAIS JÁ FORAM GARANTIDAS...",
    intervalMs: 15000,
    bgColor: "", // vazio = gradiente do tema
    textColor: "", // vazio = tema
    numberColor: "", // vazio = dourado (gradiente)
    revealAfter: 0,
  },
  capture: {
    title: "Garanta sua vaga agora",
    subtitle: "Preencha para receber no WhatsApp.",
    buttonLabel: "QUERO RECEBER",
    buttonId: "captura",
    bgColor: "",
    textColor: "#ffffff",
    accentColor: "", // vazio = verde
    radius: 16,
    pulse: true,
    shine: true,
    thankYou: "✅ Pronto! Recebemos seus dados. Fique de olho no seu WhatsApp.",
    thankYouSticky: true, // true = fica na tela; false = some após alguns segundos
    revealAfter: 0,
  },
  spacer: {
    height: 32,
  },
  html: {
    code: "",
  },
};

/** Cria um novo bloco com props padrão (id gerado pelo chamador). */
export function newBlock(type: BlockType, id: string): Block {
  return {
    id,
    type,
    enabled: true,
    props: { ...DEFAULT_BLOCK_PROPS[type] },
  };
}

// ── Webhooks ──────────────────────────────────────────────────
export type WebhookMethod = "POST" | "GET";
export type WebhookContentType = "formData" | "json";
export type WebhookTrigger = "click_component" | "each_step" | "lead_capture";

export interface Webhook {
  id: string;
  vsl_id: string;
  name: string | null;
  api_url: string;
  token: string | null;
  method: WebhookMethod;
  content_type: WebhookContentType;
  trigger_event: WebhookTrigger;
  component_id: string | null;
  enabled: boolean;
  created_at: string;
}

export type WebhookInput = Omit<Webhook, "id" | "vsl_id" | "created_at">;

export const TRIGGER_LABELS: Record<WebhookTrigger, string> = {
  click_component: "Click em componente",
  each_step: "A cada etapa",
  lead_capture: "Captura de lead",
};

// ── Leads ─────────────────────────────────────────────────────
export interface Lead {
  id: string;
  vsl_id: string | null;
  code: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  src: string | null;
  xcod: string | null;
  fbclid: string | null;
  ctwa_clid: string | null;
  source_id: string | null;
  fbp: string | null;
  fbc: string | null;
  viewport: string | null;
  screen: string | null;
  platform: string | null;
  user_agent: string | null;
  created_at: string;
}

/** Defaults da copy (usados quando o campo não foi preenchido). */
export const DEFAULT_CONTENT: Required<VslContent> = {
  cta_text: "QUERO A VAGA COM DESCONTO",
  guarantee_headline: "FIQUE 100% SATISFEITA OU PEÇA SEU DINHEIRO DE VOLTA!",
  guarantee_intro:
    "CONFIO TANTO NA QUALIDADE DO PRODUTO QUE VOU TE DAR 7 DIAS PARA EXPERIMENTAR",
  guarantee_body: "Você terá 7 dias para assistir todas as aulas e bônus!",
  guarantee_chip: "Garantia de 7 dias — risco zero para você testar",
  vagas_suffix: "PROMOCIONAIS JÁ FORAM GARANTIDAS...",
  copyright_name: "Sua Marca®",
  popup: {},
};

/** Defaults do popup de captura. */
export const DEFAULT_POPUP: Required<VslPopup> = {
  enabled: false,
  reveal_at: 0,
  title: "Garanta sua vaga agora",
  subtitle: "Preencha para liberar seu acesso com desconto.",
  button: "QUERO GARANTIR",
  button_id: "captura",
  thank_you: "✅ Pronto! Recebemos seus dados. Fique de olho no seu WhatsApp.",
  thank_you_sticky: true,
  btn_pulse: true,
  btn_shine: true,
  blur: false, // padrão: abaixo do vídeo, sem cobrir
  align: "center",
  font_family: "Poppins",
  font_size: 15,
  bg_color: "", // vazio = gradiente do tema
  text_color: "#ffffff",
  accent_color: "", // vazio = verde/tema
  radius: 20,
};

export const POPUP_FONTS = [
  "Poppins",
  "Inter",
  "Arial",
  "Georgia",
  "system-ui",
] as const;
