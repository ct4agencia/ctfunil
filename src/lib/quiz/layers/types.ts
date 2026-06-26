/**
 * Motor "layers" — clone fiel do page-builder do inlead (funis v2).
 *
 * Diferente do motor de lâminas tipadas (lib/quiz/types.ts), aqui cada lâmina
 * (InleadStep) é uma pilha livre de blocos (Layer). O conteúdo de texto é HTML
 * do Quill (com estilos inline) renderizado verbatim. Guardamos o funil quase
 * literal vindo do inlead; o LayersRunner só interpola variáveis ({estado},
 * {nome}…) e resolve a navegação por `destination`.
 */

export type LayerType =
  | "text" | "clear" | "options" | "image" | "button" | "alert"
  | "loading" | "field" | "timer" | "notification" | "graphics"
  | "embed" | "video" | "roulette" | "slider" | "carousel";

/** Imagem/emoji de uma opção ou bloco. */
export interface InleadMedia {
  type?: "image" | "emoji";
  src?: string | null;
  width?: number;
  height?: number;
}

export interface InleadOption {
  id: string;
  /** HTML (Quill) do rótulo */
  label: string;
  image?: InleadMedia;
  emoji?: string;
  /** id da lâmina destino ou "next" */
  destination?: string;
  value?: string;
}

export interface InleadGraphic {
  id: string;
  type: string;            // "chart"
  style?: string;          // cor (#16a34a)
  percent?: string | number;
  legend?: string;         // HTML
}

export interface InleadVariable { id: string; name: string; values: string[] }

/** content + design de um bloco. Campos variam por tipo (ver inventário). */
export interface Layer {
  id: string;
  type: LayerType;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design?: any;
  content: {
    id?: string;
    name?: string;
    // text / alert / label
    text?: string;
    // clear
    clear?: string;
    // button
    label?: string;
    destination?: string;
    type?: string;        // "next" | "phone" | "text" | "step" …
    pulse?: boolean;
    target?: boolean;
    // options
    options?: InleadOption[];
    cols?: string;
    multiple?: boolean;
    required?: boolean;
    awaitSubmit?: boolean;
    orientation?: string;
    // image
    image?: InleadMedia;
    // field
    title?: string;
    placeholder?: string;
    mask?: string;
    // loading
    description?: string;
    seconds?: number;
    starts?: number;
    show_title?: boolean;
    show_percent?: boolean;
    show_progress?: boolean;
    // timer
    time?: number;
    basedOn?: string;
    // notification
    position?: string;
    duration?: number;
    interval?: number;
    variables?: InleadVariable[];
    // graphics
    graphics?: InleadGraphic[];
    order?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  /** atraso (s) p/ revelar o bloco */
  effects?: { starts?: number };
}

export interface InleadStep {
  id: string;
  title: string;
  layers: Layer[];
  options?: { show_logo?: boolean; show_progress?: boolean; show_back?: boolean };
  design?: {
    backgroundColor?: string;
    backgroundImage?: InleadMedia;
    backgroundOpacity?: string | number;
  };
}

/** Tokens globais de design do funil inlead. */
export interface InleadDesign {
  logo?: InleadMedia;
  themeColor?: string;
  contentColor?: string;
  titleColor?: string;
  backgroundColor?: string;
  featuredFont?: string;
  contentFont?: string;
  titleSize?: number | string;
  contentSize?: number | string;
  rounded?: string;
  elementSize?: string;
  verticalAlign?: string;
  container?: string;
  logoSize?: string;
  gap?: string;
  header?: { layout?: string; progress?: string };
}
