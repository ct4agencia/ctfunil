import type { Funnel } from "../types";

const CDN = "https://media.inlead.cloud/uploads/17937";
const LOGO = `${CDN}/2026-04-08/md-jzx89-logo-cdb.png`;
const BAG = `${CDN}/2026-02-12/md-cjjAr-gemini-generated-image-xtv92gxtv92gxtv9.png`;

/**
 * Funil "Clube das Bolsas" — SEQUÊNCIA e COPY iguais ao inlead.digital/cdb01
 * (folheado ao vivo via chrome-devtools). Diferença pedida pelo Luca: a 1ª
 * lâmina é a ROLETA (gamificação). Sem captura de nome / card de confirmação
 * (isso era do Zenlya). Paleta laranja igual ao inlead.
 */
export const clubeDasBolsas: Funnel = {
  slug: "clube-das-bolsas",
  name: "CDB 👛 [Bolsas] — SRC 01",
  niche: "Bolsas artesanais / renda extra",
  logo: LOGO,
  paletteId: "laranja-cdb",
  font: "poppins",
  clickSound: true,
  steps: [
    // 1 — ROLETA (nova primeira lâmina)
    {
      id: "roleta",
      type: "roulette",
      title: "Gire a roleta e descubra sua condição especial.",
      subtitle: "Você tem uma chance de liberar um benefício exclusivo agora.",
      centerImage: BAG,
      segments: [
        { label: "BÔNUS SECRETO + R$400 OFF", color: "#e7c777", win: true,
          popupTitle: "BÔNUS SECRETO LIBERADO!", popupBody: "Você ganhou um bônus secreto + R$400 OFF no Clube das Bolsas." },
        { label: "25% OFF", color: "#ef8a6a" },
        { label: "Não foi dessa vez", color: "#b3a3c6" },
        { label: "15% OFF", color: "#f4c69b" },
        { label: "TENTE NOVAMENTE", color: "#ece2d2" },
      ],
      winningIndex: 0,
      retryIndex: 4,
      retryCta: "GIRAR NOVAMENTE",
      mode: "always",
      engine: "classica",
      style: "casino",
      cta: "Girar",
      winTitle: "🎉 BÔNUS SECRETO LIBERADO!",
      winBody: "Você ganhou um bônus secreto + R$400 OFF no Clube das Bolsas.",
      winCta: "RESGATAR MEU BÔNUS →",
      winCtaUrl: "https://app.goredirect.com.br/fd61/bs-400off-2",
      popupEnabled: true,
      popupBg: "#7a1733",
      popupText: "#ffffff",
      popupBtnBg: "#f3c437",
      sound: { enabled: true },
    },

    // 2 — PARABÉNS / Hero
    {
      id: "hero",
      type: "hero",
      badge: "🎁 BOLSA DE ESTUDOS DE 6 MESES",
      title: "O melhor treinamento do Brasil para ganhar ==R$5 mil por mês== com bolsas artesanais",
      subtitle:
        "Para receber o acesso gratuito do curso através de uma Bolsa de Estudos de 6 meses, você precisa apenas passar por uma pequena seleção respondendo algumas perguntas rápidas. Elas vão mostrar se o seu perfil se encaixa no ideal pra receber o acesso gratuito no Clube das Bolsas.",
      gallery: [
        `${CDN}/2026-01-14/md-RCBzs-mac-10.png`,
        `${CDN}/2026-01-14/md-c5HT4-mac-9.png`,
        `${CDN}/2026-01-14/md-tP27T-mac-11.png`,
      ],
      cta: "Quero liberar minha Bolsa de Estudos",
    },

    // 3..13 — PERGUNTAS (copy exata do cdb01, single-select)
    { id: "q-idade", type: "question", question: "Quantos anos você tem?", help: "Essa pergunta é pra gente te colocar no grupo certo de mulheres da sua faixa etária.", options: [{ label: "18 a 34 anos" }, { label: "34 a 54 anos" }, { label: "54 a 64 anos" }, { label: "+65 anos" }] },
    { id: "q-filhos", type: "question", question: "Você tem filhos?", options: [{ label: "Sim", emoji: "👍" }, { label: "Não", emoji: "👎" }] },
    { id: "q-regiao", type: "question", question: "Em qual região do Brasil você mora atualmente?", help: "Para te encaixar no grupo da sua região, se ainda tiver acessos gratuitos disponíveis para ela.", options: [{ label: "Norte", emoji: "🌴" }, { label: "Nordeste", emoji: "🌞" }, { label: "Centro-Oeste", emoji: "🌾" }, { label: "Sudeste", emoji: "🏙️" }, { label: "Sul", emoji: "❄️" }] },
    { id: "q-ocupacao", type: "question", question: "Qual sua ocupação hoje?", options: [{ label: "Apenas trabalho", emoji: "💼" }, { label: "Apenas estudo", emoji: "📚" }, { label: "Sou aposentada", emoji: "🙏" }, { label: "Sou dona de casa", emoji: "🏠" }, { label: "Trabalho e estudo", emoji: "⚡️" }] },
    { id: "q-situacao", type: "question", question: "Em qual dessas situações você se vê hoje?", options: [{ label: "Trabalhando muito e ganhando pouco", emoji: "😪" }, { label: "Sem uma profissão definida", emoji: "😖" }, { label: "Buscando algo que me dê liberdade e renda extra", emoji: "🤑" }, { label: "Insatisfeita e querendo mudança de vida", emoji: "😔" }] },
    { id: "q-experiencia", type: "question", question: "Qual o seu nível de experiência com bolsas artesanais?", options: [{ label: "Nunca fiz", emoji: "🌸" }, { label: "Sou iniciante", emoji: "💫" }, { label: "Já tenho experiência", emoji: "🌹" }] },
    { id: "q-motivacao", type: "question", question: "Se você ganhasse R$5.000 por mês com seu negócio de bolsas… qual seria a primeira coisa que você faria com esse dinheiro?", options: [{ label: "Sair do meu emprego atual", emoji: "🏃" }, { label: "Abrir meu próprio ateliê", emoji: "🏠" }, { label: "Ajudar minha família", emoji: "❤️" }, { label: "Realizar um sonho antigo", emoji: "🌟" }] },
    { id: "q-fase", type: "question", question: "Em que fase da sua vida você sente que está agora?", options: [{ label: "Buscando independência financeira" }, { label: "Quero ter uma renda própria" }, { label: "Quero recomeçar minha vida" }, { label: "Quero mais liberdade financeira" }] },
    { id: "q-acompanha", type: "question", question: "Você já acompanha algum conteúdo sobre bolsas artesanais? (YouTube, Instagram, TikTok etc)", options: [{ label: "Sim, acompanho muito" }, { label: "Vejo às vezes" }, { label: "Não acompanho" }] },
    { id: "q-curso", type: "question", question: "Você já fez algum curso online antes?", options: [{ label: "Sim, já fiz e concluí", emoji: "💪" }, { label: "Já comecei, mas não terminei", emoji: "😟" }, { label: "Nunca fiz", emoji: "❌" }] },
    { id: "q-apoio", type: "question", question: "Durante o curso, você teria alguém que pudesse te apoiar, seja emocionalmente ou financeiramente?", options: [{ label: "Sim, com certeza", emoji: "😍" }, { label: "Talvez", emoji: "🧐" }, { label: "Não", emoji: "😕" }] },

    // 14 — CARREGANDO RESPOSTAS
    {
      id: "loading", type: "loading", variant: "light", style: "checklist", logo: LOGO,
      title: "Carregando suas respostas…",
      bars: ["Conferindo suas respostas", "Cruzando seu perfil com as vagas", "Preparando seu resultado"],
      slides: ["Espere só um instante"],
      durationMs: 4500,
      checkpoints: [{ at: 60, question: "Você quer começar ainda este mês?", options: ["Sim, com tudo! 🔥", "Quero entender melhor"] }],
    },

    // 15 — 94% COMPATÍVEL
    {
      id: "result", type: "result",
      range: [94, 94], minShown: 87,
      title: "Uau! 😱",
      subtitle: "Você tem ==tudo que a gente procura==!",
      body: "Que orgulho dizer isso: você atingiu a compatibilidade com o perfil ideal para receber a ==Bolsa de Estudos de 6 meses== no Clube das Bolsas! 🎉",
      ringLabel: "Compatível",
      approvedTitle: "Você foi aprovada!",
      approvedBody: "Você tem tudo que a gente procura. Estamos muito felizes por ver você chegar até aqui. 🎉",
      cta: "Quero ativar minha Bolsa de Estudos",
    },

    // 16 — ME CHAMO SÔNIA (oferta)
    {
      id: "offer", type: "offer",
      image: `${CDN}/2025-10-01/md-FWlAd-logo-55.png`,
      badge: "Bolsa garantida",
      verified: true,
      title: "Prazer, eu me chamo ==Sônia== 🧡",
      body: "A sua Bolsa de Estudos de 6 meses está garantida! E agora que você é oficialmente minha aluna, deixa eu me apresentar:\n\nSou professora de Bolsas na tela há mais de **5 anos**. Já formei **+800 alunas** e hoje compartilho minha rotina e trabalho para **+100 mil seguidoras** no meu Instagram.",
      stats: [
        { value: "5+", label: "anos" },
        { value: "+800", label: "alunas" },
        { value: "+100 mil", label: "seguidoras" },
      ],
      giftTitle: "🎁 Presente de boas-vindas",
      giftBody: "E pra gente começar nossa relação de aluna e professora do jeito certo, eu resolvi te dar um ==presente de boas-vindas== que você vai AMAR!",
      cta: "QUERO O PRESENTE",
    },

    // 17 — CAPTURA
    {
      id: "captura", type: "capture",
      title: "Como forma de ==reconhecimento== por ter chegado até aqui…",
      body: "Eu vou te mandar no seu **Whatsapp** uma **Apostila SUPER COMPLETA** de como fazer Bolsas de celular em Crochê.",
      image: `${CDN}/2026-03-19/md-Vw2vD-1d8ebb39-c0ea-4334-a40b-8600e8750876.png`,
      freeBadge: "GRÁTIS",
      note: "Essa apostila eu vou te mandar **direto no seu Whatsapp**, por isso preciso que você me diga qual seu número com DDD. Confere certinho o número pra não ficar errado, tá bom?",
      nameLabel: "Como você gostaria que eu te chamasse?",
      namePlaceholder: "Digite seu nome...",
      phoneLabel: "Seu Whatsapp (com DDD)",
      phonePlaceholder: "(00) 00000-0000",
      cta: "Quero receber o presente no meu Whatsapp",
      secure: "🔒 Seus dados estão protegidos e nunca serão compartilhados",
      componentId: "captura",
    },

    // 18 — PÓS CAPTURA
    {
      id: "pos-captura", type: "post_capture",
      title: "Pronto, {nome}!",
      body: "Já vou anotar seu contato aqui no meu celular e daqui a alguns minutos vou te mandar uma mensagem no Whatsapp, combinado?",
      warn: "Lembrando: eu só consigo te mandar a apostila se você **responder a mensagem**.",
      note: "Ahhh, quase ia esquecendo… Além de te mandar a apostila, se você quiser, vou adorar conversar com você, tirar suas dúvidas e te ajudar no que precisar. ❤️ Fica atenta às notificações pra não deixar sua professora sem resposta, viu?",
      cta: "Quero ativar a Bolsa de Estudos",
    },

    // 19 — BRIDGE
    {
      id: "bridge", type: "bridge",
      title: "Agora, assista o vídeo que explica tudo que você vai aprender no Clube das Bolsas",
      body: "Ele também mostra, passo a passo, como ativar a bolsa de estudos de 6 meses que você acabou de conquistar.",
      warn: "Para não perder a sua bolsa de estudos de 6 meses, é obrigatório que você veja ATÉ O FINAL o vídeo da próxima página.",
      cta: "Quero ativar minha Bolsa de Estudos",
    },

    // 20 — VSL (inline, estilo Zenlya)
    {
      id: "vsl", type: "vsl",
      title: "Veja como ativar sua Bolsa de Estudos 👇",
      checkoutUrl: "https://clubedasbolsas3.com.br/cdb01/",
      ctaText: "QUERO ATIVAR MINHA BOLSA AGORA",
      pitchRevealAt: 8,
    },
  ],
};
