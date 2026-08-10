#!/usr/bin/env node
/**
 * Aplica uma migration no Postgres do Supabase.
 *
 *   node scripts/migrate.cjs 0019          → aplica 0019_*.sql
 *   node scripts/migrate.cjs --list        → mostra o que já foi aplicado
 *   node scripts/migrate.cjs 0019 --dry    → imprime o SQL, não executa
 *
 * POR QUE ESTE SCRIPT EXISTE
 * A SUPABASE_SERVICE_ROLE_KEY fala com o banco pela API REST, que NÃO executa
 * DDL (`create function`, `alter table`). Até aqui toda migration era colada à
 * mão no SQL Editor. Com a SUPABASE_DB_URL (Session pooler) dá pra aplicar
 * daqui, com transação e registro do que já rodou.
 *
 * SEGURANÇA
 * - Roda dentro de BEGIN/COMMIT: erro no meio faz ROLLBACK, nada fica pela metade.
 * - Registra em `_migrations`; re-aplicar exige --force (evita rodar duas vezes
 *   sem perceber).
 * - Nunca imprime a senha.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const DIR = path.join(RAIZ, "supabase", "migrations");

function urlDoBanco() {
  const env = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(env)) throw new Error(".env.local não encontrado");
  const url = (fs.readFileSync(env, "utf8").match(/^SUPABASE_DB_URL=(.*)$/m) || [])[1]?.trim();
  if (!url) throw new Error("SUPABASE_DB_URL ausente no .env.local (painel Supabase → Connect → Session pooler)");
  return url;
}

/** Esconde a senha ao mostrar o destino. */
const semSenha = (u) => u.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const force = args.includes("--force");
  const alvo = args.find((a) => !a.startsWith("--"));

  const { Client } = require("pg");
  const url = urlDoBanco();
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log("banco:", semSenha(url).replace(/^postgresql:\/\//, ""));

  // Controle de aplicadas. `if not exists` = seguro em banco que já rodou tudo à mão.
  await c.query(`create table if not exists public._migrations (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);

  if (!alvo || args.includes("--list")) {
    const { rows } = await c.query("select nome, aplicada_em from public._migrations order by nome");
    const noDisco = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    const feitas = new Set(rows.map((r) => r.nome));
    console.log("\nARQUIVO".padEnd(42) + "ESTADO");
    for (const f of noDisco) {
      const r = rows.find((x) => x.nome === f);
      console.log(f.padEnd(42) + (r ? `aplicada ${new Date(r.aplicada_em).toLocaleString("pt-BR")}` : feitas.size ? "PENDENTE" : "— (sem registro)"));
    }
    if (!feitas.size) console.log("\nNota: as migrations até a 0018 foram aplicadas à mão no SQL Editor,\npor isso não têm registro aqui. Só as novas são rastreadas.");
    await c.end();
    return;
  }

  const arquivo = fs.readdirSync(DIR).find((f) => f.startsWith(alvo) && f.endsWith(".sql"));
  if (!arquivo) throw new Error(`nenhuma migration começando com "${alvo}" em supabase/migrations/`);
  const sql = fs.readFileSync(path.join(DIR, arquivo), "utf8");

  if (dry) {
    console.log(`\n--- ${arquivo} (dry run, NADA foi executado) ---\n`);
    console.log(sql);
    await c.end();
    return;
  }

  const { rows: ja } = await c.query("select 1 from public._migrations where nome = $1", [arquivo]);
  if (ja.length && !force) {
    console.log(`\n${arquivo} JÁ foi aplicada. Use --force para rodar de novo.`);
    await c.end();
    return;
  }

  console.log(`\naplicando ${arquivo} …`);
  try {
    await c.query("begin");
    await c.query(sql);
    await c.query(
      "insert into public._migrations (nome) values ($1) on conflict (nome) do update set aplicada_em = now()",
      [arquivo],
    );
    await c.query("commit");
    console.log("OK — aplicada e registrada.");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.error("FALHOU (rollback feito, nada mudou):");
    console.error(" ", e.message);
    process.exitCode = 1;
  } finally {
    await c.end().catch(() => {});
  }
}

main().catch((e) => { console.error("erro:", e.message); process.exit(1); });
