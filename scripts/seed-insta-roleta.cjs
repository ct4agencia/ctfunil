/**
 * Seed do funil "CDB 👛 [BOLSAS] - INSTA ROLETA" (slug: cdb-insta-roleta).
 *
 * Origem: documento "CONTEUDOS PARA REELS" → seção "✅ FUNIL - Roleta", 12 cards.
 * A copy é transcrita do documento; onde ele se contradiz, a escolha está
 * comentada na lâmina correspondente.
 *
 * Nasce como DRAFT. Publicar é decisão do Luca, no painel.
 *
 * IDs SEMÂNTICOS de propósito (`c03-p1`, `p1-nunca`…): `step_events.step_id` e
 * `quiz_answers` guardam esses ids, e id aleatório torna o relatório ilegível
 * seis meses depois. Depois de publicado, mexer neles quebra o histórico.
 *
 * Rodar:  node scripts/seed-insta-roleta.cjs
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const SLUG = "cdb-insta-roleta";

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

// ── helpers de bloco ────────────────────────────────────────────────
const texto = (id, html) => ({
  id, type: "text", title: "Texto", design: [],
  content: { id: `c-${id}`, name: id, text: html },
});

const botao = (id, label) => ({
  id, type: "button", title: "Botão",
  design: { basis: 100, fixed: false, pulse: true, style: "theme", bubble: true, effect: "pulse" },
  content: { id: `c-${id}`, name: id, type: "next", label, pulse: false, target: false, destination: "next" },
});

const espaco = (id, alt = "2rem") => ({
  id, type: "clear", title: "Espaço", design: [],
  content: { id: `c-${id}`, name: id, clear: `h-[${alt}]` },
});

/** Bloco de opções. `nome` vira a coluna do CSV de leads — legível, sem acento. */
const opcoes = (id, nome, itens) => ({
  id, type: "options", title: "Opções",
  design: {
    gap: "gap-2", grid: "grid-cols-1", icon: "select", basis: 100, order: "default",
    border: "border-[4px]", shadow: "shadow-md hover:shadow-lg", background: "contrast",
    orientation: "vertical", iconPosition: "end", transparentImage: true,
  },
  content: {
    id: `c-${id}`, name: nome, cols: "grid-cols-1", order: "default", required: true,
    orientation: "vertical",
    options: itens.map((o) => ({
      id: o.id, label: `<p>${o.label}</p>`, chosen: false, selected: false, destination: "next",
      ...(o.emoji ? { image: { src: o.emoji, type: "emoji" } } : {}),
    })),
  },
});

const campo = (id, nome, tipo, titulo, placeholder, extra = {}) => ({
  id, type: "field", title: "Campo", design: [],
  content: { id: `c-${id}`, name: nome, type: tipo, title: titulo, required: true, placeholder, ...extra },
});

/** Uma lâmina do motor layers. */
const lamina = (id, titulo, blocos, opts = {}) => ({
  id, title: titulo, chosen: false,
  design: {},
  layers: blocos,
  options: { show_progress: opts.progresso !== false },
  position: { x: (opts.i ?? 0) * 288, y: 0 },
  selected: false,
});

// Mockup da apostila: as mesmas 3 imagens do card 2 do cdb-rr, a pedido do Luca.
const MOCKUP = [
  "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/opt-md-RCBzs-mac-10.webp",
  "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/opt-md-c5HT4-mac-9.webp",
  "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/opt-md-tP27T-mac-11.webp",
];

const H2 = (t) => `<h2 class="ql-align-center"><span style="font-weight: bolder;">${t}</span></h2>`;
const P = (t) => `<p class="ql-align-center"><span style="color: rgb(64, 64, 64);">${t}</span></p>`;
const DESTAQUE = (t) =>
  `<span style="display:inline-block;margin:0 2px;border-radius:0.75rem;padding:0.1rem 0.6rem;font-weight:800;color:#ffffff;background:linear-gradient(95deg, #0f766e, #14b8a6);box-shadow:0 6px 16px -6px rgba(15,118,110,.55);">${t}</span>`;

// ── as 12 lâminas ───────────────────────────────────────────────────
const STEPS = [
  // CARD 01 — Hero
  lamina("c01-hero", "Card 01 — Hero", [
    espaco("c01-sp", "1rem"),
    texto("c01-txt", H2("CLIQUE NO BOTÃO PARA RECEBER A APOSTILA GRATUITA")),
    botao("c01-btn", "INICIAR"),
  ], { i: 0, progresso: false }),

  // CARD 02 — Preparação. O documento pede o mockup da apostila; o Luca mandou
  // reusar as imagens do card 2 do cdb-rr. O layers não tem o marquee contínuo
  // do motor tipado, então o equivalente aqui é o carrossel com auto-play.
  lamina("c02-prep", "Card 02 — Preparação", [
    texto("c02-tit", H2("Sua apostila está quase liberada! 🎁")),
    {
      id: "c02-mock", type: "carousel", title: "Carrossel",
      design: { basis: 100 },
      content: { id: "c-c02-mock", name: "c02-mock", images: MOCKUP, interval: 2 },
    },
    texto("c02-txt", [
      P("Antes de enviar seu material, quero conhecer um pouquinho melhor você."),
      P("Vou fazer algumas perguntas bem rápidas para analisar o seu nível atual e te mandar a melhor apostila para você começar."),
      P("<strong>Leva menos de 1 minuto.</strong>"),
    ].join("")),
    botao("c02-btn", "COMEÇAR"),
  ], { i: 1, progresso: false }),

  // CARDS 03-07 — as 5 perguntas
  lamina("c03-p1", "Card 03 — Pergunta 1", [
    texto("c03-tit", H2("Você já produziu alguma bolsa artesanal?")),
    opcoes("c03-opt", "ja_produziu_bolsa", [
      { id: "p1-nunca", label: "Nunca produzi", emoji: "🌱" },
      { id: "p1-dificuldade", label: "Já tentei, mas tive dificuldade", emoji: "😕" },
      { id: "p1-algumas", label: "Já produzi algumas", emoji: "👜" },
      { id: "p1-melhorar", label: "Já produzo e quero melhorar", emoji: "🚀" },
    ]),
  ], { i: 2 }),

  lamina("c04-p2", "Card 04 — Pergunta 2", [
    texto("c04-tit", H2("Você já conhecia a técnica de Bolsas na Tela?")),
    opcoes("c04-opt", "conhecia_tecnica", [
      { id: "p2-nunca", label: "Nunca tinha visto", emoji: "🤔" },
      { id: "p2-videos", label: "Já vi alguns vídeos", emoji: "📱" },
      { id: "p2-tentei", label: "Já tentei fazer", emoji: "🧵" },
      { id: "p2-utilizo", label: "Já utilizo a técnica", emoji: "✅" },
    ]),
  ], { i: 3 }),

  lamina("c05-p3", "Card 05 — Pergunta 3", [
    texto("c05-tit", H2("Por que você deseja aprender?")),
    opcoes("c05-opt", "motivo_aprender", [
      { id: "p3-passatempo", label: "Quero um novo passatempo", emoji: "☕" },
      { id: "p3-para-mim", label: "Quero produzir para mim", emoji: "💝" },
      { id: "p3-presentear", label: "Quero presentear pessoas", emoji: "🎁" },
      { id: "p3-vender", label: "Quero vender e ter uma renda", emoji: "💰" },
    ]),
  ], { i: 4 }),

  lamina("c06-p4", "Card 06 — Pergunta 4", [
    texto("c06-tit", H2("O que mais dificulta seu começo hoje?")),
    opcoes("c06-opt", "maior_dificuldade", [
      { id: "p4-materiais", label: "Não sei quais materiais comprar", emoji: "🛒" },
      { id: "p4-habilidade", label: "Acho que não tenho habilidade", emoji: "😟" },
      { id: "p4-primeira", label: "Não sei como produzir a primeira bolsa", emoji: "🧶" },
      { id: "p4-vender", label: "Não sei como vender", emoji: "🏷️" },
      { id: "p4-medo", label: "Tenho medo de investir e não conseguir", emoji: "😰" },
    ]),
  ], { i: 5 }),

  lamina("c07-p5", "Card 07 — Pergunta 5", [
    texto("c07-tit", H2("Se você tivesse acesso a aulas completas ensinando desde o início, você reservaria um tempo para aprender?")),
    opcoes("c07-opt", "reservaria_tempo", [
      { id: "p5-certeza", label: "Com certeza", emoji: "🔥" },
      { id: "p5-aos-poucos", label: "Sim, mesmo que seja aos poucos", emoji: "🙂" },
      { id: "p5-tentar", label: "Gostaria de tentar", emoji: "🤞" },
      { id: "p5-nao", label: "No momento não consigo", emoji: "😔" },
    ]),
  ], { i: 6 }),

  // CARD 08 — Captura. `phone_br` liga a máscara e a validação de DDD; sem ela
  // o lead consegue enviar número inválido e a apostila não chega.
  lamina("c08-captura", "Card 08 — Captura", [
    texto("c08-tit", H2("RECEBA SUA APOSTILA GRATUITA NO WHATSAPP")),
    texto("c08-txt", [
      P("<strong>Seu resultado está quase pronto</strong>"),
      P("Estamos analisando suas respostas."),
      P("Antes de mostrar o resultado, informe onde devemos enviar sua apostila gratuita."),
    ].join("")),
    campo("c08-nome", "nome", "text", "Seu nome", "Digite seu nome..."),
    campo("c08-fone", "telefone", "phone", "Seu WhatsApp com DDD", "(00) 00000-0000", { mask: "phone_br" }),
    botao("c08-btn", "VER MEU RESULTADO"),
  ], { i: 7 }),

  // CARD 09 — Diagnóstico. O documento diz "3 caixas" e lista 4; valem as 4.
  // Os textos são os do documento (o print de referência traz outros, do funil
  // "Níveis" — trocar é um campo no construtor).
  lamina("c09-diag", "Card 09 — Diagnóstico", [
    {
      id: "c09-diagbl", type: "loading", title: "Diagnóstico", design: { basis: 100 },
      content: {
        id: "c-c09-diagbl", name: "c09-diag",
        style: "diagnostico",
        title: "Analisando o seu perfil…",
        description: "Estamos preparando o envio da apostila de acordo com o seu nível…",
        bars: [
          "Analisando suas respostas...",
          "Selecionando a apostila ideal...",
          "Preparando o envio para seu WhatsApp…",
          "Resultado concluído",
        ],
        icons: ["🔍", "📋", "📲", "✅"],
        seconds: 5,
        destination: "next",
      },
    },
  ], { i: 8, progresso: false }),

  // CARD 10 — Giro liberado
  lamina("c10-giro", "Card 10 — Giro liberado", [
    texto("c10-tit", H2("Suas respostas liberaram uma surpresa para você! 🎁")),
    texto("c10-txt", [
      P("Sua apostila gratuita já será enviada para o WhatsApp informado. ✅"),
      P("Mas, após analisarmos suas respostas, identificamos que seu perfil também se encaixa nos critérios para participar de uma liberação especial do <strong>Clube das Bolsas</strong>."),
      P(`Por isso, você ganhou ${DESTAQUE("1 giro")} na nossa Roleta de Prêmios.`),
      P("Gire agora para descobrir qual benefício será liberado para você."),
    ].join("")),
    botao("c10-btn", "GIRAR A ROLETA"),
  ], { i: 9 }),

  // CARD 11 — Roleta interativa.
  //
  // MOVIMENTO: o documento pede que ela "quase entorte para o próximo prêmio e
  // volte" (isso é `overshoot`), mas o Luca pediu o oposto — quase parar no
  // prêmio errado e passar o ponteiro no fim. Isso é o `pegHang`, que mira a
  // crista do pino ANTERIOR, hesita e tomba para frente. Vale a instrução do
  // Luca, mais recente e explícita.
  //
  // Os valores combinam dois presets: pedágio/catraca do "Suspense" (as
  // quase-paradas) com rigidez/amortecimento do "Quase não passa" (o tombo
  // seco). Preset "Personalizado" porque nenhum dos sete entrega os dois.
  lamina("c11-roleta", "Card 11 — Roleta", [
    {
      id: "c11-rlt", type: "roulette", title: "Roleta",
      content: {
        id: "roleta", type: "roulette",
        title: "🎯 SEU GIRO ESTÁ LIBERADO",
        subtitle: "Toque no botão abaixo e descubra seu prêmio.",
        cta: "GIRAR",
        engine: "interativa",
        preset: "Personalizado",
        intensidade: 0,
        paramsRoleta: {
          voltas: 6,
          duracaoAlvo: 5.0,   // documento pede 4-5 s
          limiarCatraca: 300, // catraca começa cedo → mais quase-paradas
          pedagio: 30,        // cada pino rouba energia → o suspense
          rigidez: 200,       // tombo SECO no fim (mola frouxa mata o susto)
          amortecimento: 9,
          overshoot: 0,       // 0 porque quem manda no fim é o pegHang
          pegHang: true,      // hesita no pino anterior e passa o ponteiro
        },
        mode: "always",
        winningIndex: 0,
        initialIndex: 3,
        segments: [
          { win: true, label: "ACESSO GRATUITO", color: "#0f766e", emoji: "🎁" },
          { label: "Aula especial", color: "#5eead4" },
          { label: "Apostila bônus", color: "#99f6e4" },
          { label: "Guia de materiais", color: "#2dd4bf" },
          { label: "Modelos extras", color: "#ccfbf1" },
          { label: "Desconto especial", color: "#14b8a6" },
        ],
        // POPUP: o documento pede o popup central com botão "PEGAR MEU PRÊMIO".
        popupEnabled: true,
        popupBg: "#0f766e",
        popupText: "#ffffff",
        popupBtnBg: "#ffffff",
        // Sem emoji no título: o popup já mostra o do prêmio (🎁) em corpo
        // grande logo acima, e os dois juntos saíam como "🎁🎉 PARABÉNS!".
        winTitle: "PARABÉNS!",
        winBody: "VOCÊ LIBEROU: ACESSO GRATUITO AO MATERIAL COMPLETO DO CLUBE DAS BOLSAS",
        winCta: "PEGAR MEU PRÊMIO",
        sound: { enabled: true },
        style: "soft",
        ctaBelow: true,
        // Com popup ligado o autoAdvance é ignorado no runtime; fica false para
        // o construtor não sugerir um comportamento que não acontece.
        autoAdvance: false,
        // Trava de 24 h: sem ela o visitante gira de novo no reload e o "prêmio
        // único" perde o sentido.
        lockReplay: true,
      },
    },
  ], { i: 10, progresso: false }),

  // CARD 12 — Resultado. Última lâmina: a VSL não entra (decisão do Luca).
  // O botão aponta para `next` e, sem próxima lâmina, o funil termina aqui —
  // o destino do clique é o Luca quem coloca.
  lamina("c12-resultado", "Card 12 — Resultado", [
    texto("c12-tit", H2(`VOCÊ LIBEROU:<br>${DESTAQUE("ACESSO GRATUITO")}<br>AO MATERIAL COMPLETO DO CLUBE DAS BOLSAS`)),
    texto("c12-txt", [
      P("A apostila que você solicitou já vai ajudar você a começar."),
      P("Mas o benefício que você acabou de liberar vai muito além."),
      P("Você poderá conhecer o material completo do <strong>Clube das Bolsas</strong>, com aulas e conteúdos passo a passo para aprender a produzir Bolsas na Tela."),
    ].join("")),
    {
      id: "c12-alerta", type: "alert", title: "Alerta",
      design: { basis: 100, style: "warning" },
      content: {
        id: "c-c12-alerta", name: "c12-alerta",
        text: "<p>Agora assista à apresentação rápida abaixo para conhecer tudo o que está incluído e entender como funciona a liberação do seu acesso gratuito.</p>",
      },
    },
    botao("c12-btn", "QUERO LIBERAR MEU ACESSO"),
  ], { i: 11 }),
];

const SETTINGS = {
  engine: "layers",
  seo: { title: "Clube das Bolsas — Apostila gratuita" },
  produto_nome: "Clube das Bolsas",
  header: { show_back: false, show_logo: true, show_progress: true },
  design: {
    gap: ".5",
    logo: {
      src: "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/opt-jzx89-logo-cdb.webp",
      type: "image", width: 1080, height: 676,
    },
    header: { layout: "centered", progress: "flat" },
    rounded: "rounded-2xl",
    logoSize: "106",
    container: "max-w-[34rem]",
    titleSize: 0.5,
    themeColor: "#0f766e",
    titleColor: "#0f172a",
    contentFont: "poppins",
    contentSize: "17",
    elementSize: "68px",
    logoOpacity: 68,
    contentColor: "#1f2937",
    featuredFont: "poppins",
    verticalAlign: "justify-start",
    backgroundColor: "#ffffff",
  },
};

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: existente } = await db.from("funnels").select("id, status").eq("slug", SLUG).maybeSingle();
  if (existente) {
    // Nunca sobrescreve um funil publicado: se já está no ar, regravar as
    // lâminas por baixo trocaria o funil de quem está navegando nele agora.
    if (existente.status === "published") {
      console.error(`ABORTADO: ${SLUG} já existe e está PUBLICADO. Edite pelo construtor.`);
      process.exit(1);
    }
    const { error } = await db.from("funnels").update({ steps: STEPS, settings: SETTINGS }).eq("slug", SLUG);
    if (error) throw error;
    console.log(`atualizado (draft): ${SLUG} — ${STEPS.length} lâminas`);
    return;
  }

  const { error } = await db.from("funnels").insert({
    slug: SLUG,
    name: "CDB 👛 [BOLSAS] - INSTA ROLETA",
    niche: "Bolsas artesanais / apostila gratuita",
    palette_id: "azul-confianca",
    font: "poppins",
    status: "draft",
    domain: "viverdebolsas.com.br",
    steps: STEPS,
    settings: SETTINGS,
  });
  if (error) throw error;
  console.log(`criado (draft): ${SLUG} — ${STEPS.length} lâminas`);
  console.log(`preview: /q/${SLUG}   construtor: /builder/${SLUG}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
