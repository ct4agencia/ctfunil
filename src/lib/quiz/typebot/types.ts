/**
 * Modelo de dados do funil "typebot" (chat conversacional). Espelha o Typebot
 * (groups → blocks → edges) mas simplificado: o destino (edge) vive em `to`
 * no grupo (próximo padrão), no item de escolha e no item de condição. Isso
 * elimina o array de edges e deixa o runtime/editor diretos.
 *
 * É um motor SEPARADO do quiz/layers — não mexe em nada do inlead.
 */

export type TbOp = "igual" | "diferente" | "contém" | "maior" | "menor";

interface Base {
  id: string;
}

/** Bolhas = mensagens do bot (lado esquerdo) + elementos visuais do WhatsApp. */
export type TbBubble =
  | (Base & { type: "text"; richText: string; reaction?: string })
  | (Base & { type: "image"; url: string })
  | (Base & { type: "audio"; url: string })
  | (Base & { type: "video"; url: string })
  | (Base & { type: "embed"; html: string })
  | (Base & { type: "date"; label?: string })
  | (Base & { type: "voice"; duration?: string; url?: string })
  | (Base & { type: "call"; mode: "voice" | "video"; status?: "missed" | "outgoing" | "incoming"; duration?: string })
  | (Base & { type: "system"; variant: "encrypted" | "deleted" | "disappearing" | "custom"; text?: string })
  | (Base & { type: "document"; name?: string; size?: string; url?: string })
  | (Base & { type: "link"; url: string; title?: string; desc?: string; image?: string })
  | (Base & { type: "location"; address?: string; image?: string })
  | (Base & { type: "contact"; name?: string; phone?: string; avatar?: string });

/** Inputs = pedem resposta do lead (param a conversa). */
export type TbInput =
  | (Base & { type: "input-text"; variable?: string; placeholder?: string; button?: string; long?: boolean })
  | (Base & { type: "input-number"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-email"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-phone"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-choice"; variable?: string; multiple?: boolean; items: TbChoiceItem[] })
  | (Base & { type: "input-date"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-time"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-url"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-rating"; variable?: string; max?: number; icon?: "star" | "heart" | "number"; button?: string })
  | (Base & { type: "input-picture"; variable?: string; items: TbChoiceItem[] })
  | (Base & { type: "input-cards"; items: TbCardItem[] })
  | (Base & { type: "input-file"; variable?: string; button?: string });

/** Lógica = operações de bastidor (invisíveis ao lead). */
export type TbLogic =
  | (Base & { type: "wait"; seconds: number })
  | (Base & { type: "set-variable"; variable: string; expression: string })
  | (Base & { type: "condition"; items: TbConditionItem[] })
  | (Base & { type: "redirect"; url: string; newTab?: boolean });

export interface TbChoiceItem { id: string; label: string; to?: string; image?: string }
export interface TbCardItem { id: string; title?: string; desc?: string; image?: string; button?: string; to?: string }
export interface TbConditionItem { id: string; variable: string; op: TbOp; value: string; to?: string }

export type TbBlock = TbBubble | TbInput | TbLogic;

export interface TbGroup {
  id: string;
  title: string;
  x: number;
  y: number;
  blocks: TbBlock[];
  /** próximo grupo (edge padrão) quando os blocos do grupo acabam */
  to?: string;
}

export interface TbTheme {
  bg: string;
  hostBubbleBg: string;
  hostBubbleColor: string;
  guestBubbleBg: string;
  guestBubbleColor: string;
  buttonBg: string;
  buttonColor: string;
  inputBg: string;
  inputColor: string;
  avatarUrl?: string;
  /** mostra o avatar do bot ao lado das bolhas */
  showAvatar?: boolean;
  font?: string;
  /** nome do contato no topo (estilo WhatsApp) */
  botName?: string;
  /** cor da barra de topo (WhatsApp) */
  headerColor?: string;
  // ── cosméticos do "celular" (estilo gerador de WhatsApp) ──
  device?: "ios" | "android";
  dark?: boolean;
  hideHeader?: boolean;
  online?: string;        // texto de status ("online", "visto por último…")
  statusTime?: string;    // relógio da barra de status (ex: "10:04")
  network?: string;       // "5G" | "4G" | "LTE" | "Wi-Fi"
  battery?: number;       // 0–100
  charging?: boolean;
  /** mostra o aviso de criptografia no topo da conversa */
  encryptionBanner?: boolean;
  /** imagem de fundo do chat (substitui o doodle padrão) — URL do upload do usuário */
  chatBgImage?: string;
  /** tamanho do texto das bolhas */
  textSize?: "small" | "default" | "large";
  /** esconde a barra de input (rodapé) quando não há pergunta ativa */
  hideFooter?: boolean;
  /** mostra o número da % de bateria na barra de status */
  showBatteryPct?: boolean;
  /** Dual SIM (2 grupos de sinal na barra de status) */
  dualSim?: boolean;
  /** ícone de silenciado no header */
  headerSilent?: boolean;
}

export interface TbFunnel {
  startGroup: string;
  groups: TbGroup[];
  variables: string[];
  theme: TbTheme;
  /** emulação de digitação: atraso antes de cada bolha */
  typing: { enabled: boolean; speed: number; maxDelay: number };
}

const BUBBLE_TYPES = ["text", "image", "audio", "video", "embed", "date", "voice", "call", "system", "document", "link", "location", "contact"];
/** Bolha / elemento visual (não pede resposta). */
export const isBubble = (b: TbBlock): b is TbBubble => BUBBLE_TYPES.includes(b.type);

/** Input (para a conversa esperando o lead). */
export const isInput = (b: TbBlock): b is TbInput => b.type.startsWith("input-");

export const TB_BLOCK_LABEL: Record<string, string> = {
  text: "Texto", image: "Imagem", audio: "Áudio", video: "Vídeo", embed: "Embed",
  date: "Separador de data", voice: "Nota de voz", call: "Chamada", system: "Aviso de sistema",
  document: "Documento", link: "Link (preview)", location: "Localização", contact: "Contato",
  "input-text": "Texto (resposta)", "input-number": "Número", "input-email": "E-mail",
  "input-phone": "Telefone/WhatsApp", "input-choice": "Botões",
  "input-date": "Data", "input-time": "Hora", "input-url": "Site/URL", "input-rating": "Avaliação",
  "input-picture": "Escolha por imagem", "input-cards": "Cards", "input-file": "Upload de arquivo",
  wait: "Esperar", "set-variable": "Definir variável", condition: "Condição", redirect: "Redirecionar",
};

export const TB_DEFAULT_THEME: TbTheme = {
  bg: "#efeae2",            // bege do WhatsApp
  hostBubbleBg: "#ffffff",  // recebido = branco (esquerda)
  hostBubbleColor: "#111b21",
  guestBubbleBg: "#e6ffda", // enviado = verde claro (direita) — medido do WhatsApp real
  guestBubbleColor: "#111b21",
  buttonBg: "#008069",      // verde WhatsApp
  buttonColor: "#ffffff",
  inputBg: "#ffffff",
  inputColor: "#111b21",
  showAvatar: true,
  font: "Poppins",
  headerColor: "#075e54",   // barra de topo WhatsApp
  device: "ios",
  dark: false,
  online: "online",
  statusTime: "10:04",
  network: "5G",
  battery: 80,
  charging: false,
  encryptionBanner: true,
};
