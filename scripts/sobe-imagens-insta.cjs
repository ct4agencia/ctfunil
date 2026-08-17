/**
 * Sobe as três imagens do `cdb-insta` para o Storage e imprime as URLs.
 *
 * Elas vivem fora do repo (`Documents\CT4\TECH\CLAUDE CODE\quizzfunel\...`) e
 * pesam ~350 KB juntas. Commitar imagem de campanha no repo incha o clone para
 * sempre; `vsl-assets` já é o bucket de onde os outros funis servem as suas.
 *
 * Não escreve em tabela nenhuma — só sobe e imprime. Quem aponta as imagens no
 * funil é o passo seguinte, à parte, para este script poder ser rodado de novo
 * sem risco.
 *
 * Rodar:  node scripts/sobe-imagens-insta.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const ORIGEM = join(process.env.USERPROFILE || "", "Documents", "CT4", "TECH", "CLAUDE CODE", "quizzfunel", "quizzfunel x inlead");
const BUCKET = "vsl-assets";

const ARQUIVOS = [
  { local: "cdb-insta1.jpeg",          destino: "cdb-insta/fundo.jpeg",    papel: "fundo do funil (a 50%)" },
  { local: "cdb-insta2-apostila.jpeg", destino: "cdb-insta/apostila.jpeg", papel: "capa da apostila (etapa 2)" },
  { local: "botão-hero.webp",          destino: "cdb-insta/botao.webp",    papel: "botão do hero" },
];

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

const tipo = (n) => (n.endsWith(".webp") ? "image/webp" : n.endsWith(".png") ? "image/png" : "image/jpeg");

async function main() {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const a of ARQUIVOS) {
    const caminho = join(ORIGEM, a.local);
    if (!existsSync(caminho)) { console.error(`FALTA: ${caminho}`); process.exitCode = 1; continue; }
    const bin = readFileSync(caminho);
    const { error } = await db.storage.from(BUCKET).upload(a.destino, bin, { contentType: tipo(a.local), upsert: true });
    if (error) { console.error(`FALHOU ${a.local}: ${error.message}`); process.exitCode = 1; continue; }
    const { data } = db.storage.from(BUCKET).getPublicUrl(a.destino);
    console.log(`${a.papel}\n  ${data.publicUrl}  (${Math.round(bin.length / 1024)} KB)\n`);
  }
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
