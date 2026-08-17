/**
 * Reformata a COPY do `cdb-insta-roleta-v2` no padrão da referência.
 *
 * O QUE ESTAVA ERRADO
 * Apliquei tema, fundo e cards, mas o HTML dos textos continuou com a
 * formatação do seed: corpo em `rgb(64,64,64)` (cinza morto), pílula em verde
 * (do tempo em que o funil nasceu teal) e laranja herdado do padrão da casa.
 * Resultado: moldura nova, conteúdo velho — e a pílula da roleta laranja num
 * funil azul.
 *
 * O QUE MUDA (só formatação; nenhuma palavra é reescrita)
 *  - corpo: cinza puro → #334155 (cinza AZULADO, conversa com o tema)
 *  - título: peso 900, #0f172a, com a palavra-chave em #0284c7
 *  - pílula: verde/laranja → gradiente do tema
 *
 * Rodar:  node scripts/copy-insta-v2.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const SLUG = "cdb-insta-roleta-v2";
const TEMA = "#0284c7";        // azul claro — destaque
const TEMA_CLARO = "#38bdf8";
const TITULO = "#0f172a";      // azul escuro — título
const CORPO = "#334155";       // cinza azulado — corpo

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

/**
 * Troca as cores mortas e as herdadas de outra paleta pelas do tema.
 * Regex e não parser: este HTML é gerado por nós, tem forma conhecida, e um
 * parser completo seria peso sem retorno.
 */
function recolore(html) {
  if (!html) return html;
  return String(html)
    // corpo cinza morto → cinza azulado
    .replace(/color:\s*rgb\(64,\s*64,\s*64\)/gi, `color: ${CORPO}`)
    .replace(/color:\s*rgb\(110,\s*110,\s*110\)/gi, `color: ${CORPO}`)
    // pílula: qualquer degradê de outra paleta vira o do tema
    .replace(/linear-gradient\(95deg,\s*#0f766e,\s*#14b8a6\)/gi, `linear-gradient(95deg, ${TEMA}, ${TEMA_CLARO})`)
    .replace(/linear-gradient\(95deg,\s*#ea580c,\s*#f28947\)/gi, `linear-gradient(95deg, ${TEMA}, ${TEMA_CLARO})`)
    .replace(/rgba\(15,\s*118,\s*110,\s*\.55\)/gi, "rgba(2,132,199,.45)")
    .replace(/rgba\(234,\s*88,\s*12,\s*\.55\)/gi, "rgba(2,132,199,.45)")
    // cores soltas das paletas antigas
    .replace(/#0f766e/gi, TEMA)
    .replace(/#14b8a6/gi, TEMA_CLARO)
    .replace(/#ea580c/gi, TEMA)
    .replace(/#f28947/gi, TEMA_CLARO)
    .replace(/rgb\(234,\s*88,\s*12\)/gi, TEMA);
}

/** Título: peso 900, azul escuro, com o trecho entre ==…== em azul claro. */
const titulo = (txt) =>
  `<h2 class="ql-align-center" style="line-height:1.18"><strong style="font-weight:900;color:${TITULO};font-size:26px">${
    String(txt).replace(/==([^=]+)==/g, `<span style="color:${TEMA}">$1</span>`)
  }</strong></h2>`;

async function main() {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: f, error } = await db.from("funnels").select("*").eq("slug", SLUG).single();
  if (error) throw error;
  if (f.status === "published") { console.error("ABORTADO: publicado."); process.exit(1); }

  const dir = join(__dirname, "..", "specs", "backups");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${SLUG}-copy-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`),
    JSON.stringify({ slug: f.slug, steps: f.steps }, null, 2), "utf8");

  /** A palavra mais longa carrega o sentido — é ela que vira o destaque. */
  const destaca = (h) => {
    const limpo = String(h).replace(/<[^>]+>/g, "").trim();
    if (!limpo) return h;
    const chave = limpo.split(/\s+/).filter((p) => p.length > 4).sort((a, b) => b.length - a.length)[0];
    return titulo(chave ? limpo.replace(chave, `==${chave}==`) : limpo);
  };

  let recolorido = 0, titulado = 0, roleta = 0;
  const steps = f.steps.map((step) => ({
    ...step,
    layers: (step.layers || []).map((l) => {
      // BLOCOS-HERO (roleta): o `content` é o step tipado — a pílula laranja do
      // Luca vive no winTitle/winBody dele, não num bloco de texto.
      if (["roulette", "scratch", "vsl", "confirm"].includes(l.type)) {
        const c = { ...l.content };
        for (const k of ["title", "subtitle", "winTitle", "winBody", "winCta"]) {
          if (typeof c[k] === "string") { const n = recolore(c[k]); if (n !== c[k]) { c[k] = n; roleta++; } }
        }
        if (c.popupBg) { c.popupBg = TEMA; roleta++; }
        return { ...l, content: c };
      }
      if (!["text", "card", "alert"].includes(l.type)) return l;
      const antes = l.content?.text || "";
      let depois = recolore(antes);
      if (/^<h2/.test(depois)) { depois = destaca(depois); titulado++; }
      else if (depois !== antes) recolorido++;
      return { ...l, content: { ...l.content, text: depois } };
    }),
  }));

  const { error: e2 } = await db.from("funnels").update({ steps }).eq("slug", SLUG);
  if (e2) throw e2;

  console.log("copy reformatada:");
  console.log(`  ${titulado} títulos → peso 900, ${TITULO}, palavra-chave em ${TEMA}`);
  console.log(`  ${recolorido} textos → corpo ${CORPO} (era cinza morto)`);
  console.log(`  ${roleta} campos da roleta → pílula/popup no tema (era laranja)`);
  console.log(`\nver: /q/${SLUG}`);
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
