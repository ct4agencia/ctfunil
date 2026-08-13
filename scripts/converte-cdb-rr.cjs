/**
 * Onda 2 — `cdb-rr` (motor tipado) → `layers`. Último funil no motor antigo.
 *
 * Cria `cdb-rr-v2` em DRAFT. O original não é tocado.
 *
 * O QUE É PRESERVADO E POR QUÊ
 *  - `id` de CADA lâmina: `step_events.step_id` referencia esses ids. Trocar um
 *    id corta o histórico do funil em dois.
 *  - contagem de lâminas ATIVAS: `max_step_reached` é índice nessa lista.
 *  - `nameId`/`phoneId` da captura ("nome"/"telefone"): viram o `name` do campo,
 *    que é o nome da COLUNA no CSV de leads. Mudar renomeia coluna do histórico.
 *  - pixels, checkout e webhooks: são próprios deste funil, não do cdb-01.
 *
 * SOBRE A COPY
 * O motor tipado renderiza texto por um formatador próprio: `==x==` vira pílula
 * destacada, `**x**` vira negrito. O layers guarda HTML puro. A conversão
 * traduz as duas marcações — sem isso o lead leria "==reconhecimento==" com os
 * sinais de igual na tela.
 *
 * Rodar:  node scripts/converte-cdb-rr.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const ORIGEM = "cdb-rr";
const DESTINO = "cdb-rr-v2";
const TEMA = "#ea580c";

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

// ── copy: marcações do motor tipado → HTML ──────────────────────────
const PILULA = `display:inline-block;margin:0 2px;border-radius:0.75rem;padding:0.1rem 0.6rem;font-weight:800;color:#ffffff;background:linear-gradient(95deg, ${TEMA}, #f28947);box-shadow:0 6px 16px -6px rgba(234,88,12,.55);`;

/** `==x==` → pílula, `**x**` → negrito. */
function rico(txt) {
  if (!txt) return "";
  return String(txt)
    .replace(/==([^=]+)==/g, `<span style="${PILULA}">$1</span>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
const H2 = (t) => (t ? `<h2 class="ql-align-center"><span style="font-weight: bolder;">${rico(t)}</span></h2>` : "");
const P = (t) =>
  !t ? "" : String(t).split(/\n\n+/).map((par) =>
    `<p class="ql-align-center"><span style="color: rgb(64, 64, 64);">${rico(par).replace(/\n/g, "<br>")}</span></p>`
  ).join("");

// ── blocos ──────────────────────────────────────────────────────────
const texto = (id, html) => ({ id, type: "text", title: "Texto", design: [], content: { id: `c-${id}`, name: id, text: html } });

const botao = (id, label) => ({
  id, type: "button", title: "Botão",
  design: { basis: 100, fixed: false, pulse: true, style: "theme", bubble: true, effect: "pulse" },
  content: { id: `c-${id}`, name: id, type: "next", label: label || "Continuar", pulse: false, target: false, destination: "next" },
});

const imagem = (id, src) => ({
  id, type: "image", design: { basis: 100 },
  content: { id: `c-${id}`, image: { src, type: "image" } },
});

const alerta = (id, html) => ({
  id, type: "alert", title: "Alerta", design: { basis: 100, style: "warning" },
  content: { id: `c-${id}`, name: id, text: `<p>${rico(html)}</p>` },
});

const espaco = (id, alt) => ({ id, type: "clear", title: "Espaço", design: [], content: { id: `c-${id}`, name: id, clear: `h-[${alt}]` } });

const campo = (id, nome, tipo, titulo, placeholder, extra = {}) => ({
  id, type: "field", title: "Campo", design: [],
  content: { id: `c-${id}`, name: nome, type: tipo, title: titulo, required: true, placeholder, ...extra },
});

const opcoes = (id, nome, itens) => ({
  id, type: "options", title: "Opções",
  design: {
    gap: "gap-2", grid: "grid-cols-1", icon: "select", basis: 100, order: "default",
    border: "border-[4px]", shadow: "shadow-md hover:shadow-lg", background: "contrast",
    orientation: "vertical", iconPosition: "end", transparentImage: true,
  },
  content: {
    id: `c-${id}`, name: nome, cols: "grid-cols-1", order: "default", required: true, orientation: "vertical",
    options: itens.map((o, i) => ({
      // id estável e legível: é assim que a resposta aparece no relatório
      id: `${nome}-${i + 1}`,
      label: `<p>${rico(o.label)}</p>`, chosen: false, selected: false, destination: "next",
      ...(o.emoji ? { image: { src: o.emoji, type: "emoji" } } : {}),
    })),
  },
});

/** Anel de porcentagem do `result` — mesmo bloco que o cdb-01 usa. */
const grafico = (id, percent, legendaHtml) => ({
  id, type: "graphics", title: "Métricas", design: { basis: 100 },
  content: {
    id: `c-${id}`, cols: "grid-cols-1", name: id, order: "default",
    graphics: [{ id: `g-${id}`, type: "chart", style: "#16a34a", chosen: false, selected: false, legend: legendaHtml, percent: String(percent) }],
  },
});

/** Uma lâmina layers. `id` vem do step original — nunca gerado. */
const lamina = (step, i, blocos, progresso = true) => ({
  id: step.id,
  title: (step.title || step.question || step.type || `Lâmina ${i + 1}`).replace(/<[^>]+>/g, "").replace(/==/g, "").slice(0, 40),
  chosen: false,
  design: {},
  layers: blocos.filter(Boolean),
  options: { show_progress: progresso },
  position: { x: i * 288, y: 0 },
  selected: false,
  ...(step.disabled ? { disabled: true } : {}),
});

/** Blocos-hero: o `content` É o step tipado, sem tradução. */
const HERO = new Set(["roulette", "vsl", "scratch", "measure", "gauge", "slider", "confirm"]);

function converte(step, i) {
  const id = step.id;
  if (HERO.has(step.type)) {
    return lamina(step, i, [{ id: `${id}-block`, type: step.type, title: step.type, content: step }], false);
  }

  switch (step.type) {
    case "question":
      return lamina(step, i, [
        espaco(`${id}-sp`, "1rem"),
        texto(`${id}-tit`, H2(step.question)),
        step.help ? texto(`${id}-help`, P(step.help)) : null,
        opcoes(`${id}-opt`, id, step.options || []),
      ]);

    case "loading":
      // vira o bloco `loading` do layers; o "checklist" do tipado tem
      // equivalente direto (barras rotuladas), então o desenho se mantém.
      return lamina(step, i, [{
        id: `${id}-block`, type: "loading", title: "Loading", design: { basis: 100 },
        content: {
          id: `c-${id}`, name: id, title: step.title,
          bars: step.bars,
          seconds: Math.round((step.durationMs ?? 4200) / 1000),
          type: "advance", destination: "next",
          description: step.slides?.[0],
        },
      }], false);

    case "hero":
      return lamina(step, i, [
        step.badge ? texto(`${id}-badge`, P(step.badge)) : null,
        texto(`${id}-tit`, H2(step.title)),
        step.subtitle ? texto(`${id}-sub`, P(step.subtitle)) : null,
        step.gallery?.length
          ? { id: `${id}-gal`, type: "carousel", title: "Carrossel", design: { basis: 100 },
              content: { id: `c-${id}-gal`, name: `${id}-gal`, images: step.gallery, interval: Math.max(1, Math.round((step.gallerySpeed ?? 6) / 2)) } }
          : null,
        botao(`${id}-btn`, step.cta),
      ], false);

    case "result": {
      // `range` [min,max] com os dois iguais = valor fixo.
      const pct = Array.isArray(step.range) ? step.range[1] : 94;
      const legenda = [
        H2(step.approvedTitle || step.subtitle),
        P(step.approvedBody),
        step.minShown ? P(`O mínimo necessário era ${step.minShown}%.`) : "",
      ].join("");
      return lamina(step, i, [
        texto(`${id}-tit`, H2(step.title)),
        grafico(`${id}-anel`, pct, legenda),
        step.body ? texto(`${id}-body`, P(step.body)) : null,
        botao(`${id}-btn`, step.cta),
      ]);
    }

    case "offer": {
      const stats = (step.stats || []).map((s) => `<strong>${s.value}</strong> ${s.label}`).join(" · ");
      return lamina(step, i, [
        step.badge ? texto(`${id}-badge`, P(step.badge)) : null,
        texto(`${id}-tit`, H2(step.title)),
        step.image ? imagem(`${id}-img`, step.image) : null,
        stats ? texto(`${id}-stats`, P(stats)) : null,
        step.body ? texto(`${id}-body`, P(step.body)) : null,
        step.giftTitle ? texto(`${id}-gift`, [H2(step.giftTitle), P(step.giftBody)].join("")) : null,
        botao(`${id}-btn`, step.cta),
      ]);
    }

    case "capture":
      return lamina(step, i, [
        texto(`${id}-tit`, H2(step.title)),
        step.body ? texto(`${id}-body`, P(step.body)) : null,
        step.image ? imagem(`${id}-img`, step.image) : null,
        step.note ? alerta(`${id}-note`, step.note) : null,
        // nameId/phoneId viram o `name` do campo = nome da coluna no CSV
        campo(`${id}-nome`, step.nameId || "nome", "text", step.nameLabel, step.namePlaceholder),
        campo(`${id}-fone`, step.phoneId || "telefone", "phone", step.phoneLabel, step.phonePlaceholder, { mask: "phone_br" }),
        step.secure ? texto(`${id}-sec`, P(step.secure)) : null,
        botao(`${id}-btn`, step.cta),
      ]);

    case "post_capture":
    case "bridge":
      return lamina(step, i, [
        texto(`${id}-tit`, H2(step.title)),
        step.body ? texto(`${id}-body`, P(step.body)) : null,
        step.warn ? alerta(`${id}-warn`, step.warn) : null,
        step.note ? texto(`${id}-note`, P(step.note)) : null,
        botao(`${id}-btn`, step.cta),
      ]);

    default:
      // EDGE-1 da spec: para e avisa qual lâmina, nunca converte pela metade.
      throw new Error(`tipo de lâmina sem regra de conversão: "${step.type}" (lâmina ${i + 1}, id "${id}")`);
  }
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: orig, error: e1 } = await db.from("funnels").select("*").eq("slug", ORIGEM).single();
  if (e1) throw e1;

  const dir = join(__dirname, "..", "specs", "backups");
  mkdirSync(dir, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const arq = join(dir, `${ORIGEM}-${carimbo}.json`);
  writeFileSync(arq, JSON.stringify({ slug: orig.slug, steps: orig.steps, settings: orig.settings }, null, 2), "utf8");
  console.log(`backup: ${arq}\n`);

  const steps = orig.steps.map(converte);

  // PROVAS — comparam o resultado com a origem, não com a intenção.
  const idsAntes = orig.steps.map((s) => s.id);
  const idsDepois = steps.map((s) => s.id);
  if (JSON.stringify(idsAntes) !== JSON.stringify(idsDepois)) {
    throw new Error(`ids das lâminas mudaram:\n  antes:  ${idsAntes}\n  depois: ${idsDepois}`);
  }
  const ativasAntes = orig.steps.filter((s) => !s.disabled).length;
  const ativasDepois = steps.filter((s) => !s.disabled).length;
  if (ativasAntes !== ativasDepois) throw new Error(`lâminas ativas: ${ativasAntes} → ${ativasDepois}`);

  const opAntes = orig.steps.filter((s) => s.type === "question").reduce((a, s) => a + (s.options?.length || 0), 0);
  const opDepois = steps.reduce((a, l) => a + (l.layers.find((b) => b.type === "options")?.content.options.length || 0), 0);
  if (opAntes !== opDepois) throw new Error(`opções de resposta: ${opAntes} → ${opDepois}`);

  const settings = {
    ...(orig.settings || {}),
    engine: "layers",
    design: {
      gap: ".5", rounded: "rounded-2xl", container: "max-w-[34rem]",
      themeColor: TEMA, titleColor: "#000000", contentColor: "#000000",
      contentFont: "poppins", featuredFont: "poppins", contentSize: "17",
      verticalAlign: "justify-start", backgroundColor: "#ffffff",
      header: { layout: "centered", progress: "flat" },
      ...((orig.settings || {}).design || {}),
    },
  };

  const { data: existe } = await db.from("funnels").select("id, status").eq("slug", DESTINO).maybeSingle();
  if (existe?.status === "published") {
    console.error(`ABORTADO: ${DESTINO} está PUBLICADO.`);
    process.exit(1);
  }
  if (existe) {
    const { error } = await db.from("funnels").update({ steps, settings }).eq("slug", DESTINO);
    if (error) throw error;
    console.log(`atualizado (draft): ${DESTINO}`);
  } else {
    const { error } = await db.from("funnels").insert({
      slug: DESTINO, name: `${orig.name} (layers)`, niche: orig.niche,
      palette_id: orig.palette_id, font: orig.font, status: "draft",
      domain: null, steps, settings,
      utmify_pixel_id: orig.utmify_pixel_id, hotmart_account_id: orig.hotmart_account_id,
      hotmart_product_id: orig.hotmart_product_id, checkout_url: orig.checkout_url,
      webhooks: orig.webhooks ?? [],
    });
    if (error) throw error;
    console.log(`criado (draft): ${DESTINO}`);
  }

  console.log(`\nprovas OK`);
  console.log(`  ${steps.length} lâminas · ids idênticos · ${ativasAntes} ativas · ${opAntes} opções de resposta`);
  console.log(`\npor tipo:`);
  const vistos = new Set();
  orig.steps.forEach((s, i) => {
    if (vistos.has(s.type)) return;
    vistos.add(s.type);
    const n = orig.steps.filter((x) => x.type === s.type).length;
    console.log(`  ${s.type.padEnd(14)} ×${String(n).padStart(2)} → ${steps[i].layers.map((b) => b.type).join("+")}`);
  });
  console.log(`\ncompare:  /q/${ORIGEM}   ×   /q/${DESTINO}`);
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
