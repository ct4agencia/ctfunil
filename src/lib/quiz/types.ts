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

/** Aparência do TÍTULO da lâmina (WYSIWYG fase 2, estilo inlead "Aparência"). */
export interface StepAppearance {
  align?: "left" | "center" | "right";
  /** tamanho do título em px (padrão ~26) */
  titleSize?: number;
  /** peso do título (400–900) */
  titleWeight?: number;
  /** cor do título (override) */
  titleColor?: string;
}

interface BaseStep {
  /** identificador estável p/ tracking (step_events.step_id) */
  id: string;
  type: StepType;
  /** aparência do título da lâmina */
  appearance?: StepAppearance;
}

export interface RouletteSegment {
  label: string;
  color: string;
  win?: boolean;
  /**
   * Arte DENTRO da fatia — a logo do prêmio, no lugar do texto.
   *
   * É por fatia, não da lâmina: `centerImage` sempre foi a imagem do MIOLO da
   * roda, e usá-la como logo de fatia (o que o porte da v3 fez no começo) dava
   * dois significados ao mesmo campo — trocar de motor movia a arte do centro
   * para a borda sem ninguém pedir.
   *
   * `imagemTamanho` é a largura em px do desenho de 600px (padrão 165, a medida
   * do arquivo v3). `imagemRotacao` gira só a arte, em graus: 0 a deixa em pé
   * quando a fatia está sob o ponteiro.
   */
  imagem?: string;
  imagemTamanho?: number;
  imagemRotacao?: number;
  /**
   * Giro do TEXTO desta fatia, em graus — o mesmo controle que a arte tem.
   * Só o motor v3 desenha isso; nos outros o rótulo segue o eixo da fatia.
   */
  labelRotacao?: number;
  /** emoji do popup deste prêmio; sem valor, o popup usa 🎉 */
  emoji?: string;
  /**
   * Tamanho do texto DESTA fatia. Sem valor, usa o `labelSize` da lâmina; sem
   * ele, 11. Existe porque prêmio de nome longo divide a roda com prêmios
   * curtos: um tamanho único obriga a encolher todos por causa de um.
   */
  labelSize?: number;
  /** copy do popup SÓ deste prêmio; sem valor, cai no winTitle/winBody da lâmina.
   *  Espelha a raspadinha (`premio.popupTitle || step.winTitle`) e só faz
   *  diferença no modo "random" — no "always" existe um vencedor só. */
  popupTitle?: string;
  popupBody?: string;
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

/**
 * Motor de animação da roleta.
 *
 * `classica` é o que todos os funis usam hoje: a roda anima por uma curva de
 * easing de 4,2 s e o som é agendado à parte (30 tiques numa curva própria).
 *
 * `interativa` simula a roda quadro a quadro — o som nasce da passagem real do
 * pino pelo ponteiro, o ponteiro tem peso, e o fim tem recuo (backdrag) e
 * hesitação sobre o pino. Em ambos o prêmio continua sendo decidido pelo
 * sorteio, nunca pela física.
 *
 * AUSENTE = `classica`. É isso que mantém intacto todo funil já publicado.
 */
export type RouletteEngine = "classica" | "interativa" | "fisica3";

export const ROULETTE_ENGINES: { id: RouletteEngine; name: string; hint: string }[] = [
  { id: "classica", name: "Roleta padrão", hint: "A de sempre. Giro suave, som sincronizado por tempo." },
  { id: "interativa", name: "Roleta interativa", hint: "Física real: o pino segura, a roda recua e o som acompanha o giro." },
  { id: "fisica3", name: "Roleta v3 (quase não passa)", hint: "O pino vira um morro de energia e VOCÊ decide se a roda tem força para vencê-lo — o suspense sai igual em todo giro." },
];

export interface RouletteStep extends BaseStep {
  type: "roulette";
  title: string;
  subtitle?: string;
  /** motor de animação; ausente = `classica` (comportamento de sempre) */
  engine?: RouletteEngine;
  /**
   * Só para `fisica3`. O pino é um morro de energia; estes dois dizem quanta
   * força a roda leva para enfrentá-lo.
   *
   * `quasePassa: true`  → encosta, hesita e PASSA (cai no prêmio)
   * `quasePassa: false` → encosta, hesita e VOLTA (fica no prêmio anterior)
   *
   * `hesitacao` (−10..+10) aproxima a razão de energia de 1 nos dois sentidos:
   * quanto mais perto, mais tempo a roda morre em cima do pino antes de
   * decidir. É o botão do drama — o resto continua sendo física de verdade.
   */
  quasePassa?: boolean;
  hesitacao?: number;
  /** só para `interativa`: nome do preset de movimento (ex.: "Suspense") */
  preset?: string;
  /** só para `interativa`: intensidade do preset, de -10 a +10 (0 = puro) */
  intensidade?: number;
  /**
   * só para `preset === "Personalizado"`: os valores crus do movimento.
   * Ignorado nos demais presets, que derivam tudo de nome + intensidade — sem
   * este campo, "Personalizado" não teria onde guardar o que foi ajustado.
   */
  paramsRoleta?: {
    voltas: number; duracaoAlvo: number; limiarCatraca: number; pedagio: number;
    rigidez: number; amortecimento: number; overshoot: number; pegHang: boolean;
  };
  segments: RouletteSegment[];
  /**
   * Tamanho do texto DENTRO das fatias, em px do viewBox da roda (padrão 11).
   * Vale para os dois motores. Prêmio de nome longo cabia mal e não havia como
   * ajustar sem mexer no código.
   */
  labelSize?: number;
  /** índice que SEMPRE vence (modo "sempre vence") */
  winningIndex: number;
  /** "always" = cai no winningIndex | "random" = sorteio (Fase B) */
  mode?: "always" | "random";
  /** Índice exibido no primeiro giro, antes da segunda chance premiada. */
  retryIndex?: number;
  /** Texto do botão que libera o segundo giro. */
  retryCta?: string;
  /** Link direto do botão exibido no popup de prêmio. */
  winCtaUrl?: string;
  centerImage?: string;
  cta: string;
  /**
   * Cor do botão de girar. Sem valor, segue a paleta do funil.
   *
   * Mora aqui e não num bloco solto porque este botão É o mecanismo: dispara o
   * giro, desabilita durante ele e troca o próprio texto. Um bloco genérico não
   * teria fio até isso, e quebraria se fosse arrastado para outra lâmina.
   */
  ctaCor?: string;
  winTitle?: string;
  winBody?: string;
  winCta?: string;
  sound?: RouletteSound;
  style?: RouletteStyle;
  /** fundo full-screen personalizado (CSS, ex: linear-gradient(...)) */
  background?: string;
  /** índice da fatia exibida ANTES de girar (ex: começar em "15% OFF") */
  initialIndex?: number;
  /** após vencer, avança sozinho (sem 2º clique) */
  autoAdvance?: boolean;
  /** ms até auto-avançar depois da vitória (padrão 2600) */
  autoAdvanceMs?: number;
  /** botão logo abaixo da roleta (não no rodapé sticky) */
  ctaBelow?: boolean;
  /** trava anti-repeat: se já girou e ganhou, não gira de novo por 24h (localStorage);
   *  o prêmio fica fixado mesmo no reload. Opcional por funil (A/B). */
  lockReplay?: boolean;
  /**
   * Popup de prêmio ao fim do giro — o mesmo liga/desliga que a raspadinha tem.
   * AUSENTE = desligado: as roletas que já rodam continuam só com confete e som.
   *
   * Diferente do da raspadinha em um ponto de propósito: lá a faixa fica no topo
   * e é informativa (a grade de cards precisa continuar visível). Aqui ele é
   * central e TEM botão, porque na roleta o giro já acabou — não há nada atrás
   * para o visitante olhar, e o clique dele é o próximo passo do funil.
   */
  popupEnabled?: boolean;
  /** cores do popup; sem valor, herdam a paleta do funil */
  popupBg?: string;
  popupText?: string;
  popupBtnBg?: string;
  /** arte dentro do popup de prêmio (a capa do que a pessoa acabou de ganhar) */
  popupImagem?: string;
  /**
   * Ordem das peças do MIOLO do popup. O emoji fica sempre no topo e o botão
   * sempre no fim — são a moldura; o que se reordena é o que está no meio.
   *
   * Ausente = `["imagem", "texto"]`, a arte acima da copy. Guardado como lista e
   * não como um "imagem embaixo?" porque a lista é o que a tela percorre e o
   * que o arraste do painel reordena: um booleano precisaria ser traduzido nas
   * duas pontas, e é aí que elas se desencontram.
   */
  popupOrdem?: ("imagem" | "texto")[];
}

/** Um card da grade de raspadinha. Espelha o painel de prêmios da roleta:
 *  copy + cor + PESO (100 = viciado, sempre cai nele; 0 = nunca) + popup próprio. */
export interface ScratchCard {
  /** copy revelada ao raspar (ex.: "50% OFF 🔥") */
  label: string;
  /** cor da capa DESTE card; sem valor, usa coverColor da lâmina */
  color?: string;
  /** peso do sorteio. 100 = sempre cai neste; 0 = nunca. Normalizado na hora. */
  weight?: number;
  /** popup de premiação DESTE prêmio (cada card tem o seu, igual à roleta) */
  popupTitle?: string;
  popupBody?: string;
  /** link de resgate específico deste prêmio (sobrepõe o ctaUrl da lâmina) */
  redeemUrl?: string;
  emoji?: string;
}

/** Raspadinha (scratch-card) — variante da roleta p/ revelar o prêmio.
 *  Grade de N cards: a lead raspa UM, vê o popup e os demais se revelam. */
export interface ScratchStep extends BaseStep {
  type: "scratch";
  title: string;
  subtitle?: string;
  /** Grade de cards. Ausente = lâmina legada de 1 card (usa prize/prizeEmoji). */
  cards?: ScratchCard[];
  /** colunas da grade no mobile (padrão 2) */
  columns?: number;
  /** % da capa que precisa ser raspada pra revelar (padrão 25) */
  revealPct?: number;
  /** trava 1 raspagem por dispositivo (localStorage), igual lockReplay da roleta */
  oncePerDevice?: boolean;
  /** destino do botão final (WhatsApp). Vazio = avança a lâmina. */
  ctaUrl?: string;
  /** cores do popup de premiação */
  popupBg?: string;
  popupText?: string;
  popupBtnBg?: string;
  /** cor do card do prêmio GANHO quando revela (vazio = usa a cor do próprio card) */
  destaqueBg?: string;
  destaqueText?: string;
  /** legado (lâmina de 1 card) — mantido pra não quebrar funis já salvos */
  prize?: string;
  prizeEmoji?: string;
  coverText?: string;
  coverColor?: string;
  /** capa: cor sólida ou degradê entre coverColor e coverColor2 (padrão: sólida) */
  coverStyle?: "solid" | "gradient";
  /** 2ª cor do degradê da capa (só usada quando coverStyle = "gradient") */
  coverColor2?: string;
  /** cor do texto "RASPE AQUI" na capa */
  coverTextColor?: string;
  /** tamanho em px do texto da capa (padrão 15). O texto quebra linha sozinho. */
  coverTextSize?: number;
  /** escurecimento (0-100) da tela ao revelar; o prêmio e o botão ficam acima */
  escurecimento?: number;
  /** fundo full-screen da lâmina: cor, gradiente (linear/radial) ou url(imagem) */
  background?: string;
  /** como a imagem de fundo se encaixa (padrão cover) */
  bgSize?: "cover" | "contain" | "auto";
  /** ancoragem da imagem de fundo (padrão "center") */
  bgPosition?: string;
  /** espaço em px no topo do conteúdo — desce texto/cards/botão pra não cobrir
   *  a arte do fundo (ex.: logo no topo de uma imagem 16:9 exibida em 9:16) */
  topSpacing?: number;
  /** sombra atrás do título/subtítulo, pra ler sobre fundo com imagem */
  titleShadow?: boolean;
  /** liga/desliga o painel de premiação (quando off, só o card em destaque) */
  popupEnabled?: boolean;
  /** opacidade (0-100) dos cards NÃO premiados depois da revelação (padrão 45) */
  perdedoresOpacidade?: number;
  /** confete ao revelar o prêmio (padrão: ligado) */
  confete?: boolean;
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
  /** tamanho das fotos do carrossel em px (padrão 96) */
  gallerySize?: number;
  /** duração do loop do carrossel em segundos (menor = mais rápido; padrão 20) */
  gallerySpeed?: number;
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
  /**
   * Medidor opcional acima do texto (estilo velocímetro). Sem `gaugeValue` a
   * lâmina fica exatamente como sempre foi — é o que mantém os funis atuais
   * inalterados. `gaugeZones[].upTo` é o valor onde a faixa termina, na escala
   * 0..gaugeMax; sem ele as faixas se dividem em fatias iguais.
   */
  gaugeValue?: number;
  gaugeMax?: number;
  gaugeLabel?: string;
  gaugeSuffix?: string;
  gaugeZones?: { label: string; color: string; upTo?: number }[];
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
  /** a resposta vira a variável {estado}/{cidade} (override do IP — seguro no 4G) */
  captures?: "estado" | "cidade";
}

/** Medida — input numérico + toggle de unidade (estilo altura/peso lip.formula). */
/**
 * "Pedida" — régua/balança horizontal arrastável. O usuário desliza a fita para
 * a esquerda/direita e o valor sob o marcador central vira a resposta.
 *
 * `title`/`subtitle`/`value` são os nomes que o construtor grava; `question`/
 * `help`/`defaultValue` são os antigos, mantidos pelos funis que já existiam.
 * Ler SEMPRE com fallback entre os dois (ver `MeasureStepView`).
 */
export interface MeasureStep extends BaseStep {
  type: "measure";
  title?: string;
  question?: string;
  subtitle?: string;
  help?: string;
  units?: string[];
  suffix?: string;
  /** limites e granularidade da régua */
  min?: number;
  max?: number;
  step?: number;
  /** onde a régua nasce posicionada */
  value?: number;
  defaultValue?: number;
  /** marca alta + número a cada N passos (padrão 5) */
  majorEvery?: number;
  /** vibração curta ao passar de marca (só mobile; padrão ligado) */
  haptic?: boolean;
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
  /**
   * "simple"      = pulso + slides
   * "checklist"   = barras rotuladas estilo "Preparando seu plano"
   * "diagnostico" = anel de progresso + caixas com ícone e spinner
   *
   * O diagnóstico não é uma variação visual do checklist: ali cada linha é uma
   * BARRA que enche, aqui cada linha é uma CAIXA que espera, roda e conclui. A
   * diferença importa porque a caixa carrega a ideia de "uma verificação sendo
   * feita sobre você" — que é justamente o que esta lâmina precisa estabelecer
   * antes de a roleta aparecer.
   */
  style?: "simple" | "checklist" | "diagnostico";
  /** ícones das caixas (modo diagnóstico), na ordem de `bars`; faltando, usa 🔎 */
  icons?: string[];
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
  /**
   * "fixed" = ponteiro sempre em `value` (padrão do construtor)
   * "range" = sorteia o ponteiro dentro de `range` (teatral)
   * "imc"   = calcula de peso/altura coletados antes
   */
  mode?: "fixed" | "range" | "imc";
  /** ponteiro no modo "fixed" */
  value?: number;
  /** faixa teatral [min,max] do ponteiro (escala min..max do medidor) */
  range?: [number, number];
  scaleMin?: number;
  scaleMax?: number;
  suffix?: string;
  /**
   * Zonas coloridas da esquerda→direita (ex: baixo/ideal/alto).
   * `upTo` = valor onde a zona TERMINA, na escala scaleMin..scaleMax. Sem ele,
   * as zonas se dividem em fatias iguais (era o único comportamento antigo).
   */
  zones?: { label: string; color: string; upTo?: number }[];
  /** marcas numeradas no arco (0 = nenhuma; padrão 5) */
  ticks?: number;
  /** mostra o número grande sob o ponteiro (padrão ligado) */
  showValue?: boolean;
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
  /** máscara do telefone (9 = dígito), ex: "+55 (99) 99999-9999" */
  phoneMask?: string;
  /** id/name do campo telefone (mapeamento no webhook); padrão "telefone" */
  phoneId?: string;
  /** id/name do campo nome; padrão "nome" */
  nameId?: string;
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
  /** rodapé/copyright exibido na lâmina final (VSL) */
  footer?: string;
  /** motor de renderização: "layers" = clone do page-builder do inlead;
   *  "typebot" = funil conversacional em chat (clone do Typebot) */
  engine?: "layers" | "typebot";
  /** tokens globais de design (motor layers) — InleadDesign */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design?: any;
  /** dados do funil typebot (grupos/blocos/edges/variáveis/tema) quando engine="typebot" */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typebot?: any;
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
        // 6 cards; o de peso 100 é o "viciado" (sempre cai nele). Cada um tem
        // o próprio popup de premiação, igual ao painel de prêmios da roleta.
        cards: [
          { label: "BÔNUS SURPRESA", color: "#a855f7", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou um BÔNUS SURPRESA!" },
          { label: "50% OFF 🔥", color: "#444444", weight: 100, popupTitle: "Parabéns!", popupBody: "Você ganhou 50% OFF!" },
          { label: "APOSTILA VIP", color: "#3b82f6", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou a APOSTILA VIP!" },
          { label: "MATERIAL EXCLUSIVO", color: "#22c55e", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou MATERIAL EXCLUSIVO!" },
          { label: "20% OFF", color: "#eab308", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou 20% OFF!" },
          { label: "10% OFF", color: "#ec4899", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou 10% OFF!" },
        ],
        columns: 2, revealPct: 25, oncePerDevice: true,
        ctaUrl: "https://app.goredirect.com.br/fd61/alunas-sorteadas-mn",
        coverText: "RASPE AQUI", coverColor: "#b8b8b8",
        popupBg: "#16a34a", popupText: "#ffffff", popupBtnBg: "#ffffff",
        winTitle: "🎉 Você ganhou!", winBody: "", winCta: "DESBLOQUEAR PRÊMIO 🎁",
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
