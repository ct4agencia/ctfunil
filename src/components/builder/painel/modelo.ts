/**
 * Painel da etapa (vista C, aprovada pelo Luca em 26/11): leitura e escrita da
 * ETAPA sem campo novo. Cada controle grava onde o funil publicado já lê.
 *
 * Achado da fase 0 (LayersRunner.tsx): numa lâmina de tela cheia (roleta,
 * raspadinha…), o funil desenha o fundo a partir do bloco
 * (`content.background`) e o título a partir de `content.appearance`. O
 * `step.design` (fundo, imagem, títulos e textos da etapa) e o cabeçalho por
 * etapa não chegam lá; só a setinha "role para baixo" vale. Por isso a etapa de
 * uma lâmina de tela cheia edita os campos do bloco e marca o resto como "não
 * vale nesta lâmina", em vez de oferecer controles que não mudam nada.
 */
import type { InleadStep, Layer } from "@/lib/quiz/layers/types";
import type { Funnel } from "@/lib/quiz/types";

export const TELA_CHEIA = new Set(["roulette", "slider", "scratch", "measure", "gauge", "vsl", "confirm", "sonia-numbers"]);

export const ROTULO_TELA_CHEIA: Record<string, string> = {
  roulette: "Roleta", slider: "Slider", scratch: "Raspadinha", measure: "Medida", gauge: "Medidor",
  vsl: "VSL", confirm: "Parabéns", "sonia-numbers": "Números da Sônia",
};

/** Gradiente que a roleta usa quando o fundo fica vazio (LayersRunner.tsx). */
export const FUNDO_PADRAO_ROLETA = "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)";

export type Origem = "funil" | "personalizado" | "misto";

type DesignEtapa = NonNullable<InleadStep["design"]>;
type Registro = Record<string, unknown>;

const NOMES_BLOCO: Record<string, string> = {
  button: "Botão", options: "Pergunta", text: "Texto", image: "Imagem", check: "Check", alert: "Alerta", card: "Card",
  field: "Campo", disclaimer: "Faixa", embed: "Vídeo", loading: "Carregamento", clear: "Espaço",
};

export function nomeDoBloco(layer: Layer): string {
  return layer.title || ROTULO_TELA_CHEIA[layer.type] || NOMES_BLOCO[layer.type] || layer.type;
}

/** Texto corrido de um campo com HTML (títulos e textos dos blocos). */
export function textoPuro(html: unknown): string {
  return String(html ?? "")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); // &amp; antes: "&amp;nbsp;" vira espaço
}

/** Opções curtas usadas pelas vistas (rótulos para quem não é técnico). */
export const PESOS = [
  { valor: 300, rotulo: "Leve (300)" }, { valor: 400, rotulo: "Regular (400)" }, { valor: 500, rotulo: "Médio (500)" },
  { valor: 600, rotulo: "Seminegrito (600)" }, { valor: 700, rotulo: "Negrito (700)" }, { valor: 800, rotulo: "Extra (800)" }, { valor: 900, rotulo: "Black (900)" },
];
export const rotuloPeso = (peso: number) => PESOS.find(p => p.valor === peso)?.rotulo.replace(/ \(\d+\)$/, "") ?? String(peso);
/** Mesmas opções do painel antigo ("Imagem de fundo"), para nenhum ajuste se perder. */
export const AJUSTES = [{ valor: "cover", rotulo: "Tela inteira" }, { valor: "contain", rotulo: "Adequar" }, { valor: "auto", rotulo: "Original" }, { valor: "fill", rotulo: "Esticar" }];
export const POSICOES = [{ valor: "center", rotulo: "Centro" }, { valor: "top", rotulo: "Topo" }, { valor: "bottom", rotulo: "Base" }, { valor: "left", rotulo: "Esquerda" }, { valor: "right", rotulo: "Direita" }];

export function blocoTelaCheia(step?: InleadStep): Layer | undefined {
  return step?.layers?.find(layer => TELA_CHEIA.has(layer.type) && !layer.design?.hidden);
}

export function designDoFunil(funnel: Funnel): Registro {
  return ((funnel.settings as { design?: Registro } | undefined)?.design ?? {}) as Registro;
}

export function cabecalhoDoFunil(funnel: Funnel): Record<string, boolean | undefined> {
  return ((funnel.settings as { header?: Record<string, boolean | undefined> } | undefined)?.header ?? {});
}

export function origemDe(valores: unknown[]): Origem {
  const definidos = valores.filter(valor => valor !== undefined && valor !== null && valor !== "").length;
  if (!definidos) return "funil";
  return definidos === valores.length ? "personalizado" : "misto";
}

/** `url("…")` → o endereço; qualquer outra coisa → undefined. */
export function imagemDoCss(css?: string): string | undefined {
  const achado = css?.match(/url\((["']?)(.*?)\1\)/i);
  return achado?.[2] || undefined;
}

export function ehCorSolida(css?: string): boolean {
  return !!css && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(css.trim());
}

// ── Fundo ────────────────────────────────────────────────────────────────

export type Fundo = {
  telaCheia: boolean;
  cor?: string;          // cor própria da etapa (ou do bloco de tela cheia)
  css?: string;          // gradiente próprio, quando não é cor nem imagem
  imagem?: string;
  ajuste: string;
  posicao: string;
  opacidade: number;
  /** o que vale quando nada foi mudado */
  padrao: { cor?: string; css?: string; texto: string };
  origem: Origem;
};

export function lerFundo(step: InleadStep, funnel: Funnel): Fundo {
  const bloco = blocoTelaCheia(step);
  if (bloco) {
    const c = (bloco.content ?? {}) as Registro;
    const css = typeof c.background === "string" && c.background ? c.background : undefined;
    const imagem = imagemDoCss(css);
    const escuro = bloco.type === "roulette";
    return {
      telaCheia: true,
      cor: ehCorSolida(css) ? css : undefined,
      css: css && !imagem && !ehCorSolida(css) ? css : undefined,
      imagem,
      ajuste: String(c.bgSize ?? "cover"),
      posicao: String(c.bgPosition ?? "center"),
      opacidade: 100,
      padrao: escuro
        ? { css: FUNDO_PADRAO_ROLETA, texto: "Gradiente roxo da roleta" }
        : { cor: String(designDoFunil(funnel).backgroundColor ?? "#ffffff"), texto: "Cor de fundo do funil" },
      origem: css ? "personalizado" : "funil",
    };
  }
  const d = (step.design ?? {}) as DesignEtapa;
  const g = designDoFunil(funnel);
  return {
    telaCheia: false,
    cor: d.backgroundColor || undefined,
    imagem: d.backgroundImage?.src || undefined,
    ajuste: d.backgroundSize || "cover",
    posicao: d.backgroundPosition || "center",
    opacidade: Number(d.backgroundOpacity ?? 100),
    padrao: { cor: String(g.backgroundColor ?? "#ffffff"), texto: "Cor de fundo do funil" },
    origem: origemDe([d.backgroundColor, d.backgroundImage?.src]),
  };
}

/** Patch da ETAPA para o fundo, gravando onde o funil lê. */
export function patchFundo(step: InleadStep, mudanca: { cor?: string | null; imagem?: string | null; ajuste?: string; posicao?: string; opacidade?: number; restaurar?: boolean }): Partial<InleadStep> {
  const bloco = blocoTelaCheia(step);
  if (bloco) {
    const c = { ...(bloco.content ?? {}) } as Registro;
    if (mudanca.restaurar) { delete c.background; delete c.bgSize; delete c.bgPosition; }
    if (mudanca.cor !== undefined) { if (mudanca.cor) c.background = mudanca.cor; else delete c.background; }
    if (mudanca.imagem !== undefined) {
      if (mudanca.imagem) { c.background = `url("${mudanca.imagem}")`; c.bgSize ??= "cover"; c.bgPosition ??= "center"; }
      else delete c.background;
    }
    if (mudanca.ajuste) c.bgSize = mudanca.ajuste;
    if (mudanca.posicao) c.bgPosition = mudanca.posicao;
    return { layers: step.layers.map(layer => layer.id === bloco.id ? { ...layer, content: c } : layer) };
  }
  const d = { ...(step.design ?? {}) } as DesignEtapa;
  if (mudanca.restaurar) { delete d.backgroundColor; delete d.backgroundImage; delete d.backgroundSize; delete d.backgroundPosition; delete d.backgroundOpacity; }
  if (mudanca.cor !== undefined) { if (mudanca.cor) d.backgroundColor = mudanca.cor; else delete d.backgroundColor; }
  if (mudanca.imagem !== undefined) { if (mudanca.imagem) d.backgroundImage = { type: "image", src: mudanca.imagem } as DesignEtapa["backgroundImage"]; else delete d.backgroundImage; }
  if (mudanca.ajuste) d.backgroundSize = mudanca.ajuste;
  if (mudanca.posicao) d.backgroundPosition = mudanca.posicao;
  if (mudanca.opacidade !== undefined) d.backgroundOpacity = mudanca.opacidade;
  return { design: d };
}

// ── Tipografia ───────────────────────────────────────────────────────────

export type Texto = {
  fonte?: string; tamanho?: number; peso?: number; linha?: number; cor?: string;
  /** valores que valem quando o campo está vazio */
  padrao: { fonte: string; tamanho: number; peso: number; linha: number; cor: string };
  /** campos que não chegam ao funil nesta lâmina */
  semEfeito: Set<"fonte" | "tamanho" | "peso" | "linha" | "cor">;
};

export type Tipografia = { telaCheia: boolean; titulos: Texto; textos: Texto; origem: Origem; alinhamento?: string };

export function lerTipografia(step: InleadStep, funnel: Funnel): Tipografia {
  const g = designDoFunil(funnel);
  const padraoTitulos = {
    fonte: String(g.featuredFont || "Tema do funil"), tamanho: Number(g.titleSize ?? 32), peso: Number(g.titleWeight ?? 700),
    linha: Number(g.titleLineHeight ?? 1.15), cor: String(g.titleColor ?? g.contentColor ?? "#000000"),
  };
  const padraoTextos = {
    fonte: String(g.contentFont || "Tema do funil"), tamanho: Number(g.contentSize ?? 16), peso: Number(g.contentWeight ?? 400),
    linha: Number(g.contentLineHeight ?? 1.45), cor: String(g.contentColor ?? "#000000"),
  };
  const bloco = blocoTelaCheia(step);
  if (bloco) {
    const ap = (((bloco.content ?? {}) as Registro).appearance ?? {}) as { align?: string; titleSize?: number; titleWeight?: number; titleColor?: string };
    const escuro = bloco.type === "roulette";
    const todos = new Set(["fonte", "tamanho", "peso", "linha", "cor"] as const);
    return {
      telaCheia: true,
      alinhamento: ap.align,
      titulos: {
        tamanho: ap.titleSize, peso: ap.titleWeight, cor: ap.titleColor,
        padrao: { ...padraoTitulos, fonte: "Fonte de destaque do tema", tamanho: 26, peso: 700, cor: escuro ? "#ffffff" : padraoTitulos.cor },
        semEfeito: new Set(["fonte", "linha"] as const),
      },
      textos: { padrao: { ...padraoTextos, cor: escuro ? "#ffffff" : padraoTextos.cor }, semEfeito: todos },
      origem: origemDe([ap.titleSize, ap.titleWeight, ap.titleColor, ap.align]),
    };
  }
  const d = (step.design ?? {}) as DesignEtapa;
  return {
    telaCheia: false,
    titulos: { fonte: d.featuredFont, tamanho: d.titleSize, peso: d.titleWeight, linha: d.titleLineHeight, cor: d.titleColor, padrao: padraoTitulos, semEfeito: new Set() },
    textos: { fonte: d.contentFont, tamanho: d.contentSize, peso: d.contentWeight, linha: d.contentLineHeight, cor: d.contentColor, padrao: padraoTextos, semEfeito: new Set() },
    origem: origemDe([d.featuredFont, d.titleSize, d.titleWeight, d.titleLineHeight, d.titleColor, d.contentFont, d.contentSize, d.contentWeight, d.contentLineHeight, d.contentColor]),
  };
}

const CHAVES_DESIGN = {
  titulos: { fonte: "featuredFont", tamanho: "titleSize", peso: "titleWeight", linha: "titleLineHeight", cor: "titleColor" },
  textos: { fonte: "contentFont", tamanho: "contentSize", peso: "contentWeight", linha: "contentLineHeight", cor: "contentColor" },
} as const;
const CHAVES_APARENCIA = { tamanho: "titleSize", peso: "titleWeight", cor: "titleColor" } as const;

export function patchTipografia(step: InleadStep, alvo: "titulos" | "textos", campo: keyof typeof CHAVES_DESIGN.titulos | "alinhamento" | "restaurar", valor?: string | number): Partial<InleadStep> {
  const bloco = blocoTelaCheia(step);
  if (bloco) {
    const c = { ...(bloco.content ?? {}) } as Registro;
    const ap = { ...((c.appearance ?? {}) as Registro) };
    if (campo === "restaurar") { delete c.appearance; }
    else if (alvo === "titulos" && (campo === "alinhamento" || campo in CHAVES_APARENCIA)) {
      const chave = campo === "alinhamento" ? "align" : CHAVES_APARENCIA[campo as keyof typeof CHAVES_APARENCIA];
      if (valor === undefined || valor === "") delete ap[chave]; else ap[chave] = valor;
      if (Object.keys(ap).length) c.appearance = ap; else delete c.appearance;
    }
    return { layers: step.layers.map(layer => layer.id === bloco.id ? { ...layer, content: c } : layer) };
  }
  const d = { ...(step.design ?? {}) } as Registro;
  if (campo === "restaurar") {
    for (const grupo of Object.values(CHAVES_DESIGN)) for (const chave of Object.values(grupo)) delete d[chave];
  } else if (campo !== "alinhamento") {
    const chave = CHAVES_DESIGN[alvo][campo];
    if (valor === undefined || valor === "") delete d[chave]; else d[chave] = valor;
  }
  return { design: d as DesignEtapa };
}

/** Estado só dos títulos ou só dos textos (a vista C trata os dois em grupos separados). */
export function origemDoTexto(t: Tipografia, alvo: "titulos" | "textos"): Origem {
  const x = t[alvo];
  const campos: unknown[] = [x.fonte, x.tamanho, x.peso, x.linha, x.cor];
  if (alvo === "titulos" && t.telaCheia) campos.push(t.alinhamento);
  return origemDe(campos);
}

/** Volta ao do funil só os títulos ou só os textos (o "restaurar" acima limpa os dois). */
export function restaurarTexto(step: InleadStep, alvo: "titulos" | "textos"): Partial<InleadStep> {
  const bloco = blocoTelaCheia(step);
  if (bloco) return alvo === "titulos" ? patchTipografia(step, "titulos", "restaurar") : {};
  const d = { ...(step.design ?? {}) } as Registro;
  for (const chave of Object.values(CHAVES_DESIGN[alvo])) delete d[chave];
  return { design: d as DesignEtapa };
}

// ── Cabeçalho ────────────────────────────────────────────────────────────

export const ITENS_CABECALHO = [
  ["show_logo", "Logo"], ["show_progress", "Barra de progresso"], ["show_back", "Botão voltar"],
  ["go_to_top", "Botão “Ir ao topo”"], ["show_scroll_hint", "Setinha “role para baixo”"],
] as const;
export type ChaveCabecalho = (typeof ITENS_CABECALHO)[number][0];

export type ItemCabecalho = { chave: ChaveCabecalho; rotulo: string; ligado: boolean; herdado: boolean; semEfeito: boolean };

export function lerCabecalho(step: InleadStep, funnel: Funnel): { itens: ItemCabecalho[]; origem: Origem; telaCheia: boolean } {
  const g = cabecalhoDoFunil(funnel);
  const ov = (step.headerOverride ?? {}) as Record<string, boolean | undefined>;
  const telaCheia = !!blocoTelaCheia(step);
  const itens = ITENS_CABECALHO.map(([chave, rotulo]) => {
    const global = chave === "show_scroll_hint" ? g[chave] !== false : !!g[chave];
    const herdado = ov[chave] === undefined;
    return { chave, rotulo, ligado: herdado ? global : !!ov[chave], herdado, semEfeito: telaCheia && chave !== "show_scroll_hint" };
  });
  const validos = itens.filter(item => !item.semEfeito);
  return { itens, telaCheia, origem: origemDe(validos.map(item => (item.herdado ? undefined : true))) };
}

export function patchCabecalho(step: InleadStep, chave: ChaveCabecalho | "restaurar", valor?: boolean): Partial<InleadStep> {
  const ov = { ...((step.headerOverride ?? {}) as Record<string, boolean | undefined>) };
  if (chave === "restaurar") for (const [k] of ITENS_CABECALHO) delete ov[k];
  else ov[chave] = valor;
  return { headerOverride: ov as InleadStep["headerOverride"] };
}
