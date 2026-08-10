/**
 * Check do ID/Nome editável das colunas (aba Leads + CSV).
 *
 * Importa o MÓDULO REAL (`src/lib/quiz/colunas.ts`) via type stripping do Node,
 * ao contrário de `audita-colunas.cjs`, que mantém uma cópia da lógica e por
 * isso não detecta divergência entre a cópia e o original.
 *
 * A INVARIANTE QUE IMPORTA
 * `key` é RÓTULO; a junção resposta<->coluna usa `stepId`/`layerId`. Renomear o
 * ID no construtor pode mudar o cabeçalho, mas NUNCA pode mudar a chave de
 * junção — se mudasse, todo o histórico do funil viraria coluna órfã no
 * instante em que o Luca renomeasse um bloco.
 *
 * Uso:  node scripts/check-colunas.mjs
 */
import { colunasDoFunil, gruposDeColunas, normalizarChave } from "../src/lib/quiz/colunas.ts";

let falhas = 0;
const ok = (cond, msg) => { console.log(`   ${cond ? "OK  " : "FALHA"} ${msg}`); if (!cond) falhas++; };
const eq = (a, b, msg) => ok(a === b, `${msg}  (obtido: ${JSON.stringify(a)})`);

console.log("1) normalizarChave — acento e espaço viram o padrão inlead");
eq(normalizarChave("Faixa Etária"), "Faixa_Etaria", '"Faixa Etária" -> "Faixa_Etaria"');
eq(normalizarChave("  Ocupação  "), "Ocupacao", "corta espaço das pontas");
eq(normalizarChave("Apoio-Emocional"), "Apoio-Emocional", "hífen sobrevive");
eq(normalizarChave("já fez? curso!"), "ja_fez_curso", "pontuação vira _, sem _ sobrando");
eq(normalizarChave("!!!"), "", "só símbolos -> vazio (cai no fallback)");
eq(normalizarChave(""), "", "vazio -> vazio");
eq(normalizarChave("a".repeat(60)).length, 40, "corta em 40 caracteres");

console.log("\n2) O ID do BLOCO nomeia a coluna");
const funil = [
  { id: "st_A", webhookKey: "Idade", layers: [{ id: "ly_1", type: "options", webhookKey: "Faixa_Etaria" }] },
  { id: "st_B", layers: [{ id: "ly_2", type: "button" }] },                       // sem nome nenhum
  { id: "st_C", webhookKey: "Roleta", layers: [{ id: "ly_3", type: "text" }] },   // vira "Passou"
  { id: "st_D", layers: [{ id: "ly_4", type: "text" }] },                         // "Passou" sem nome
  { id: "st_E", webhookKey: "Lamina", layers: [{ id: "ly_5", type: "options" }] },// bloco herda da lâmina
  { id: "st_F", disabled: true, layers: [{ id: "ly_6", type: "options" }] },      // desativada: fora
];
const cols = colunasDoFunil(funil);

eq(cols.length, 5, "lâmina desativada não vira coluna");
eq(cols[0].header, "options: Faixa_Etaria", "bloco com webhookKey usa o dele");
eq(cols[1].header, "button: ly_2", "sem nome nenhum -> id do bloco (comportamento antigo)");
eq(cols[2].header, "passou: Roleta", "lâmina sem bloco respondível usa o webhookKey da LÂMINA");
eq(cols[3].header, "passou: st_D", "sem webhookKey na lâmina -> id da lâmina");
eq(cols[4].header, "options: Lamina", "bloco sem nome herda o da lâmina");

console.log("\n3) Renomear NÃO quebra a junção com as respostas");
eq(cols[0].stepId, "st_A", "stepId preservado");
eq(cols[0].layerId, "ly_1", "layerId preservado");
eq(cols[2].stepId, "st_C", "stepId da coluna Passou preservado");
ok(cols.every((c) => c.stepId && c.stepId.startsWith("st_")),
   "toda coluna aponta para o id REAL da lâmina, nunca para o rótulo");

console.log("\n4) Nomes repetidos não se sobrescrevem");
const dup = colunasDoFunil([
  { id: "s1", layers: [{ id: "l1", type: "field", webhookKey: "telefone", content: { name: "telefone" } }] },
  { id: "s2", layers: [{ id: "l2", type: "field", webhookKey: "telefone", content: { name: "telefone" } }] },
]);
eq(dup[0].key, "telefone", "primeiro fica com o nome limpo");
eq(dup[1].key, "telefone#2", "segundo ganha sufixo");
ok(dup[0].layerId !== dup[1].layerId, "e continuam ligados a blocos diferentes");

console.log("\n5) Cabeçalho de grupo acompanha");
const g = gruposDeColunas(cols);
eq(g.length, 5, "um grupo por lâmina ativa");
eq(g[0].stepId, "st_A", "grupo aponta para a lâmina");

console.log(falhas === 0 ? "\nOK — nenhuma falha." : `\n${falhas} FALHA(S).`);
process.exit(falhas === 0 ? 0 : 1);
