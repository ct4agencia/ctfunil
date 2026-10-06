/**
 * Check da régua de intensidade da roleta (/lab/roleta).
 *
 * A PERGUNTA QUE ELE RESPONDE
 * "O peso de cada modelo está fluindo corretamente?" — ou seja: puxar a régua
 * para +10 realmente intensifica a característica DAQUELE preset, e para -10
 * realmente a suaviza?
 *
 * Isso não dá para conferir olhando a tabela de direções, por dois motivos:
 *  1. `LIMITES` corta o resultado. Um parâmetro que já nasce perto do teto
 *     (ex.: "Roda pesada" tem voltas 8, teto 10) sobe menos do que a amplitude
 *     promete — pode até nem sair do lugar.
 *  2. O arredondamento (`passo`) pode engolir variações pequenas.
 * Por isso o teste mede o resultado REAL de `comIntensidade`, o mesmo código
 * que a página executa.
 *
 * Uso:  node scripts/check-roleta.mjs
 */
// Importa a FONTE (lib), não o re-export do laboratório: aquele usa o alias
// `@/`, que o Next resolve mas o Node puro não — e este check roda em Node puro.
import { PRESETS, comIntensidade, LIMITES, ESCALA } from "../src/lib/quiz/roleta-fisica.ts";

let falhas = 0;
const ok = (cond, msg) => { console.log(`   ${cond ? "OK  " : "FALHA"} ${msg}`); if (!cond) falhas++; };

/** O que cada preset PROMETE quando a régua sobe. Espelha a descrição na tela. */
const PROMESSAS = {
  "Cassino clássico": [
    ["overshoot", "sobe", "mais teatral = passa mais do ponto"],
    ["pedagio", "sobe", "mais teatral = pino segura mais"],
    ["amortecimento", "desce", "mais teatral = balança mais"],
  ],
  "Suspense": [
    ["pedagio", "sobe", "mais suspense = pino segura mais"],
    ["limiarCatraca", "sobe", "mais suspense = o drama começa antes"],
    ["duracaoAlvo", "sobe", "mais suspense = demora mais"],
  ],
  "Rápido e limpo": [
    ["duracaoAlvo", "desce", "mais rápido = menos tempo"],
    ["voltas", "desce", "mais rápido = menos voltas"],
    ["overshoot", "desce", "mais limpo = sem recuo"],
    ["pedagio", "desce", "mais limpo = pino não segura"],
    ["rigidez", "sobe", "mais limpo = encaixe seco"],
  ],
  "Roda pesada": [
    ["voltas", "sobe", "mais pesada = gira mais"],
    ["duracaoAlvo", "sobe", "mais pesada = demora mais"],
    ["rigidez", "desce", "mais pesada = mola preguiçosa"],
  ],
  "Nervosa": [
    ["amortecimento", "desce", "mais balanço = menos amortecimento"],
    ["overshoot", "sobe", "mais balanço = passa mais do ponto"],
  ],
  "Quase não passa": [
    ["pedagio", "sobe", "mais hesitação = pino segura mais"],
    ["limiarCatraca", "sobe", "mais hesitação = catraca começa antes"],
  ],
};

console.log("1) A régua move o que cada preset PROMETE mover\n");

for (const pr of PRESETS) {
  const promessas = PROMESSAS[pr.nome];
  if (!promessas) {
    // "Personalizado" não tem régua — direção vazia é intencional
    if (Object.keys(pr.dir).length === 0) {
      console.log(`   OK   ${pr.nome}: sem régua, como esperado\n`);
    } else {
      console.log(`   FALHA ${pr.nome}: tem direção mas não tem promessa declarada\n`);
      falhas++;
    }
    continue;
  }

  console.log(`  ── ${pr.nome}  (${pr.eixo})`);
  const min = comIntensidade(pr.params, pr.dir, -ESCALA);
  const zero = comIntensidade(pr.params, pr.dir, 0);
  const max = comIntensidade(pr.params, pr.dir, ESCALA);

  ok(JSON.stringify(zero) === JSON.stringify(pr.params), "em 0 devolve o preset intacto");

  for (const [campo, sentido, porque] of promessas) {
    const a = min[campo], z = zero[campo], b = max[campo];
    const bateu = sentido === "sobe" ? b > z : b < z;
    ok(bateu, `${campo}: ${a} ← ${z} → ${b}   (${porque})`);
    const espelhou = sentido === "sobe" ? a < z : a > z;
    ok(espelhou, `${campo}: -${ESCALA} vai para o lado oposto`);
  }
  console.log("");
}

console.log("2) Nada escapa dos limites em nenhum ponto da régua");
let estourou = 0;
for (const pr of PRESETS) {
  for (const n of [-ESCALA, -5, 0, 5, ESCALA]) {
    const r = comIntensidade(pr.params, pr.dir, n);
    for (const [campo, [lo, hi]] of Object.entries(LIMITES)) {
      if (r[campo] < lo || r[campo] > hi) {
        ok(false, `${pr.nome} em ${n}: ${campo}=${r[campo]} fora de [${lo}, ${hi}]`);
        estourou++;
      }
    }
  }
}
if (!estourou) ok(true, "todos os presets ficam dentro dos limites em -10/-5/0/+5/+10");

console.log("\n3) A régua não é decorativa: em +10 algo mudou de verdade");
for (const pr of PRESETS) {
  if (Object.keys(pr.dir).length === 0) continue;
  const z = comIntensidade(pr.params, pr.dir, 0);
  const b = comIntensidade(pr.params, pr.dir, ESCALA);
  const mudou = Object.keys(pr.dir).filter((k) => b[k] !== z[k]);
  ok(mudou.length > 0, `${pr.nome}: ${mudou.length}/${Object.keys(pr.dir).length} parâmetros mudaram (${mudou.join(", ") || "NENHUM"})`);
}

console.log("\n4) Onde a régua promete e o limite não deixa entregar");
let notas = 0;
for (const pr of PRESETS) {
  for (const k of Object.keys(pr.dir)) {
    const [lo, hi] = LIMITES[k];
    const z = comIntensidade(pr.params, pr.dir, 0)[k];
    const b = comIntensidade(pr.params, pr.dir, ESCALA)[k];
    const a = comIntensidade(pr.params, pr.dir, -ESCALA)[k];
    if (b === z && a === z) {
      console.log(`   AVISO  ${pr.nome}.${k} NÃO SE MOVE (fixo em ${z}, limites [${lo},${hi}])`);
      notas++;
    } else if (b === hi || a === lo) {
      console.log(`   nota   ${pr.nome}.${k} bate no limite (${a} ← ${z} → ${b}, teto [${lo},${hi}])`);
      notas++;
    }
  }
}
if (!notas) console.log("   nenhum parâmetro travado — todos têm folga nos dois sentidos");

console.log(falhas === 0 ? "\nOK — nenhuma falha." : `\n${falhas} FALHA(S).`);
process.exit(falhas === 0 ? 0 : 1);
