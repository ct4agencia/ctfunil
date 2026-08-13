/**
 * Check da centralização dos blocos-hero.
 *
 * A PERGUNTA QUE ELE RESPONDE
 * "Todo bloco-hero que o funil RENDERIZA também pode ser EDITADO — e por um
 * editor só?"
 *
 * Por que precisa de teste automático: as duas listas moram em arquivos
 * diferentes e nada no compilador as liga.
 *
 *   LayersRunner.tsx   HERO_TIPADO     → o que o funil sabe desenhar em tela cheia
 *   LayersBuilder.tsx  HERO_DO_TIPADO  → o que o construtor manda ao StepEditor
 *
 * Quando elas divergem o defeito é silencioso e chega pelo pior caminho: o
 * bloco aparece no funil publicado e não há onde configurá-lo. Foi exatamente
 * o que houve com a roleta — ela renderizava com presets, popup e som, e o
 * construtor mostrava um editor antigo que não conhecia nada disso, porque
 * estava fora da segunda lista.
 *
 * Uso:  node scripts/check-heros.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");

/** Extrai os nomes de um `const NOME = new Set([...])`. */
function lerSet(arquivo, nome) {
  const src = ler(arquivo);
  const literal = new RegExp(`const\\s+${nome}\\s*=\\s*new Set\\(\\[([^\\]]*)\\]`).exec(src);
  if (literal) return literal[1].match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
  // aceita também o alias (`const X = Y;`), usado quando as duas listas viraram
  // a mesma coisa — que é justamente o estado desejado
  const alias = new RegExp(`const\\s+${nome}\\s*=\\s*([A-Z_][A-Z0-9_]*)\\s*;`).exec(src);
  if (alias) return lerSet(arquivo, alias[1]);
  throw new Error(`não achei "${nome}" em ${arquivo}`);
}

let falhas = 0;
const ok = (cond, msg) => { console.log(`   ${cond ? "OK  " : "FALHA"} ${msg}`); if (!cond) falhas++; };

const RUNTIME = "src/components/quiz/layers/LayersRunner.tsx";
const EDITOR = "src/components/builder/LayersBuilder.tsx";

const desenha = lerSet(RUNTIME, "HERO_TIPADO").sort();
const edita = lerSet(EDITOR, "HERO_DO_TIPADO").sort();

console.log("1) Todo hero que o funil desenha tem editor\n");
console.log(`   desenha (${desenha.length}): ${desenha.join(", ")}`);
console.log(`   edita   (${edita.length}): ${edita.join(", ")}\n`);

const semEditor = desenha.filter((t) => !edita.includes(t));
ok(semEditor.length === 0, semEditor.length
  ? `heros SEM editor: ${semEditor.join(", ")} — aparecem no funil e não há onde configurar`
  : "nenhum hero ficou sem editor");

const semRender = edita.filter((t) => !desenha.includes(t));
ok(semRender.length === 0, semRender.length
  ? `editor para hero que o funil NÃO desenha: ${semRender.join(", ")}`
  : "nenhum editor sobrando");

console.log("\n2) Não voltou a existir editor de hero fora do StepEditor");
const src = ler(EDITOR);
// os editores duplicados se anunciavam com esse cabeçalho
const marcas = src.match(/(Roleta|Slider|Raspadinha|Medidor|Pedida) \(hero\)/g) ?? [];
ok(marcas.length === 0, marcas.length
  ? `achei painel próprio no LayersBuilder: ${[...new Set(marcas)].join(", ")}`
  : "todo hero passa pelo StepEditor");

console.log("\n3) Campos compartilhados declarados uma vez só");
const arquivos = ["src/components/builder/fields.tsx", EDITOR, "src/components/builder/StepEditor.tsx"];
for (const comp of ["ImageField", "HtmlField", "StringList"]) {
  const onde = arquivos.filter((a) => new RegExp(`^(export )?function ${comp}\\b`, "m").test(ler(a)));
  ok(onde.length === 1, `${comp}: declarado em ${onde.length} arquivo(s)${onde.length ? ` (${onde.map((a) => a.split("/").pop()).join(", ")})` : ""}`);
}

console.log("\n4) Nenhum bloco adicionável fica sem editor, nem pronto e trancado");
{
  const lb = ler(EDITOR);
  const bl = ler("src/components/quiz/layers/blocks.tsx");
  const lista = (re, txt) => { const m = re.exec(txt); return m ? (m[1].match(/"([a-z_]+)"/g) ?? []).map((s) => s.slice(1, -1)) : []; };

  const addable = lista(/const ADDABLE = new Set\(\[([\s\S]*?)\]\)/, lb);
  // `case "a": case "b":` na mesma linha conta os dois
  const editor = [...lb.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]);
  const atalhos = [...(/const ATALHO_CAMPO[^=]*=\s*\{([\s\S]*?)\n\};/.exec(lb)?.[1] ?? "").matchAll(/^\s+([a-z]+):/gm)].map((m) => m[1]);
  const heros = lerSet(EDITOR, "HERO_DO_TIPADO");
  const desenha = [...bl.matchAll(/case "([a-z_]+)": return </g)].map((m) => m[1]);

  // Adicionar um bloco e não achar onde configurá-lo é o pior caminho: só se
  // descobre depois de montar a lâmina inteira.
  const semEditor = addable.filter((t) => !editor.includes(t) && !atalhos.includes(t) && !heros.includes(t));
  ok(semEditor.length === 0, semEditor.length
    ? `adicionáveis SEM editor: ${semEditor.join(", ")}`
    : `todos os ${addable.length} blocos adicionáveis têm onde ser configurados`);

  // O oposto: o funil desenha, mas o construtor diz "em breve". Foi o caso do
  // `graphics` (anel de %, que o cdb-01 usa) e do `notification`.
  const trancados = desenha.filter((t) => !addable.includes(t));
  ok(trancados.length === 0, trancados.length
    ? `o funil desenha mas o construtor bloqueia: ${trancados.join(", ")}`
    : "nenhuma funcionalidade pronta está trancada como 'em breve'");
}

console.log(falhas === 0 ? "\nOK — nenhuma falha." : `\n${falhas} FALHA(S).`);
process.exit(falhas === 0 ? 0 : 1);
