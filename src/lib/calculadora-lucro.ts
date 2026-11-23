/** Calculadora de Lucro — regra financeira pura, em centavos inteiros. */

export const CAMPOS_CUSTO = ["material", "embalagem", "frete", "adicionais", "maoDeObra"] as const;
export type CampoCusto = (typeof CAMPOS_CUSTO)[number];
export type CampoNumerico = CampoCusto | "margem";
export type Valores = Record<CampoCusto | "margem" | "nome" | "celular", string>;

export const VALORES_VAZIOS: Valores = { material: "", embalagem: "", frete: "", adicionais: "", maoDeObra: "", margem: "", nome: "", celular: "" };

export const ROTULOS: Record<CampoCusto, string> = {
  material: "Material", embalagem: "Embalagem", frete: "Frete", adicionais: "Custos adicionais", maoDeObra: "Mão de obra",
};

const OBRIGATORIO: Partial<Record<CampoNumerico, string>> = {
  material: "Informe o custo do material.",
  maoDeObra: "Informe o custo da mão de obra.",
  margem: "Informe a margem de lucro.",
};
const NEGATIVO = "Use um valor igual ou maior que zero.";
const SEM_CUSTO = "Informe pelo menos um custo maior que zero.";

type Leitura = { vazio: true } | { invalido: true } | { valor: number };

/** "1.234,56", "1234,56", "12.5", "R$ 0,99" → número. Nunca parseFloat em vírgula. */
export function lerNumero(bruto: string): Leitura & { vazio?: boolean; invalido?: boolean; valor?: number } {
  let s = (bruto || "").replace(/R\$|\s|%/g, "");
  if (!s) return { vazio: true };
  let negativo = false;
  if (s[0] === "-") { negativo = true; s = s.slice(1); }
  if (s.includes(",")) {
    if (s.split(",").length > 2) return { invalido: true };
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return { invalido: true };
  const n = Number(s);
  return { valor: negativo ? -n : n };
}

export type Resultado =
  | { ok: true; itens: Record<CampoCusto, number>; custo: number; preco: number; lucro: number; margemEfetiva: number; nome: string }
  | { ok: false; erros: Partial<Record<CampoNumerico, string>>; erroGeral: string | null };

export function calcularLucro(v: Valores): Resultado {
  const erros: Partial<Record<CampoNumerico, string>> = {};
  const itens = {} as Record<CampoCusto, number>;
  for (const k of CAMPOS_CUSTO) {
    const p = lerNumero(v[k]);
    if (p.vazio) { if (OBRIGATORIO[k]) erros[k] = OBRIGATORIO[k]; else itens[k] = 0; }
    else if (p.invalido) erros[k] = "Use um número válido, como 12,50.";
    else if ((p.valor as number) < 0) erros[k] = NEGATIVO;
    else itens[k] = Math.round((p.valor as number) * 100);
  }
  const m = lerNumero(v.margem);
  let pontosBase = 0; // margem em centésimos de ponto percentual (45% → 4500)
  if (m.vazio) erros.margem = OBRIGATORIO.margem;
  else if (m.invalido) erros.margem = "Use um número válido, como 45.";
  else if ((m.valor as number) < 0) erros.margem = NEGATIVO;
  else if ((m.valor as number) >= 100) erros.margem = "A margem deve ser menor que 100%.";
  else pontosBase = Math.round((m.valor as number) * 100);

  const qtdErros = Object.keys(erros).length;
  if (qtdErros) return { ok: false, erros, erroGeral: qtdErros > 1 ? "Revise os campos destacados para calcular." : null };
  const custo = CAMPOS_CUSTO.reduce((t, k) => t + itens[k], 0);
  if (custo === 0) return { ok: false, erros: { material: SEM_CUSTO }, erroGeral: SEM_CUSTO };
  if (pontosBase >= 10000) return { ok: false, erros: { margem: "A margem deve ser menor que 100%." }, erroGeral: null };

  // P = C / (1 − m), arredondado PARA CIMA no centavo, com inteiros exatos.
  const divisor = 10000 - pontosBase;
  const preco = Math.ceil((custo * 10000) / divisor - 1e-9);
  const lucro = preco - custo;
  return { ok: true, itens, custo, preco, lucro, margemEfetiva: (lucro / preco) * 100, nome: v.nome.trim() };
}

export const formatarBRL = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatarPct = (x: number, casas = 2) => x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";

/** Margem exibida truncada, nunca arredondada para cima acima da efetiva. */
export const formatarMargem = (x: number) => formatarPct(Math.floor(x * 100 + 1e-9) / 100);

export function mascararCelular(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return "(" + d;
  const ddd = d.slice(0, 2), resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Texto copiado: nunca inclui o celular do cliente. */
export function textoParaCopiar(r: Extract<Resultado, { ok: true }>): string {
  return [
    r.nome ? `Peça: ${r.nome}` : null,
    `Custo total: ${formatarBRL(r.custo)}`,
    `Preço sugerido: ${formatarBRL(r.preco)}`,
    `Lucro estimado por peça: ${formatarBRL(r.lucro)}`,
    `Margem sobre a venda: ${formatarMargem(r.margemEfetiva)}`,
  ].filter(Boolean).join("\n");
}
