/**
 * Motor de funil de quiz gamificado — modelo de dados.
 *
 * Um Funnel é uma sequência ordenada de Steps (lâminas). Cada step tem um
 * `type` do catálogo e props específicas. O QuizRunner renderiza a máquina de
 * etapas; cada avanço grava em funnel_sessions/step_events (ver lib/quiz/track).
 *
 * Decisão de arquitetura (entrevista Luca, 2026-06): catálogo livre — cada
 * funil escolhe quais/quantas etapas e em que ordem. Resultado % é TEATRAL
 * (faixa alta sorteada). Mobile-first.
 */

export type StepType =
  | "roulette"
  | "scratch"
  | "measure"
  | "slider"
  | "hero"
  | "name"
  | "confirm"
  | "question"
  | "loading"
  | "gauge"
  | "result"
  | "offer"
  | "capture"
  | "post_capture"
  | "bridge"
  | "vsl";

export const STEP_LABELS: Record<StepType, string> = {
  roulette: "Roleta",
  scratch: "Raspadinha",
  measure: "Medida (número)",
  slider: "Slider (0–10)",
  hero: "Hero",
  name: "Captura de nome",
  confirm: "Confirmação",
  question: "Pergunta",
  loading: "Loading / transição",
  gauge: "Medidor / projeção",
  result: "Resultado",
  offer: "Oferta",
  capture: "Captura (lead)",
  post_capture: "Pós-captura",
  bridge: "Bridge",
  vsl: "VSL",
};

/** Paleta de cores de um funil (presets em lib/quiz/theme). */
export interface Palette {
  id: string;
  name: string;
  /** cor primária (CTA/realce) */
  primary: string;
  primaryDark: string;
  /** fundo da página */
  bg: string;
  bgSoft: string;
  /** fundo de cards */
  surface: string;
  text: string;
  textMuted: string;
  /** borda da opção selecionada */
  ring: string;
}

export interface QuizOption {
  label: string;
  emoji?: string;
  image?: string;
  value?: string;
}

interface BaseStep {
  /** identificador estável p/ tracking (step_events.step_id) */
  id: string;
  type: StepType;
}

export interface RouletteSegment {
  label: string;
  color: string;
  win?: boolean;
}

export interface RouletteSound {
  enabled: boolean;
  /** URLs/arquivos .mp3 opcionais; vazio = síntese via Web Audio (tique no giro + chime na vitória) */
  tickUrl?: string;
  winUrl?: string;
}

/** Estilo visual da roleta (paleta-adaptável). */
export type RouletteStyle = "soft" | "casino" | "neon" | "bulbs";

export const ROULETTE_STYLES: { id: RouletteStyle; name: string }[] = [
  { id: "soft", name: "Suave (pastel)" },
  { id: "casino", name: "Casino (dourado)" },
  { id: "neon", name: "Neon (escuro)" },
  { id: "bulbs", name: "Lâmpadas (vegas)" },
];

export interface RouletteStep extends BaseStep {
  type: "roulette";
  title: string;
  subtitle?: string;
  segments: RouletteSegment[];
  /** índice que SEMPRE vence (modo "sempre vence") */
  winningIndex: number;
  /** "always" = cai no winningIndex | "random" = sorteio (Fase B) */
  mode?: "always" | "random";
  centerImage?: string;
  cta: string;
  winTitle?: string;
  winBody?: string;
  winCta?: string;
  sound?: RouletteSound;
  style?: RouletteStyle;
  /** fundo full-screen personalizado (CSS, ex: linear-gradient(...)) */
  background?: string;
}

/** Raspadinha (scratch-card) — variante da roleta p/ revelar o prêmio. */
export interface ScratchStep extends BaseStep {
  type: "scratch";
  title: string;
  subtitle?: string;
  prize: string;
  prizeEmoji?: string;
  coverText?: string;
  coverColor?: string;
  cta?: string;
  winTitle?: string;
  winBody?: string;
  winCta: string;
  sound?: RouletteSound;
}

export interface HeroStep extends BaseStep {
  type: "hero";
  badge?: string;
  title: string;
  subtitle?: string;
  image?: string;
  gallery?: string[];
  cta: string;
  social?: string;
  time?: string;
}

export interface NameStep extends BaseStep {
  type: "name";
  emoji?: string;
  title: string;
  subtitle?: string;
  placeholder?: string;
  cta: string;
}

export interface ConfirmStep extends BaseStep {
  type: "confirm";
  emoji?: string;
  title: string;
  body?: string;
  seal?: string;
  cta: string;
}

export interface QuestionStep extends BaseStep {
  type: "question";
  question: string;
  help?: string;
  multi?: boolean;
  options: QuizOption[];
  image?: string;
  /** "list" (padrão) ou "cards" (grade de cards com imagem, estilo lip/gênero) */
  layout?: "list" | "cards";
  /** texto do botão (single auto-avança se ausente) */
  cta?: string;
  /** micro-loading + insight pós-resposta (estilo Zenlya) */
  loadingText?: string;
  insight?: string;
}

/** Medida — input numérico + toggle de unidade (estilo altura/peso lip.formula). */
export interface MeasureStep extends BaseStep {
  type: "measure";
  question: string;
  help?: string;
  units?: string[];
  suffix?: string;
  defaultValue?: number;
  cta: string;
}

/** Slider — barra arrastável (ex: 0–10, idade, nível de interesse). */
export interface SliderStep extends BaseStep {
  type: "slider";
  question: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  /** mostra a escala numérica abaixo */
  showScale?: boolean;
  suffix?: string;
  image?: string;
  cta: string;
}

/** Micro-pergunta exibida como modal durante o loading sofisticado. */
export interface LoadingCheckpoint {
  /** percentual (0–100) em que o loading pausa e abre o modal */
  at: number;
  question: string;
  options: string[];
}

export interface LoadingStep extends BaseStep {
  type: "loading";
  variant?: "light" | "dark";
  /** "simple" = pulso + slides | "checklist" = barras rotuladas estilo "Preparando seu plano" */
  style?: "simple" | "checklist";
  title?: string;
  /** logo opcional no topo */
  logo?: string;
  /** slides do carrossel; {nome} é interpolado */
  slides: string[];
  /** rótulos das barras sequenciais (modo checklist) */
  bars?: string[];
  /** micro-perguntas que pausam o loading (modo checklist) */
  checkpoints?: LoadingCheckpoint[];
  durationMs?: number;
}

/** Medidor/projeção — semicírculo com ponteiro teatral + zonas coloridas. */
export interface GaugeStep extends BaseStep {
  type: "gauge";
  title: string;
  subtitle?: string;
  /** "range" = sorteia ponteiro na faixa | "imc" = calcula de peso/altura coletados */
  mode?: "range" | "imc";
  /** faixa teatral [min,max] do ponteiro (escala min..max do medidor) */
  range?: [number, number];
  scaleMin?: number;
  scaleMax?: number;
  suffix?: string;
  /** zonas coloridas da esquerda→direita (ex: baixo/ideal/alto) */
  zones?: { label: string; color: string }[];
  /** veredito exibido sob o ponteiro ({valor} interpolado) */
  verdict?: string;
  caption?: string;
  cta: string;
}

export interface ResultStep extends BaseStep {
  type: "result";
  /** faixa teatral [min,max] — sorteia dentro */
  range: [number, number];
  /** "mínimo necessário" exibido (prova) */
  minShown?: number;
  title: string;
  subtitle?: string;
  body?: string;
  /** rótulo dentro do anel (ex: "COMPATÍVEL") */
  ringLabel?: string;
  /** card verde de aprovação (estilo vivadevelas) */
  approvedTitle?: string;
  approvedBody?: string;
  cta: string;
}

export interface OfferStep extends BaseStep {
  type: "offer";
  image?: string;
  badge?: string;
  /** selo verificado (azul) sobre a foto redonda */
  verified?: boolean;
  title: string;
  body?: string;
  /** caixas de prova social (ex: 5+ anos / 800+ alunas / 100k seguidoras) */
  stats?: { value: string; label: string }[];
  /** card escuro de "presente de boas-vindas" */
  giftTitle?: string;
  giftBody?: string;
  cta: string;
}

export interface CaptureStep extends BaseStep {
  type: "capture";
  title: string;
  body?: string;
  image?: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  cta: string;
  /** selo "GRÁTIS" sobre a imagem (ebook) */
  freeBadge?: string;
  /** nota destacada (ex: aviso do WhatsApp) acima do form */
  note?: string;
  /** linha de segurança abaixo do botão (ex: "🔒 Seus dados...") */
  secure?: string;
  /** casa com o webhook "Click em componente" (igual inlead) */
  componentId?: string;
}

export interface PostStep extends BaseStep {
  type: "post_capture";
  title: string;
  body?: string;
  /** card de aviso amarelo (ex: "🚨 Lembrando...") */
  warn?: string;
  /** card secundário (ex: "Ahhh, quase ia esquecendo...") */
  note?: string;
  cta: string;
}

export interface BridgeStep extends BaseStep {
  type: "bridge";
  title: string;
  body?: string;
  warn?: string;
  cta: string;
}

/** Barra de escassez/cabeçalho no topo da lâmina (estilo vsl-platform). */
export interface ScarcityBar {
  enabled?: boolean;
  text: string;
  bg?: string;
  color?: string;
  /** segundos do vídeo até aparecer (0 = sempre) */
  revealAt?: number;
}

export interface VslStep extends BaseStep {
  type: "vsl";
  title?: string;
  /** EMBED COMPLETO do player (cole o <script>+<iframe> do VTurb/converteai) */
  embedHtml?: string;
  /** player VTurb por ID (legado) */
  vturbPlayerId?: string;
  vturbAccountId?: string;
  checkoutUrl?: string;
  ctaText?: string;
  /** segundos até liberar o CTA (pitch) */
  pitchRevealAt?: number;
  /** barra de escassez/cabeçalho no topo */
  headerBar?: ScarcityBar;
  /** fundo full-screen personalizado (CSS, ex: linear-gradient(...)) */
  background?: string;
}

export type Step =
  | RouletteStep
  | ScratchStep
  | MeasureStep
  | SliderStep
  | HeroStep
  | NameStep
  | ConfirmStep
  | QuestionStep
  | LoadingStep
  | GaugeStep
  | ResultStep
  | OfferStep
  | CaptureStep
  | PostStep
  | BridgeStep
  | VslStep;

/** Pixel/scripts do funil — mesmo shape de VslSettings.pixels (reusa PixelScripts). */
export interface FunnelPixels {
  google_analytics_id?: string;
  gtm_id?: string;
  google_site_verification?: string;
  facebook_pixel_id?: string;
  utmify_google_pixel_id?: string;
  head_script?: string;
  body_script?: string;
  footer_script?: string;
}
export interface FunnelSettings {
  pixels?: FunnelPixels;
  seo?: {
    title?: string;
    description?: string;
    favicon?: string;
    ogImage?: string;
  };
}

/** Webhook do funil (inlead-compatível) — guardado em funnels.webhooks (jsonb). */
export interface FunnelWebhook {
  id: string;
  name?: string;
  api_url: string;
  token?: string;
  method: "POST" | "GET";
  content_type: "formData" | "json";
  trigger_event: "lead_capture" | "click_component";
  component_id?: string;
  enabled: boolean;
}

export interface Funnel {
  slug: string;
  name: string;
  niche?: string;
  logo?: string;
  paletteId: string;
  steps: Step[];
  /** tipografia de display: "serif" (Fraunces, padrão) ou "poppins" (vivadevelas) */
  font?: "serif" | "poppins";
  /** trilha sonora em loop durante o funil (URL .mp3) */
  music?: string;
  /** som de clique ao avançar entre lâminas (Imersão) */
  clickSound?: boolean;
  // ── Configurações (tracking/domínio) ──
  domain?: string;
  settings?: FunnelSettings;
  utmifyPixelId?: string;
  hotmartAccountId?: string;
  hotmartProductId?: string;
  checkoutUrl?: string;
  webhooks?: FunnelWebhook[];
}

/** Cria uma lâmina nova com defaults sensatos (id gerado pelo chamador). */
export function newStep(type: StepType, id: string): Step {
  switch (type) {
    case "roulette":
      return {
        id, type, title: "Gire a roleta e descubra seu prêmio.", subtitle: "",
        segments: [
          { label: "ACESSO GRÁTIS", color: "#e7c777", win: true },
          { label: "25% OFF", color: "#ef8a6a" },
          { label: "Não foi dessa vez", color: "#b3a3c6" },
          { label: "15% OFF", color: "#f4c69b" },
          { label: "Tente de novo", color: "#ece2d2" },
        ],
        winningIndex: 0, mode: "always", cta: "Girar",
        winTitle: "🎉 Você ganhou!", winBody: "", winCta: "Continuar →",
        sound: { enabled: true },
      };
    case "scratch":
      return {
        id, type, title: "Raspe e descubra seu prêmio!", subtitle: "Use o dedo para raspar.",
        prize: "50% OFF", prizeEmoji: "🎁", coverText: "RASPE AQUI", coverColor: "#b8b8b8",
        winTitle: "🎉 Você ganhou 50% OFF!", winBody: "", winCta: "Quero garantir agora →",
        sound: { enabled: true },
      };
    case "hero":
      return { id, type, badge: "", title: "Seu título aqui", subtitle: "", cta: "Começar" };
    case "name":
      return { id, type, emoji: "🌸", title: "Como posso te chamar?", subtitle: "", placeholder: "Ex: Maria", cta: "Continuar" };
    case "confirm":
      return { id, type, emoji: "💖", title: "Que prazer, {nome}!", body: "", cta: "Continuar →" };
    case "question":
      return { id, type, question: "Sua pergunta aqui?", options: [{ label: "Opção 1" }, { label: "Opção 2" }] };
    case "measure":
      return { id, type, question: "Qual o seu peso atual?", help: "Sua sinceridade é o primeiro passo.", units: ["KG", "LBS"], suffix: "kg", defaultValue: 70, cta: "Continuar" };
    case "slider":
      return { id, type, question: "De 0 a 10, quanto você queria ter uma renda só sua?", min: 0, max: 10, step: 1, defaultValue: 8, showScale: true, cta: "Continuar" };
    case "loading":
      return {
        id, type, variant: "light", style: "checklist", title: "Preparando seu resultado…",
        bars: ["Analisando suas respostas", "Calculando seu perfil", "Montando seu plano ideal"],
        checkpoints: [{ at: 55, question: "Antes de continuar: você quer começar ainda este mês?", options: ["Sim, com tudo!", "Quero entender melhor"] }],
        slides: ["Quase lá, {nome}…"],
      };
    case "gauge":
      return {
        id, type, title: "Seu potencial de resultado", subtitle: "Com base nas suas respostas",
        mode: "range", range: [78, 92], scaleMin: 0, scaleMax: 100, suffix: "%",
        zones: [
          { label: "Baixo", color: "#e2675a" },
          { label: "Médio", color: "#e7b84e" },
          { label: "Alto", color: "#43b97f" },
        ],
        verdict: "{valor}% de potencial", caption: "Você está acima da média — dá pra começar agora.", cta: "Ver meu plano →",
      };
    case "result":
      return { id, type, range: [88, 96], minShown: 80, title: "Parabéns!", subtitle: "", cta: "Continuar" };
    case "offer":
      return { id, type, title: "Oferta especial", body: "", cta: "Quero garantir" };
    case "capture":
      return {
        id, type, title: "Deixe seu contato 👇", body: "",
        nameLabel: "Seu nome", namePlaceholder: "Digite seu nome...",
        phoneLabel: "Seu WhatsApp", phonePlaceholder: "(00) 00000-0000",
        cta: "Quero receber", componentId: "captura",
      };
    case "post_capture":
      return { id, type, title: "Pronto!", body: "", cta: "Continuar" };
    case "bridge":
      return { id, type, title: "Assista o vídeo a seguir", body: "", warn: "", cta: "Continuar" };
    case "vsl":
      return { id, type, title: "Assista até o final 👇", ctaText: "QUERO GARANTIR", pitchRevealAt: 8 };
  }
}
