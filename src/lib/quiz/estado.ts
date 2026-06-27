/**
 * Concordância de preposição com nome de estado brasileiro.
 *
 * O problema: o texto traz "de {estado}" ou "em {estado}", e ao trocar {estado}
 * pelo nome real sai "de Bahia" / "em Paraná" — gramaticalmente errado. Cada
 * estado tem (ou não) artigo definido, então a preposição contrai:
 *   de + a Bahia   = da Bahia      em + a Bahia   = na Bahia
 *   de + o Paraná  = do Paraná     em + o Paraná  = no Paraná
 *   de + São Paulo = de São Paulo  em + São Paulo = em São Paulo  (sem artigo)
 */

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g"); // marcas de acento (após NFD)
const norm = (s: string) => s.normalize("NFD").replace(COMBINING, "").toLowerCase().trim();

/** Artigo definido de cada estado: "a" (feminino), "o" (masculino) ou "" (sem artigo). */
const ARTIGO: Record<string, "a" | "o" | ""> = {
  acre: "o", amapa: "o", amazonas: "o", ceara: "o", "espirito santo": "o",
  maranhao: "o", para: "o", parana: "o", piaui: "o", "rio de janeiro": "o",
  "rio grande do norte": "o", "rio grande do sul": "o", tocantins: "o", "distrito federal": "o",
  bahia: "a", paraiba: "a",
  alagoas: "", goias: "", "minas gerais": "", "mato grosso": "", "mato grosso do sul": "",
  pernambuco: "", "sao paulo": "", "santa catarina": "", sergipe: "", rondonia: "", roraima: "",
};

/** Contrai "de"/"em" conforme o artigo do estado, preservando a capitalização original. */
function contrai(prep: string, estado: string): string {
  const art = ARTIGO[norm(estado)] ?? "";
  const base = prep.toLowerCase();
  let out = base;
  if (base === "de") out = art === "a" ? "da" : art === "o" ? "do" : "de";
  else if (base === "em") out = art === "a" ? "na" : art === "o" ? "no" : "em";
  return prep[0] === prep[0]?.toUpperCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/**
 * Substitui {estado} no texto contraindo a preposição (de/em) imediatamente
 * anterior — mesmo que haja tags HTML entre ela e o token (ex.: a cor do Quill).
 * Quando o estado é desconhecido cai no fallback "sua região" sem quebrar a frase.
 */
export function interpEstado(text: string, estado: string | undefined): string {
  const nome = estado || "sua região";
  // preposição + (tags/espacos opcionais) + {estado}
  let out = text.replace(
    /\b([Dd]e|[Ee]m)(\s*(?:<[^>]+>\s*)*)\{estado\}/g,
    (_m, prep: string, gap: string) => `${contrai(prep, nome)}${gap}${nome}`,
  );
  // qualquer {estado} restante (sem preposição na frente)
  out = out.replace(/\{estado\}/gi, nome);
  return out;
}
