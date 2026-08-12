/**
 * Promove `premio-sonia-v2` (layers, já validado) para o slug real `premio-sonia`.
 *
 * O funil está NO AR e recebendo tráfego. Por isso:
 *  - só duas colunas mudam: `steps` e `settings`. A LINHA não é apagada nem
 *    recriada, então `id`, `slug`, `domain`, `status` e `palette_id` seguem
 *    exatamente como estão;
 *  - nenhuma tabela de lead é tocada (`funnel_sessions`, `funnel_leads`,
 *    `quiz_answers`, `step_events`);
 *  - o id da lâmina continua "raspadinha", então a trava por aparelho
 *    (`ctf_scratch_premio-sonia_raspadinha`) e o histórico em `step_events`
 *    continuam apontando para o mesmo lugar.
 *
 * Quem já está com a página aberta termina no formato antigo — aquele JSON já
 * foi para o cliente. Quem carregar depois pega o novo. Não existe estado
 * intermediário quebrado.
 *
 * Rodar:
 *   node scripts/promove-premio-sonia.cjs            # promove
 *   node scripts/promove-premio-sonia.cjs --rollback # volta pro backup
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const ALVO = "premio-sonia";
const FONTE = "premio-sonia-v2";

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

function db() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** O backup mais recente salvo pelo converte-premio-sonia.cjs. */
function ultimoBackup() {
  const dir = join(__dirname, "..", "specs", "backups");
  const arqs = readdirSync(dir).filter((f) => f.startsWith(`${ALVO}-`) && f.endsWith(".json")).sort();
  if (!arqs.length) throw new Error(`nenhum backup de ${ALVO} em ${dir}`);
  return join(dir, arqs[arqs.length - 1]);
}

async function rollback() {
  const arq = ultimoBackup();
  const bak = JSON.parse(readFileSync(arq, "utf8"));
  const { error } = await db().from("funnels").update({ steps: bak.steps, settings: bak.settings }).eq("slug", ALVO);
  if (error) throw error;
  console.log(`ROLLBACK feito a partir de ${arq}`);
  console.log(`${ALVO} voltou ao motor tipado.`);
}

async function promover() {
  const cli = db();

  const { data: v2, error: e1 } = await cli.from("funnels").select("steps, settings").eq("slug", FONTE).single();
  if (e1) throw e1;
  const { data: alvo, error: e2 } = await cli.from("funnels").select("steps, settings, status, domain").eq("slug", ALVO).single();
  if (e2) throw e2;

  // GUARDAS — qualquer uma que falhe aborta ANTES de escrever. São as coisas
  // que, se mudassem sem ninguém ver, quebrariam o funil de um jeito silencioso.
  const lam = v2.steps?.[0];
  const conteudo = lam?.layers?.[0]?.content;
  const antes = alvo.steps?.[0];
  if (v2.settings?.engine !== "layers") throw new Error("v2 não está com engine=layers");
  if (v2.steps?.length !== 1) throw new Error(`v2 tem ${v2.steps?.length} lâminas; esperava 1`);
  if (lam?.id !== "raspadinha") throw new Error(`id da lâmina do v2 é "${lam?.id}"; tem que ser "raspadinha" (trava + histórico)`);
  if (conteudo?.type !== "scratch") throw new Error("o bloco do v2 não é uma raspadinha");
  if (conteudo?.cards?.length !== antes?.cards?.length) {
    throw new Error(`nº de cards mudou: ${antes?.cards?.length} → ${conteudo?.cards?.length}`);
  }
  const premiado = (s) => (s.cards || []).findIndex((x) => Number(x.weight) === 100);
  if (premiado(conteudo) !== premiado(antes)) throw new Error("o card premiado mudou de posição");
  if (conteudo.ctaUrl !== antes.ctaUrl) throw new Error("o destino do clique (ctaUrl) mudou");

  console.log("guardas OK:");
  console.log(`  engine=layers · 1 lâmina · id="raspadinha" · ${conteudo.cards.length} cards`);
  console.log(`  card premiado no índice ${premiado(conteudo)} · ctaUrl preservado`);

  // A ESCRITA: duas colunas, uma linha. `status` e `domain` nem entram no update.
  const { error } = await cli.from("funnels")
    .update({ steps: v2.steps, settings: { ...v2.settings, engine: "layers" } })
    .eq("slug", ALVO);
  if (error) throw error;

  const { data: depois } = await cli.from("funnels").select("settings, steps, status, domain").eq("slug", ALVO).single();
  console.log(`\n${ALVO} promovido.`);
  console.log(`  motor: ${depois.settings?.engine}   status: ${depois.status}   domain: ${depois.domain ?? "(sem)"}`);
  console.log(`  lâminas: ${depois.steps.length}   id: ${depois.steps[0].id}`);
  console.log(`\nSe algo sair errado:  node scripts/promove-premio-sonia.cjs --rollback`);
}

const main = process.argv.includes("--rollback") ? rollback : promover;
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
