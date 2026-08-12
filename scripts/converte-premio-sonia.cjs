/**
 * Onda 2 da centralização — `premio-sonia` (tipado) → `layers`.
 *
 * O QUE ELE FAZ
 * Lê o funil publicado, salva o JSON original em specs/backups/ e cria um
 * `premio-sonia-v2` em DRAFT com o mesmo conteúdo rodando no motor layers.
 * O original NÃO é tocado — ele recebe 3.6 mil visitantes por mês, e a troca
 * do que está no ar só acontece depois que o Luca comparar os dois.
 *
 * POR QUE A CONVERSÃO É PEQUENA
 * O layers renderiza `scratch` pelo MESMO componente do motor tipado
 * (LayersRunner:288 → ScratchGrid). Converter é envolver o step num bloco-hero:
 * o `content` do bloco É o step tipado, campo por campo. Nada de reescrever a
 * raspadinha.
 *
 * O QUE NÃO PODE MUDAR
 *  - `id` da lâmina ("raspadinha"): `step_events.step_id` referencia ele, e a
 *    trava por aparelho é `ctf_scratch_<slug>_<id>` (ScratchGrid:302). Trocar o
 *    id faria quem já raspou raspar de novo e cortaria o histórico em dois.
 *  - contagem de lâminas ativas: `max_step_reached` é índice nessa lista.
 *
 * ATENÇÃO no v2: como o slug faz parte da chave da trava, no `-v2` ela é outra.
 * Isso é esperado no teste (permite raspar de novo); ao promover para o slug
 * real, a chave volta a ser a de sempre.
 *
 * Rodar:  node scripts/converte-premio-sonia.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const ORIGEM = "premio-sonia";
const DESTINO = "premio-sonia-v2";

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
 * Uma lâmina tipada vira uma lâmina layers com um bloco-hero só.
 * Vale para os tipos que o layers já trata como hero (roulette, scratch,
 * slider, measure, gauge, vsl, confirm) — LayersRunner:38.
 */
function heroParaLayers(step, i) {
  return {
    id: step.id,                    // PRESERVADO — ver cabeçalho
    title: step.title ? String(step.title).replace(/<[^>]+>/g, "").slice(0, 40) : `Lâmina ${i + 1}`,
    chosen: false,
    design: {},
    layers: [{
      id: `${step.id}-block`,
      type: step.type,
      title: step.type === "scratch" ? "Raspadinha" : step.type,
      content: step,                // o step tipado INTEIRO, sem tradução
    }],
    options: { show_progress: false },
    position: { x: i * 288, y: 0 },
    selected: false,
  };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: orig, error: e1 } = await db.from("funnels").select("*").eq("slug", ORIGEM).single();
  if (e1) throw e1;

  const ativas = (orig.steps || []).filter((s) => !s.disabled);
  if (ativas.length !== 1 || ativas[0].type !== "scratch") {
    // Guarda contra o funil ter mudado desde o levantamento: este conversor
    // assume 1 lâmina de raspadinha e nada mais.
    throw new Error(`Esperava 1 lâmina "scratch"; achei ${ativas.length} (${ativas.map((s) => s.type).join(", ")})`);
  }

  // BACKUP antes de qualquer escrita — rollback de um comando.
  const dir = join(__dirname, "..", "specs", "backups");
  mkdirSync(dir, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const arq = join(dir, `${ORIGEM}-${carimbo}.json`);
  writeFileSync(arq, JSON.stringify({ slug: orig.slug, steps: orig.steps, settings: orig.settings }, null, 2), "utf8");
  console.log(`backup: ${arq}`);

  const steps = orig.steps.map(heroParaLayers);
  const settings = {
    ...(orig.settings || {}),
    engine: "layers",
    // A raspadinha ocupa a tela inteira e traz o próprio fundo; o header do
    // funil ficaria por cima dela. Por isso tudo desligado — é o que o motor
    // tipado já fazia, que não desenha header nenhum nesta lâmina.
    header: { show_logo: false, show_progress: false, show_back: false },
    design: {
      ...((orig.settings || {}).design || {}),
      container: "max-w-[34rem]",
      themeColor: "#16a34a",
      backgroundColor: "#ffffff",
    },
  };

  const { data: jaExiste } = await db.from("funnels").select("id, status").eq("slug", DESTINO).maybeSingle();
  if (jaExiste) {
    if (jaExiste.status === "published") {
      console.error(`ABORTADO: ${DESTINO} está PUBLICADO. Não sobrescrevo funil no ar.`);
      process.exit(1);
    }
    const { error } = await db.from("funnels").update({ steps, settings }).eq("slug", DESTINO);
    if (error) throw error;
    console.log(`atualizado (draft): ${DESTINO}`);
  } else {
    const { error } = await db.from("funnels").insert({
      slug: DESTINO,
      name: `${orig.name} (layers)`,
      niche: orig.niche,
      palette_id: orig.palette_id,
      font: orig.font,
      status: "draft",
      domain: null,               // sem domínio: não disputa URL com o original
      steps,
      settings,
    });
    if (error) throw error;
    console.log(`criado (draft): ${DESTINO}`);
  }

  // Prova de que nada essencial se perdeu.
  const o = orig.steps[0], n = steps[0].layers[0].content;
  const iguais = ["id", "type", "ctaUrl", "revealPct", "columns", "oncePerDevice", "background", "coverText"]
    .filter((k) => JSON.stringify(o[k]) === JSON.stringify(n[k]));
  console.log(`campos conferidos iguais: ${iguais.length}/8 (${iguais.join(", ")})`);
  console.log(`cards: ${o.cards?.length} → ${n.cards?.length}`);
  console.log(`\ncompare:  /q/${ORIGEM}   ×   /q/${DESTINO}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
