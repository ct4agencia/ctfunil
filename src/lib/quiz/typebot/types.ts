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

/** Bolhas = mensagens do bot (lado esquerdo). */
export type TbBubble =
  | (Base & { type: "text"; richText: string })
  | (Base & { type: "image"; url: string })
  | (Base & { type: "audio"; url: string })
  | (Base & { type: "video"; url: string })
  | (Base & { type: "embed"; html: string });

/** Inputs = pedem resposta do lead (param a conversa). */
export type TbInput =
  | (Base & { type: "input-text"; variable?: string; placeholder?: string; button?: string; long?: boolean })
  | (Base & { type: "input-number"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-email"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-phone"; variable?: string; placeholder?: string; button?: string })
  | (Base & { type: "input-choice"; variable?: string; multiple?: boolean; items: TbChoiceItem[] });

/** Lógica = operações de bastidor (invisíveis ao lead). */
export type TbLogic =
  | (Base & { type: "wait"; seconds: number })
  | (Base & { type: "set-variable"; variable: string; expression: string })
  | (Base & { type: "condition"; items: TbConditionItem[] })
  | (Base & { type: "redirect"; url: string; newTab?: boolean });

export interface TbChoiceItem { id: string; label: string; to?: string }
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
}

export interface TbFunnel {
  startGroup: string;
  groups: TbGroup[];
  variables: string[];
  theme: TbTheme;
  /** emulação de digitação: atraso antes de cada bolha */
  typing: { enabled: boolean; speed: number; maxDelay: number };
}

/** Bolha (mensagem do bot, não pede resposta). */
export const isBubble = (b: TbBlock): b is TbBubble =>
  b.type === "text" || b.type === "image" || b.type === "audio" || b.type === "video" || b.type === "embed";

/** Input (para a conversa esperando o lead). */
export const isInput = (b: TbBlock): b is TbInput => b.type.startsWith("input-");

export const TB_BLOCK_LABEL: Record<string, string> = {
  text: "Texto", image: "Imagem", audio: "Áudio", video: "Vídeo", embed: "Embed",
  "input-text": "Texto (resposta)", "input-number": "Número", "input-email": "E-mail",
  "input-phone": "Telefone/WhatsApp", "input-choice": "Botões",
  wait: "Esperar", "set-variable": "Definir variável", condition: "Condição", redirect: "Redirecionar",
};

export const TB_DEFAULT_THEME: TbTheme = {
  bg: "#efeae2",            // bege do WhatsApp
  hostBubbleBg: "#ffffff",  // recebido = branco (esquerda)
  hostBubbleColor: "#111b21",
  guestBubbleBg: "#d9fdd3", // enviado = verde claro (direita)
  guestBubbleColor: "#111b21",
  buttonBg: "#008069",      // verde WhatsApp
  buttonColor: "#ffffff",
  inputBg: "#ffffff",
  inputColor: "#111b21",
  showAvatar: true,
  font: "Poppins",
  headerColor: "#075e54",   // barra de topo WhatsApp
};
