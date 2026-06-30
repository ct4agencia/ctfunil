import type { TbBlock, TbFunnel, TbGroup } from "./types";
import { TB_DEFAULT_THEME } from "./types";

/**
 * Funil typebot "CDB [BOLSAS] - WHATSAPP" — montado 1:1 a partir do Doc
 * "Fluxo TypeBot - Clube das Bolsas" (15 etapas + 11 perguntas, formato chat).
 *
 * Regras seguidas (pedido do Luca):
 *  - Onde o doc indica ÁUDIO/voz → bloco `voice` (nota de voz), sem URL (o áudio
 *    é anexado depois no builder; o script do doc é só a referência da locução).
 *  - Emojis das opções/botões preservados no rótulo (reconstruídos — vinham
 *    corrompidos no doc).
 *  - Título de cada grupo = header do doc ("ETAPA 0X - ...", "PERGUNTA X - ...").
 *  - Delays adicionados exatamente onde a observação CONFIGURAÇÃO sinaliza.
 */
const CDB_CDN = "https://media.inlead.cloud/uploads/17937";
const CDB_SONIA = `${CDB_CDN}/2025-10-01/md-FWlAd-logo-55.png`;
const CDB_BOLSA = `${CDB_CDN}/2026-01-14/md-RCBzs-mac-10.png`;
const CDB_BOLSAS = `${CDB_CDN}/2026-01-14/md-c5HT4-mac-9.png`;
const CDB_APOSTILA = `${CDB_CDN}/2026-03-19/md-Vw2vD-1d8ebb39-c0ea-4334-a40b-8600e8750876.png`;
const CDB_CHECKOUT = "https://clubedasbolsas3.com.br/cdb01/";

let _n = 0;
const bid = () => `b${++_n}`;
const txt = (s: string): TbBlock => ({ id: bid(), type: "text", richText: s });
const img = (url: string): TbBlock => ({ id: bid(), type: "image", url });
const wait = (seconds: number): TbBlock => ({ id: bid(), type: "wait", seconds });
/** nota de voz — sem URL (o Luca anexa o áudio depois); duration = referência do doc */
const voice = (duration: string): TbBlock => ({ id: bid(), type: "voice", duration });
/** VSL (página) — repaginação no mesmo domínio (embed do player anexado depois) */
const vslBlock = (): TbBlock => ({
  id: bid(), type: "vsl",
  barText: "⚠️ ATENÇÃO: ESTE VÍDEO SAI DO AR EM BREVE",
  title: "Assista o vídeo abaixo e veja como ativar sua Bolsa de Estudos 👇",
  embedHtml: "",
  pitchRevealAt: 8,
  ctaText: "QUERO ATIVAR MINHA BOLSA AGORA",
  checkoutUrl: CDB_CHECKOUT,
  background: "#ffffff",
});
const inputText = (variable: string, placeholder: string): TbBlock => ({ id: bid(), type: "input-text", variable, placeholder, button: "Enviar" });
const inputPhone = (variable: string, placeholder: string): TbBlock => ({ id: bid(), type: "input-phone", variable, placeholder, button: "Enviar" });
const choice = (variable: string | undefined, labels: string[]): TbBlock => ({
  id: bid(), type: "input-choice", variable, items: labels.map((l) => ({ id: bid(), label: l })),
});

/** açúcar: cria um grupo com título, blocos e próximo grupo */
const grp = (id: string, title: string, blocks: TbBlock[], to: string | undefined, i: number): TbGroup =>
  ({ id, title, x: 40 + i * 300, y: 40, blocks, to });

export function cdbWhatsappTypebot(): TbFunnel {
  _n = 0;
  let i = 0;
  const groups: TbGroup[] = [
    // ── ETAPA 01 — 5 bolhas de texto + 1 imagem. Delay 1s entre elas. → Etapa 02
    grp("e01", "ETAPA 01 - Abertura", [
      txt("Oi! Tudo bem? 😊"),
      wait(1),
      txt("Você está aqui porque foi selecionada para receber uma **Bolsa de Estudos de 6 meses** no Clube das Bolsas."),
      wait(1),
      txt("Para receber o acesso gratuito do curso através dessa Bolsa de Estudos, você precisa apenas passar por uma pequena seleção respondendo algumas perguntas rápidas."),
      wait(1),
      txt("Essas perguntas vão mostrar se o seu perfil se encaixa no ideal para receber o acesso gratuito."),
      wait(1),
      txt("O melhor treinamento do Brasil para aprender a ganhar 5 mil reais todos os meses fazendo e vendendo bolsas artesanais."),
      wait(1),
      img(CDB_BOLSA),
    ], "e02", i++),

    // ── ETAPA 02 — Áudio de abertura (~30s). Inicia auto com delay 1-2s. → Etapa 03
    grp("e02", "ETAPA 02 - Áudio de Abertura", [
      wait(2),
      voice("0:30"),
    ], "e03", i++),

    // ── ETAPA 03 — Botão único. Qualquer clique → Pergunta 1.
    grp("e03", "ETAPA 03 - Chamada para Ação", [
      txt("Quer liberar sua Bolsa de Estudos?"),
      choice(undefined, ["Quero liberar"]),
    ], "p1", i++),

    // ── O QUIZ — 11 perguntas ──────────────────────────────────────────────
    grp("p1", "PERGUNTA 1 - Idade", [
      txt("Quantos anos você tem?"),
      txt("Essas perguntas ajudam a gente a conhecer os grupos certos de mulheres de sua faixa etária."),
      choice("idade", ["18 a 34 anos", "35 a 44 anos", "45 a 54 anos", "55+ anos"]),
    ], "p2", i++),

    grp("p2", "PERGUNTA 2 - Filhos", [
      txt("Você tem filhos?"),
      choice("filhos", ["👶 Sim", "🚫 Não"]),
    ], "p3", i++),

    grp("p3", "PERGUNTA 3 - Região", [
      txt("Em qual região do Brasil você mora atualmente?"),
      txt("Essa pergunta vai nos ajudar a encontrar o seu grupo de sua região."),
      choice("regiao", ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]),
    ], "p4", i++),

    grp("p4", "PERGUNTA 4 - Ocupação", [
      txt("Qual sua ocupação hoje?"),
      choice("ocupacao", ["Apenas trabalho 💼", "Apenas estudo 📚", "Sou aposentada 👵", "Sou dona de casa 🏡", "Trabalho e estudo ⚡"]),
    ], "p5", i++),

    grp("p5", "PERGUNTA 5 - Situação de Vida", [
      txt("Em qual dessas situações você se vê hoje?"),
      choice("situacao", ["👩‍💻 Trabalhando muito e ganhando pouco", "🤔 Sem uma profissão definida", "💰 Buscando algo que me dê liberdade e renda extra", "😩 Insatisfeita e querendo mudança de vida"]),
    ], "p6", i++),

    grp("p6", "PERGUNTA 6 - Experiência com Bolsas", [
      txt("Qual o seu nível de experiência com bolsas artesanais?"),
      img(CDB_BOLSAS),
      choice("experiencia", ["🤷‍♀️ Nunca fiz", "🧶 Sou iniciante", "💪 Já tenho experiência"]),
    ], "p7", i++),

    grp("p7", "PERGUNTA 7 - Sonho com R$ 5.000/mês", [
      txt("Se você ganhasse R$ 5.000 por mês com seu negócio de bolsas..."),
      txt("Qual seria a primeira coisa que você faria com esse dinheiro?"),
      choice("sonho", ["🚶‍♀️ Sair do meu emprego atual", "🏠 Abrir meu próprio ateliê", "👨‍👩‍👧 Ajudar minha família", "💭 Realizar um sonho antigo"]),
    ], "p8", i++),

    grp("p8", "PERGUNTA 8 - Fase da Vida", [
      txt("Em que fase da sua vida você sente que está agora?"),
      choice("fase", ["🎯 Buscando independência financeira", "💵 Quero ter uma renda própria", "🔄 Quero recomeçar minha vida", "🕊️ Quero mais liberdade financeira"]),
    ], "p9", i++),

    grp("p9", "PERGUNTA 9 - Acompanha Conteúdo", [
      txt("Você já acompanha algum conteúdo sobre bolsas artesanais?"),
      choice("acompanha", ["😍 Sim, acompanho muito", "👁️ Vejo às vezes", "❌ Não acompanho"]),
    ], "p10", i++),

    grp("p10", "PERGUNTA 10 - Histórico de Cursos", [
      txt("Você já fez algum curso online antes?"),
      choice("curso", ["💪 Sim, já fiz e concluí", "🤔 Já comecei, mas não terminei", "❌ Nunca fiz"]),
    ], "p11", i++),

    grp("p11", "PERGUNTA 11 - Apoio Emocional/Financeiro", [
      txt("Durante o curso, você teria alguém que poderia te apoiar, seja emocionalmente ou financeiramente?"),
      choice("apoio", ["🥰 Sim, com certeza", "🤨 Talvez", "🙁 Não"]),
    ], "e04", i++),

    // ── ETAPA 04 — Processamento (pausa pra "ler as respostas") → Etapa 05
    grp("e04", "ETAPA 04 - Processamento", [
      txt("Estou vendo suas respostas aqui, tá bom?"),
      txt("Espera só um instante."),
      wait(2),
    ], "e05", i++),

    // ── ETAPA 05 — Resultado 94%
    grp("e05", "ETAPA 05 - Resultado", [
      txt("Uau! 😱"),
      txt("Que orgulho dizer isso: você atingiu **94% de compatibilidade** com o perfil ideal para receber a bolsa de 6 meses! 🎉"),
      txt("94% — Sim, você foi incrível!!"),
      txt("O mínimo necessário era 81%, e você foi muito além."),
      txt("Você tem tudo que a gente procura!"),
      txt("Estamos muitos felizes por você chegar até aqui. 💛"),
    ], "e06", i++),

    // ── ETAPA 06 — 2 bolhas. Delay 1s entre elas. → Etapa 07
    grp("e06", "ETAPA 06 - Parabéns", [
      txt("Parabéns! 🎉"),
      wait(1),
      txt("A sua Bolsa de Estudos de 6 meses está GARANTIDA! ✅"),
    ], "e07", i++),

    // ── ETAPA 07 — 1ª msg, áudio (~45s, delay 1-2s), demais msgs delay 1s, imagem. → Etapa 08
    grp("e07", "ETAPA 07 - Apresentação Sônia", [
      txt("E agora que você é oficialmente minha aluna, deixa eu me apresentar para você:"),
      wait(2),
      voice("0:45"),
      txt("Eu me chamo Sônia, sou professora de bolsas há mais de 5 anos."),
      wait(1),
      txt("Já formei mais de 850 alunas."),
      wait(1),
      txt("Hoje compartilho minha rotina e trabalho para mais de 50 mil seguidoras no meu Instagram."),
      img(CDB_SONIA),
    ], "e08", i++),

    // ── ETAPA 08 — Bônus (apostila)
    grp("e08", "ETAPA 08 - Bônus", [
      txt("E pra gente começar nossa relação de aluna e professora do jeito certo, eu resolvi antes de iniciar as aulas te dar um presente de boas vindas que você vai AMAR!!!"),
      txt("Como forma de reconhecimento por ter chegado até aqui..."),
      txt("Eu vou te mandar uma Apostila SUPER COMPLETA de como fazer Bolsas de celular em Crochê."),
      img(CDB_APOSTILA),
      txt("Essa apostila é totalmente de graça!"),
    ], "e09", i++),

    // ── ETAPA 09 — Nome → salva {nome}
    grp("e09", "ETAPA 09 - Nome", [
      txt("Para eu confirmar sua bolsa e enviar a apostila, preciso que você preencha seus dados:"),
      txt("Como você gostaria que eu te chamasse?"),
      inputText("nome", "Digite seu nome..."),
    ], "e10", i++),

    // ── ETAPA 10 — WhatsApp → salva {whatsapp}
    grp("e10", "ETAPA 10 - WhatsApp", [
      txt("Agora me passa seu WhatsApp com DDD."),
      txt("É por lá que vou te enviar a apostila."),
      inputPhone("whatsapp", "Digite seu WhatsApp com DDD..."),
    ], "e11", i++),

    // ── ETAPA 11 — Confirmação
    grp("e11", "ETAPA 11 - Confirmação", [
      txt("Perfeito!"),
      txt("Já vou enviar seu contato aqui no meu celular..."),
      txt("E daqui a alguns minutos vou te mandar uma mensagem no WhatsApp."),
    ], "e12", i++),

    // ── ETAPA 12 — Aviso
    grp("e12", "ETAPA 12 - Aviso", [
      txt("⚠️ Lembrando:"),
      txt("Eu só consigo te mandar a apostila se você responder a mensagem."),
      txt("Ahhh, quase ia esquecendo..."),
      txt("Além de te mandar a apostila, se você quiser, eu vou adorar conversar com você, tirar suas dúvidas e te ajudar no que precisar..."),
      txt("Eu adoro conversar com as minhas alunas! 🥰"),
      txt("Então fica atenta às notificações para não deixar a sua professora sem resposta, viu? 😉"),
    ], "e13", i++),

    // ── ETAPA 13 — Bridge para VSL
    grp("e13", "ETAPA 13 - Bridge para VSL", [
      txt("Agora, vamos ativar a sua bolsa de estudos! 🤩"),
      txt("Clique no botão abaixo e veja o vídeo que explica tudo que você vai aprender no Clube das Bolsas."),
      txt("É também mostrado, passo a passo, como ativar a bolsa de estudos de 6 meses que você acabou de conquistar."),
    ], "e14", i++),

    // ── ETAPA 14 — Aviso Final
    grp("e14", "ETAPA 14 - Aviso Final", [
      txt("⚠️ ATENÇÃO!"),
      txt("Para não correr o risco de perder a sua bolsa de estudos de 6 meses..."),
      txt("É obrigatório que você VEJA O VÍDEO até o final."),
      txt("Se você sair antes, o sistema vai cancelar sua vaga automaticamente."),
    ], "e15", i++),

    // ── ETAPA 15 — CTA Final → repaginação pra VSL (mesmo domínio)
    grp("e15", "ETAPA 15 - CTA Final", [
      choice(undefined, ["QUERO ASSISTIR E ATIVAR MINHA BOLSA"]),
    ], "vsl", i++),

    // ── VSL — página da VSL (banner + player VTurb + botão liberado após pitch)
    grp("vsl", "VSL - Ativar Bolsa", [
      vslBlock(),
    ], undefined, i++),
  ];

  return {
    startGroup: "e01",
    groups,
    variables: ["nome", "whatsapp", "idade", "filhos", "regiao", "ocupacao", "situacao", "experiencia", "sonho", "fase", "acompanha", "curso", "apoio"],
    theme: { ...TB_DEFAULT_THEME, avatarUrl: CDB_SONIA, botName: "Sônia 🧡" },
    typing: { enabled: true, speed: 28, maxDelay: 1.4 },
  };
}
