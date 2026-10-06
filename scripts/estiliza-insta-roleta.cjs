/**
 * Aplica o padrão visual da referência (artedaresina.com.br) no
 * `cdb-insta-roleta`. Funil DRAFT — nada vai ao ar sem o Luca publicar.
 *
 * O QUE MUDA
 *  - Design global: fundo azul-claríssimo, tema #0284c7, raio 20
 *  - Card nos trechos que a referência agrupa em caixa
 *  - Borda das opções de 4px para 2px (o Luca apontou "muito grandes")
 *  - Carrossel do mockup com fade
 *
 * O QUE NÃO MUDA
 *  - `id` de nenhuma lâmina nem de nenhuma opção: `step_events.step_id` e
 *    `quiz_answers` referenciam esses ids. Isto é ESTILO, não reestruturação.
 *  - a copy. Nenhum texto é reescrito.
 *  - a lógica: destinos, campos, prêmio da roleta, tracking.
 *
 * Rodar:  node scripts/estiliza-insta-roleta.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const ORIGEM = "cdb-insta-roleta";
const SLUG = "cdb-insta-roleta-v2";
const TEMA = "#0284c7";        // sky-600, o azul da referência
const TEMA_ESC = "#0369a1";

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

/** Card com texto rico, no formato que o bloco espera. */
const card = (id, html, variant = "suave") => ({
  id, type: "card", title: "Card",
  design: { basis: 100, variant, padding: 20 },
  content: { id: `c-${id}`, name: id, text: html },
});

async function main() {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: f, error } = await db.from("funnels").select("*").eq("slug", ORIGEM).single();
  if (error) throw error;
  // lê o publicado, grava numa CÓPIA draft — o original nunca é tocado

  const dir = join(__dirname, "..", "specs", "backups");
  mkdirSync(dir, { recursive: true });
  const arq = join(dir, `${SLUG}-estilo-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  writeFileSync(arq, JSON.stringify({ slug: f.slug, steps: f.steps, settings: f.settings }, null, 2), "utf8");
  console.log(`backup: ${arq}\n`);

  const idsAntes = JSON.stringify(f.steps.map((s) => s.id));

  const steps = f.steps.map((step) => {
    let layers = (step.layers || []).map((l) => {
      // OPÇÕES: borda de 4px para 2px. O Luca apontou como "muito grande"; a
      // referência usa contorno fino e deixa o peso visual para a sombra.
      if (l.type === "options") {
        return { ...l, design: { ...(l.design || {}), border: "border-[2px]", shadow: "shadow-md hover:shadow-lg" } };
      }
      // CARROSSEL do mockup: fade em vez de deslizar
      if (l.type === "carousel") {
        return { ...l, design: { ...(l.design || {}), transicao: "fade" }, content: { ...l.content, interval: 3 } };
      }
      return l;
    });

    // CARD nos trechos que a referência agrupa em caixa.
    const vira = (idBloco, variant) => {
      const i = layers.findIndex((l) => l.id === idBloco && l.type === "text");
      if (i >= 0) layers[i] = card(idBloco, layers[i].content.text, variant);
    };
    if (step.id === "c02-prep") vira("c02-txt", "suave");
    if (step.id === "c10-giro") vira("c10-txt", "suave");
    if (step.id === "c12-resultado") { vira("c12-txt", "suave"); vira("c12-alerta", "escuro"); }

    return { ...step, layers };
  });

  // PROVAS: isto é estilo, não reestruturação.
  const idsDepois = JSON.stringify(steps.map((s) => s.id));
  if (idsAntes !== idsDepois) throw new Error("ids das lâminas mudaram — abortado");
  const conta = (arr) => arr.reduce((a, s) => a + (s.layers?.find((l) => l.type === "options")?.content.options.length || 0), 0);
  if (conta(f.steps) !== conta(steps)) throw new Error(`opções mudaram: ${conta(f.steps)} → ${conta(steps)}`);

  const settings = {
    ...f.settings,
    engine: "layers",
    design: {
      ...(f.settings.design || {}),
      themeColor: TEMA,
      backgroundColor: "#f0f9ff",   // o "azulzinho bem fraco", medido na referência
      titleColor: "#0f172a",
      contentColor: "#334155",
      rounded: "rounded-[20px]",
      contentSize: "16",
      container: "max-w-[34rem]",
      contentFont: "poppins", featuredFont: "poppins",
      botaoGradiente: [TEMA, TEMA_ESC],
    },
  };

  const { data: ja } = await db.from("funnels").select("id").eq("slug", SLUG).maybeSingle();
  if (ja) {
    const { error: e2 } = await db.from("funnels").update({ steps, settings }).eq("slug", SLUG);
    if (e2) throw e2;
  } else {
    const { error: e2 } = await db.from("funnels").insert({
      slug: SLUG, name: `${f.name} (novo padrão)`, niche: f.niche,
      palette_id: f.palette_id, font: f.font, status: "draft", domain: null,
      steps, settings,
      utmify_pixel_id: f.utmify_pixel_id, hotmart_account_id: f.hotmart_account_id,
      hotmart_product_id: f.hotmart_product_id, checkout_url: f.checkout_url, webhooks: f.webhooks ?? [],
    });
    if (e2) throw e2;
  }

  const cards = steps.reduce((a, s) => a + (s.layers?.filter((l) => l.type === "card").length || 0), 0);
  console.log("aplicado:");
  console.log(`  tema ${TEMA} · fundo #f0f9ff · raio 20`);
  console.log(`  ${cards} cards · borda das opções 2px · carrossel em fade`);
  console.log(`  ids preservados · ${conta(steps)} opções intactas`);
  console.log(`\nver:  /q/${SLUG}`);
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
