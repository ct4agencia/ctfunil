/**
 * Cria o `cdb-insta` com a COPY do `cdb-insta-roleta` e a GRAMÁTICA VISUAL da
 * referência (artedaresina.com.br).
 *
 * O QUE É "modelar no resina", em concreto
 * A referência não é um tema — é um conjunto de decisões de forma que se
 * repetem em toda tela. Este script aplica as seis que importam:
 *
 *   1. pílula "Pergunta X de Y" acima do título, e NENHUMA barra de progresso
 *      nas outras lâminas (na referência a pílula é que localiza o visitante)
 *   2. título em peso 800 e `primaryDarker` — azul escuro, não cinza-ardósia,
 *      com a palavra-chave em `primary`
 *   3. opções com `preset: "resina"` (borda 1,5px, raio 16, sombra preta a 8%,
 *      check redondo de 18px) — os números saem de `lib/quiz/resina.ts`
 *   4. corpo em `muted`, nunca em cinza puro: cinza sem matiz é o que dá o ar
 *      de formulário
 *   5. cards claros com borda `softBorder` e sombra COLORIDA e larga
 *   6. CTA em degradê com halo da própria cor, caixa alta, 56px de altura
 *
 * O QUE NÃO MUDA
 *  - a copy: nenhuma palavra é reescrita, só reformatada
 *  - os ids de lâmina e de opção: `step_events.step_id` e `quiz_answers` os
 *    referenciam. Como isto nasce num slug NOVO não haveria risco, mas manter
 *    os ids deixa os dois funis comparáveis lâmina a lâmina no dashboard.
 *  - a lógica: destinos, campos, prêmio da roleta, pixel, webhooks
 *
 * SEGURANÇA
 * Lê o publicado, grava num slug novo em `draft` e sem domínio. Aborta se o
 * destino já tiver domínio. O `cdb-insta-roleta` nunca é escrito.
 *
 * Rodar:  node scripts/cria-cdb-insta.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const ORIGEM = "cdb-insta-roleta";
const DESTINO = "cdb-insta";
const TEMA = "#0284c7"; // sky-600 — a cor da referência

/** Mesmos fatores de `lib/quiz/resina.ts`. Duplicados de propósito: um script
 *  .cjs não importa o módulo TS, e uma cópia de 8 linhas é mais honesta que um
 *  passo de build só para isto. Se os fatores mudarem lá, mudam aqui. */
const clarear = (hex, f) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v) => Math.round(v + (255 - v) * f);
  return `#${((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0")}`;
};
const escurecer = (hex, f) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v) => Math.round(v * (1 - f));
  return `#${((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0")}`;
};

const T = {
  primary: TEMA,
  primaryDark: escurecer(TEMA, 0.17),
  primaryDarker: escurecer(TEMA, 0.41), // a cor do TÍTULO
  softBg: clarear(TEMA, 0.96),
  softBorder: clarear(TEMA, 0.86),
  muted: "#64748b",
};

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

const semTags = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Título no formato da referência: peso 800, azul escuro, palavra-chave em
 * `primary`. A chave é a palavra mais longa — carrega o sentido da frase, e
 * escolher por comprimento evita ter que manter uma lista à mão.
 */
function titulo(html, tamanho = 28) {
  const txt = semTags(html);
  if (!txt) return html;
  const chave = txt.split(/\s+/).filter((p) => p.length > 4).sort((a, b) => b.length - a.length)[0];
  const corpoTxt = chave
    ? txt.replace(chave, `<span style="color:${T.primary}">${chave}</span>`)
    : txt;
  return `<h2 class="ql-align-center" style="line-height:1.15;margin:0"><strong style="font-weight:800;font-size:${tamanho}px;color:${T.primaryDarker}">${corpoTxt}</strong></h2>`;
}

/** Corpo: `muted` (cinza AZULADO). Cinza puro é o que deixa a tela sem dono. */
const corpo = (html) =>
  `<p class="ql-align-center" style="line-height:1.55;margin:0"><span style="color:${T.muted};font-size:16px">${semTags(html)}</span></p>`;

async function main() {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: o, error } = await db.from("funnels").select("*").eq("slug", ORIGEM).single();
  if (error) throw error;

  const { data: ja } = await db.from("funnels").select("id,status,domain").eq("slug", DESTINO).maybeSingle();
  if (ja?.domain) { console.error(`ABORTADO: ${DESTINO} tem domínio (${ja.domain}).`); process.exit(1); }

  const dir = join(__dirname, "..", "specs", "backups");
  mkdirSync(dir, { recursive: true });
  const arq = join(dir, `${DESTINO}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  writeFileSync(arq, JSON.stringify({ origem: o.slug, steps: o.steps, settings: o.settings }, null, 2), "utf8");

  // Quais lâminas são pergunta: é o que decide onde entra a pílula "X de Y".
  const ehPergunta = (s) => (s.layers || []).some((l) => l.type === "options");
  const perguntas = o.steps.filter(ehPergunta).map((s) => s.id);

  let nTitulo = 0, nCorpo = 0, nOpcoes = 0, nBotao = 0, nCard = 0;

  const steps = o.steps.map((step) => {
    const layers = (step.layers || []).map((l) => {
      // OPÇÕES — o preset da referência. `icon: check` liga o círculo de 18px.
      if (l.type === "options") {
        nOpcoes++;
        return { ...l, design: { ...(l.design || {}), preset: "resina", icon: "check" },
                 content: { ...l.content, cols: "grid-cols-1" } };
      }
      // BOTÃO — degradê + halo, sem contorno, 56px como na referência.
      if (l.type === "button") {
        nBotao++;
        const d = { ...(l.design || {}), basis: 100, effect: "pulse", backgroundColor: TEMA, color: "#FFFFFF" };
        delete d.borderColor;
        delete d.hover;
        return { ...l, design: d };
      }
      // CARD — borda `softBorder` e sombra colorida larga (o "sombreamento sutil").
      if (l.type === "card") {
        nCard++;
        return { ...l, design: { ...(l.design || {}), variant: "suave", padding: 20 } };
      }
      // TEXTO — título vira 800/azul-escuro; corpo vira `muted`.
      if (l.type === "text" && typeof l.content?.text === "string") {
        const t = l.content.text;
        if (/^\s*<h[12]/i.test(t)) { nTitulo++; return { ...l, content: { ...l.content, text: titulo(t) } }; }
        if (semTags(t).length > 12) { nCorpo++; return { ...l, content: { ...l.content, text: corpo(t) } }; }
      }
      return l;
    });

    return {
      ...step,
      layers,
      // Cabeçalho ao modo da referência: logo só no hero e no fecho, e o
      // indicador de posição apenas nas perguntas — é de `show_progress` que o
      // LayersRunner deriva a pílula "Pergunta X de Y" e o seu denominador.
      headerOverride: {
        show_logo: step.id === "c01-hero" || step.id === "c12-resultado",
        show_progress: perguntas.includes(step.id),
        show_back: perguntas.includes(step.id),
      },
    };
  });

  const settings = {
    ...o.settings,
    engine: "layers",
    design: {
      ...(o.settings?.design || {}),
      themeColor: TEMA,
      backgroundColor: T.softBg,
      titleColor: T.primaryDarker,
      contentColor: T.muted,
      rounded: "rounded-2xl",   // raio 16 — o da referência
      elementSize: "56px",      // altura do botão e da opção
      contentSize: "16",
      container: "max-w-[34rem]",
      contentFont: "poppins",
      featuredFont: "poppins",
      botaoGradiente: [TEMA, T.primaryDark],
    },
  };

  const linha = {
    slug: DESTINO,
    name: `${o.name} (padrão Resina)`,
    niche: o.niche,
    palette_id: o.palette_id,
    font: "poppins",
    status: "draft",
    domain: null,
    steps,
    settings,
    utmify_pixel_id: o.utmify_pixel_id,
    hotmart_account_id: o.hotmart_account_id,
    hotmart_product_id: o.hotmart_product_id,
    checkout_url: o.checkout_url,
    webhooks: o.webhooks ?? [],
  };

  const { error: e2 } = ja
    ? await db.from("funnels").update(linha).eq("slug", DESTINO)
    : await db.from("funnels").insert(linha);
  if (e2) throw e2;

  // PROVAS — o que falharia silenciosamente se eu não medisse.
  const idsIguais = JSON.stringify(o.steps.map((s) => s.id)) === JSON.stringify(steps.map((s) => s.id));
  const conta = (arr) => arr.reduce((a, s) => a + (s.layers?.find((l) => l.type === "options")?.content?.options?.length || 0), 0);
  if (!idsIguais) throw new Error("ids de lâmina divergiram — o dashboard não conseguiria comparar os dois funis");
  if (conta(o.steps) !== conta(steps)) throw new Error(`opções mudaram: ${conta(o.steps)} → ${conta(steps)}`);

  console.log(`backup: ${arq}\n`);
  console.log(`${DESTINO} criado no padrão da referência:`);
  console.log(`  tema ${TEMA} · fundo ${T.softBg} · título ${T.primaryDarker} · corpo ${T.muted}`);
  console.log(`  ${nOpcoes} blocos de opção com preset resina + check redondo`);
  console.log(`  ${nTitulo} títulos peso 800 · ${nCorpo} corpos · ${nCard} cards · ${nBotao} botões sem contorno`);
  console.log(`  pílula "Pergunta X de Y" em ${perguntas.length} lâminas`);
  console.log(`  ids preservados · ${conta(steps)} opções intactas`);
  console.log(`\nver:  http://localhost:3010/q/${DESTINO}`);
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
