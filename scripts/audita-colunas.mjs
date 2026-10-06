/**
 * AUDITORIA DAS COLUNAS DE RESPOSTA — read-only.
 *
 *   node scripts/audita-colunas.mjs [slug]
 *
 * Mostra, para cada funil, que colunas a aba Leads e o CSV vão exibir — e
 * QUAIS AINDA TÊM ID OPACO, que é a lista de trabalho de quem vai nomear os
 * blocos no construtor.
 *
 * POR QUE .mjs E NÃO MAIS .cjs
 * A versão anterior mantinha uma cópia de `keyOf()` e da montagem de colunas.
 * A cópia envelheceu: não conhecia o kind `passou` (lâmina sem bloco
 * respondível), então listava 20 colunas no cdb-01 enquanto a tela mostrava
 * "Passou zSikDv" — auditoria que discorda da tela não serve para auditar.
 * Agora importa `src/lib/quiz/colunas.ts` direto, via type stripping do Node.
 *
 * Só SELECT em `funnels`. Não lê resposta, lead nem sessão.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { colunasDoFunil } from "../src/lib/quiz/colunas.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const linha of raw.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

/**
 * Coluna SEM NOME = a chave caiu no id gerado pela plataforma.
 *
 * Isto é exato, não heurístico: `colunasDoFunil` devolve `layerId`/`stepId`
 * junto, então "a chave é o id" responde a pergunta sem adivinhar. A versão
 * anterior testava o formato da string (`/^[a-z0-9_-]{6,12}$/i`) e marcava
 * `Filhos`, `Ocupacao` e `Faixa_Etaria` como opacos — nomes perfeitamente bons,
 * que apareciam na lista de "falta nomear".
 */
const semNome = (c) => c.key === c.layerId || c.key === c.stepId;

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const filtro = process.argv[2];

  let q = sb.from("funnels").select("slug,steps").order("slug");
  if (filtro) q = q.eq("slug", filtro);
  const { data, error } = await q;
  if (error) { console.error("erro:", error.message); process.exit(1); }

  let totalCols = 0, totalOpacas = 0, totalRepetidas = 0, totalMultiOpt = 0;
  for (const f of data) {
    if (!Array.isArray(f.steps)) continue;
    const cols = colunasDoFunil(f.steps);
    if (!cols.length) continue;

    const op = cols.filter(semNome);
    const rep = cols.filter((c) => c.key.includes("#"));
    // 2+ blocos de opções na MESMA lâmina: quiz_answers só tem step_id, então as
    // duas colunas recebem a mesma resposta. É o gatilho da migração de layer_id.
    const porStep = new Map();
    for (const c of cols) if (c.kind === "options") porStep.set(c.stepId, (porStep.get(c.stepId) ?? 0) + 1);
    const multi = [...porStep.entries()].filter(([, n]) => n >= 2);

    totalCols += cols.length; totalOpacas += op.length;
    totalRepetidas += rep.length; totalMultiOpt += multi.length;

    console.log(`\n${f.slug}  -  ${cols.length} colunas`);
    if (filtro) for (const c of cols) console.log(`   ${c.kind.padEnd(8)} ${c.key.padEnd(24)} (${c.stepTitle})`);
    if (op.length) console.log(`   ${op.length} SEM NOME: ${op.slice(0, 8).map((c) => c.key).join(", ")}${op.length > 8 ? "..." : ""}`);
    for (const [stepId, n] of multi) console.log(`   ALERTA: lamina ${stepId} tem ${n} blocos de opcoes`);
    for (const c of rep) console.log(`   chave repetida (desambiguada): ${c.key}`);
  }

  console.log(`\n${"=".repeat(62)}`);
  console.log(`colunas ................ ${totalCols}`);
  console.log(`sem nome (id opaco) .... ${totalOpacas}  <- preencher "ID / Nome" no construtor`);
  console.log(`chaves repetidas ....... ${totalRepetidas}`);
  console.log(`laminas com 2+ opcoes .. ${totalMultiOpt}  ${totalMultiOpt === 0 ? "-> migracao de layer_id NAO e necessaria" : "-> migracao de layer_id necessaria"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
