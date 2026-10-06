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
  | "embed" | "video" | "roulette" | "slider" | "carousel"
  | "sonia-numbers" // seleção demonstrativa 01..60; sem reserva/estoque
  // ── diagnóstico e prova (13/08/2026) ──────────────────────────────────────
  | "level"        // régua de níveis com "você está aqui"
  | "beforeafter"  // prova social antes→depois, em carrossel
  | "charts"       // barras de projeção (o `graphics` é UM anel de %)
  // ── organização visual ────────────────────────────────────────────────────
  // Caixa com fundo, borda e sombra derivados do tema, para separar um trecho
  // do resto. Era o que faltava para a lâmina parar de parecer lista solta.
  | "card"
  // Selo de confirmação: disco com o ✓ se desenhando e ondas saindo de trás.
  // Nasceu dentro da tela de pós-captura; virou bloco porque confirmação
  // acontece em vários pontos do funil.
  | "check"
  // Provas de confiança da oferta: medalhão de garantia, bandeiras de pagamento
  // e os selos "Compra Segura / Satisfação Garantida / Privacidade Protegida".
  // Eram desenhados direto na tela da VSL, sem existir como bloco — apareciam na
  // página e NÃO apareciam em "Blocos desta lâmina", então não havia como tirar
  // nem editar. Virou bloco pelo mesmo motivo do `check`: quem monta a lâmina
  // decide o que ela mostra, não o componente.
  | "trust"
  // Escassez em forma de RANKING: três linhas de placar com a lead no meio, e a
  // posição dela piorando com o tempo. Mesmo relógio do `disclaimer` (que conta
  // vagas), outra roupa — em vez de "restam N vagas", "você está caindo".
  // A perda de lugar pressiona mais que a contagem de estoque: o número não é
  // um recurso abstrato, é a fila que cresce na frente dela.
  | "ranking"
  // Faixa fixa no topo da lâmina, sangrando até as bordas. Carrega aviso legal,
  // prazo ou escassez, e sabe contar um número que sobe com o tempo.
  | "disclaimer"
  // ── blocos-hero vindos do motor tipado ────────────────────────────────────
  // Ocupam a lâmina inteira e reaproveitam os componentes de components/quiz/
  // (mesmo mecanismo que roulette/slider já usam). O `content` de cada um é o
  // Step tipado correspondente, não um content de layer comum.
  | "scratch"    // raspadinha (ScratchGrid)
  | "measure"    // "pedida": régua horizontal arrastável (MeasureStepView)
  | "gauge"      // medidor/velocímetro (GaugeStepView)
  | "vsl"        // player de vídeo com CTA por tempo (VslStepView)
  | "confirm" | "check";   // "parabéns": celebração + confete (ConfirmStepView)

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
  /**
   * ID/Nome legível deste bloco — vira o chip na aba Leads e o cabeçalho no CSV
   * (padrão inlead: "options: Faixa_Etaria" em vez de "options: XMMdV8").
   *
   * `id` é gerado aleatório e NÃO pode mudar: é a chave que liga a resposta
   * gravada à coluna. Este campo é só o rótulo, por isso renomear aqui nunca
   * órfã o histórico — é a regra de ouro de `lib/quiz/colunas.ts`.
   *
   * `colunas.ts` já lia este campo, mas não existia UI para preenchê-lo: em
   * todos os funis ele está null e a coluna caía no id opaco.
   */
  webhookKey?: string;
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
    // Sorteio da Sônia — números válidos e distintos, sem correção silenciosa
    numeroX?: number;
    numeroY?: number;
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
  /**
   * ID/Nome legível da LÂMINA. Nomeia a coluna quando a lâmina não tem bloco
   * respondível (slider, raspadinha, medidor, roleta, texto): essas viram a
   * coluna "Passou", cuja chave era o `id` aleatório da lâmina.
   *
   * Também é o fallback do bloco — é daqui que vêm os "Faixa_Etaria" e
   * "Fez_Curso" que já aparecem no cdb-01, gravados por script antes de existir
   * campo na tela.
   */
  webhookKey?: string;
  /** false/true: lâmina desativada é PULADA no funil publicado (sem deletar). */
  disabled?: boolean;
  /**
   * Tela pronta que SUBSTITUI a pilha de blocos desta lâmina. Usada pelo padrão
   * da referência (`design.presetTelas === "resina"`): "captura", "resultado",
   * "diagnostico", "pos-captura", "vsl". Ausente = a lâmina empilha blocos como
   * sempre fez.
   */
  tela?: string;
  /** VSL: texto da barra de vagas no topo. Vazio esconde a barra. */
  vagasTexto?: string;
  /** VSL: segundos até a barra de vagas aparecer (0 = já visível). */
  vagasEm?: number;
  /** VSL: imagem dos selos de confiança no rodapé. */
  selosImagem?: string;
  /** VSL: razão social e direitos, no rodapé. */
  rodape?: string;
  /** VSL: fundo próprio — URL de imagem, cor ou gradiente CSS. Vazio deriva do tema. */
  fundo?: string;
  /** VSL: cor do CTA. Vazio mantém o verde de confirmação. */
  ctaCor?: string;
  /** Resultado: nota que o anel persegue, e a mínima citada no texto. */
  nota?: number;
  minimo?: number;
  /** Captura: pílula acima do título (ex.: "🎁 Presente exclusivo"). */
  selo?: string;
  /**
   * Destino da saída PADRÃO — a que vale "independente do botão clicado".
   * Ausente = próxima lâmina por posição (o comportamento de sempre). É o que a
   * bolinha do rodapé grava quando arrastada no mapa de fluxo.
   */
  nextStep?: string;
  /** Posição no mapa de fluxo, quando arrastada à mão. Ausente = layout automático. */
  flowPos?: { x: number; y: number };
  layers: Layer[];
  options?: { show_logo?: boolean; show_progress?: boolean; show_back?: boolean };
  /** Override do header SÓ desta lâmina. Cada chave undefined = herda do global. */
  headerOverride?: { show_logo?: boolean; show_progress?: boolean; show_back?: boolean; go_to_top?: boolean };
  design?: {
    backgroundColor?: string;
    backgroundImage?: InleadMedia;
    backgroundOpacity?: string | number;
    backgroundSize?: string; // cover | auto | contain | fill
    backgroundPosition?: string; // center | top | bottom | left | right
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
  logoOpacity?: number | string;
  gap?: string;
  header?: { layout?: string; progress?: string };
}
