/**
 * Check do filtro de período (`src/lib/quiz/periodo.ts`).
 *
 * POR QUE ESTE CHECK EXISTE
 * O tratamento de fuso deste módulo já quebrou DUAS vezes em produção. Com as
 * datas em UTC, das 21h à meia-noite o dia já virou lá fora: "Hoje" pedia o dia
 * SEGUINTE e a tela voltava vazia; "Ontem" mostrava hoje. Medido na época: 3 de
 * 6 horários testados devolviam o dia errado.
 *
 * O erro é invisível de dia — quem testa às 14h nunca vê. Por isso o teste
 * abaixo não usa "agora": monta horários fixos ao longo das 24 h e confere que
 * a janela é sempre o dia CIVIL de São Paulo.
 *
 * Importa o módulo real via type stripping do Node. Sem banco, sem rede.
 *
 * Uso:  node scripts/check-periodo.mjs
 */
import { janelaDeChave, dayBounds, rotuloDoPeriodo, PERIODOS } from "../src/lib/quiz/periodo.ts";

let falhas = 0;
const ok = (cond, msg) => { console.log(`   ${cond ? "OK  " : "FALHA"} ${msg}`); if (!cond) falhas++; };
const eq = (a, b, msg) => ok(a === b, `${msg}  (obtido: ${JSON.stringify(a)})`);

console.log("1) Um dia civil de SP = 24 h exatas, começando às 03:00 UTC");
const d = dayBounds("2026-08-07");
eq(d.from, "2026-08-07T03:00:00.000Z", "00:00 em SP = 03:00 UTC");
eq(d.to, "2026-08-08T02:59:59.999Z", "23:59:59.999 em SP = 02:59 UTC do dia seguinte");
const horas = (new Date(d.to) - new Date(d.from) + 1) / 3600000;
eq(horas, 24, "a janela cobre 24 h cheias, sem buraco nem sobreposição");

console.log("\n2) A janela NÃO se desloca conforme a hora em que o painel é aberto");
// É aqui que o bug morava: às 22h de SP já é o dia seguinte em UTC.
const base = dayBounds("2026-08-07");
for (const h of [0, 3, 9, 14, 20, 21, 23]) {
  const emUtc = new Date(Date.UTC(2026, 7, 7, h, 30));
  const dentro = emUtc >= new Date(base.from) && emUtc <= new Date(base.to);
  // 00:30 e 01:30 UTC do dia 07 ainda são dia 06 em SP — corretamente FORA.
  const esperado = h >= 3;
  ok(dentro === esperado, `${String(h).padStart(2, "0")}:30 UTC ${esperado ? "dentro" : "fora"} do dia 07/08 em SP`);
}

console.log("\n3) Dias consecutivos se encaixam sem sobreposição");
const d1 = dayBounds("2026-08-07"), d2 = dayBounds("2026-08-08");
ok(new Date(d1.to) < new Date(d2.from), "o fim do dia 07 vem antes do início do 08");
eq(new Date(d2.from) - new Date(d1.to), 1, "e a diferença é de 1 ms — nenhuma sessão cai fora dos dois");

console.log("\n4) Chave da URL vira janela (e entrada inválida não derruba a tela)");
eq(janelaDeChave("dia", "2026-08-07").janela.from, "2026-08-07T03:00:00.000Z", "?p=dia&d=2026-08-07");
eq(janelaDeChave("dia", "07/08/2026").key, "tudo", "data em formato BR e invalida -> cai em Tudo");
eq(janelaDeChave("dia").key, "tudo", "?p=dia sem &d= -> cai em Tudo");
eq(janelaDeChave("xpto").key, "tudo", "chave desconhecida -> Tudo (URL e editavel pelo usuario)");
eq(janelaDeChave(undefined).key, "tudo", "sem parametro -> Tudo");
eq(Object.keys(janelaDeChave("tudo").janela).length, 0, "Tudo nao envia filtro nenhum");
ok(!!janelaDeChave("hoje").janela.from && !!janelaDeChave("hoje").janela.to, "Hoje tem inicio E fim");
ok(!!janelaDeChave("7d").janela.from && !janelaDeChave("7d").janela.to, "7 dias tem inicio e vai ate agora");

console.log("\n5) Rótulos");
eq(rotuloDoPeriodo("dia", "2026-08-07"), "07/08/2026", "dia especifico sai em formato BR");
eq(rotuloDoPeriodo("7d"), "7 dias", "preset usa o proprio label");
eq(rotuloDoPeriodo("xpto"), "Tudo", "desconhecido cai em Tudo");
eq(PERIODOS.length, 5, "cinco presets");
eq(PERIODOS[0].key, "tudo", "o primeiro e o padrao");

console.log(falhas === 0 ? "\nOK — nenhuma falha." : `\n${falhas} FALHA(S).`);
process.exit(falhas === 0 ? 0 : 1);
