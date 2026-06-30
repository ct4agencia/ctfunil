import type { TbBlock, TbFunnel, TbGroup } from "./types";
import { TB_DEFAULT_THEME } from "./types";

/**
 * Funil typebot "Clube das Bolsas" — montado 1:1 a partir do Doc
 * "Fluxo TypeBot - Clube das Bolsas" (12 etapas + 11 perguntas, formato chat).
 * Reaproveita as imagens reais do CDN do inlead/cdb01.
 */
const CDB_CDN = "https://media.inlead.cloud/uploads/17937";
const CDB_SONIA = `${CDB_CDN}/2025-10-01/md-FWlAd-logo-55.png`;
const CDB_GALLERY = `${CDB_CDN}/2026-01-14/md-RCBzs-mac-10.png`;
const CDB_APOSTILA = `${CDB_CDN}/2026-03-19/md-Vw2vD-1d8ebb39-c0ea-4334-a40b-8600e8750876.png`;
const CDB_CHECKOUT = "https://clubedasbolsas3.com.br/cdb01/";

let _n = 0;
const bid = () => `b${++_n}`;
const txt = (s: string): TbBlock => ({ id: bid(), type: "text", richText: s });
const img = (url: string): TbBlock => ({ id: bid(), type: "image", url });
const wait = (seconds: number): TbBlock => ({ id: bid(), type: "wait", seconds });
const inputText = (variable: string, placeholder: string): TbBlock => ({ id: bid(), type: "input-text", variable, placeholder, button: "Enviar" });
const inputPhone = (variable: string): TbBlock => ({ id: bid(), type: "input-phone", variable, placeholder: "Digite seu WhatsApp com DDD", button: "Enviar" });
const choice = (variable: string | undefined, labels: string[]): TbBlock => ({
  id: bid(), type: "input-choice", variable, items: labels.map((l) => ({ id: bid(), label: l })),
});

/** açúcar: cria um grupo com título, blocos e próximo grupo */
const grp = (id: string, title: string, blocks: TbBlock[], to: string | undefined, i: number): TbGroup =>
  ({ id, title, x: 40 + i * 300, y: 40, blocks, to });

export function clubeDasBolsasTypebot(): TbFunnel {
  _n = 0;
  const groups: TbGroup[] = [
    grp("inicio", "Abertura", [
      txt("Oi! Tudo bem?"),
      wait(2),
      txt("Você está aqui porque foi selecionada para receber uma **Bolsa de Estudos de 6 meses** no Clube das Bolsas."),
      wait(2),
      txt("O maior treinamento do Brasil onde mulheres aprendem a fazer bolsas em crochê e ganham **R$ 5.000 por mês** sem sair de casa."),
    ], "estado", 0),

    grp("estado", "Pergunta: Estado", [
      txt("Mas antes, preciso confirmar uma coisa."),
      txt("Qual é o seu estado?"),
      inputText("estado", "Digite seu estado"),
    ], "vagas", 1),

    grp("vagas", "Vagas Disponíveis", [
      txt("Perfeito! Ainda temos **4 vagas disponíveis** em {estado}."),
      wait(1),
      txt("Sua bolsa está QUASE garantida! ✅"),
    ], "nome", 2),

    grp("nome", "Captura de Nome", [
      txt("Como você gosta de ser chamada?"),
      inputText("nome", "Digite seu nome"),
    ], "sonia", 3),

    grp("sonia", "Apresentação Sônia", [
      txt("Prazer, {nome}. Meu nome é Sônia. 🧡"),
      wait(2),
      txt("Vou te mandar um presente no WhatsApp: uma **Apostila SUPER COMPLETA** de como fazer Suéter em Crochê."),
      txt("Dá uma olhada nessas peças lindas:"),
      img(CDB_GALLERY),
      wait(1),
      txt("Qual seu WhatsApp com DDD?"),
      inputPhone("whatsapp"),
    ], "confirma", 4),

    grp("confirma", "Confirmação WhatsApp", [
      txt("Perfeito! ✅"),
      txt("Já vou enviar a apostila no seu WhatsApp."),
      img(CDB_APOSTILA),
    ], "transicao", 5),

    grp("transicao", "Transição para Quiz", [
      txt("Agora, antes de você assistir o vídeo, vou fazer algumas perguntas rápidas."),
      wait(1),
      txt("Isso vai me ajudar a personalizar tudo para você."),
      txt("Tá bom?"),
      choice(undefined, ["Bora lá 🚀"]),
    ], "p1", 6),

    grp("p1", "Idade", [
      txt("Quantos anos você tem?"),
      choice("idade", ["18 a 34 anos", "35 a 44 anos", "45 a 54 anos", "55+ anos"]),
    ], "p2", 7),

    grp("p2", "Filhos", [
      txt("Você tem filhos?"),
      choice("filhos", ["Sim", "Não"]),
    ], "p3", 8),

    grp("p3", "Ocupação", [
      txt("Qual sua ocupação hoje?"),
      choice("ocupacao", ["Trabalho", "Estudo", "Aposentada", "Dona de casa", "Trabalho e estudo"]),
    ], "p4", 9),

    grp("p4", "Situação de Vida", [
      txt("Em qual situação você se vê hoje?"),
      choice("situacao", ["Trabalho muito e ganho pouco", "Sem profissão definida", "Buscando liberdade e renda extra", "Insatisfeita e querendo mudança"]),
    ], "p5", 10),

    grp("p5", "Experiência com Bolsas", [
      txt("Qual seu nível com bolsas artesanais?"),
      choice("experiencia", ["Nunca fiz", "Sou iniciante", "Já tenho experiência"]),
    ], "p6", 11),

    grp("p6", "Sonho com R$ 5.000/mês", [
      txt("Se ganhasse **R$ 5.000/mês** com bolsas, o que faria?"),
      choice("sonho", ["Sair do meu emprego", "Abrir meu próprio ateliê", "Ajudar minha família", "Realizar um sonho antigo"]),
    ], "p7", 12),

    grp("p7", "Fase da Vida", [
      txt("Em que fase da vida você está?"),
      choice("fase", ["Buscando independência financeira", "Quero ter renda própria", "Quero recomeçar minha vida", "Quero mais liberdade financeira"]),
    ], "p8", 13),

    grp("p8", "Acompanha Conteúdo", [
      txt("Você acompanha conteúdo sobre bolsas artesanais?"),
      choice("acompanha", ["Sim, acompanho muito", "Vejo às vezes", "Não acompanho"]),
    ], "p9", 14),

    grp("p9", "Cursos Online", [
      txt("Você já fez algum curso online antes?"),
      choice("curso", ["Sim, já fiz e concluí", "Comecei, mas não terminei", "Nunca fiz"]),
    ], "p10", 15),

    grp("p10", "Apoio", [
      txt("Durante o curso, teria alguém pra te apoiar?"),
      choice("apoio", ["Sim, com certeza", "Talvez", "Não"]),
    ], "p11", 16),

    grp("p11", "Comprometimento", [
      txt("Você está realmente comprometida em aprender e ganhar **R$ 5.000/mês**?"),
      choice("comprometimento", ["Sim, totalmente", "Mais ou menos", "Não tenho certeza"]),
    ], "processa", 17),

    grp("processa", "Processamento", [
      txt("Carregando suas respostas... ⏳"),
      txt("Espera só um instante."),
      wait(3),
    ], "resultado", 18),

    grp("resultado", "Resultado Final", [
      txt("Uau! 😱"),
      wait(1),
      txt("Você atingiu **94% de compatibilidade**!"),
      wait(1),
      txt("Parabéns, {nome}! Sua **Bolsa de Estudos de 6 meses** está 100% GARANTIDA! ✅"),
    ], "bridge", 19),

    grp("bridge", "Bridge para VSL", [
      txt("Agora assiste o vídeo que eu gravei."),
      txt("Nele eu explico tudo que você vai aprender e como ativar sua Bolsa de Estudos de 6 meses."),
    ], "urgencia", 20),

    grp("urgencia", "Aviso de Urgência", [
      txt("⚠️ **IMPORTANTE!**"),
      txt("Se você sair do vídeo antes do fim, o sistema vai cancelar sua vaga."),
      txt("Assista até o final, tá bom?"),
    ], "cta", 21),

    grp("cta", "CTA Final", [
      choice(undefined, ["QUERO ASSISTIR E ATIVAR MINHA BOLSA"]),
    ], "checkout", 22),

    grp("checkout", "Redirect", [
      { id: bid(), type: "redirect", url: CDB_CHECKOUT, newTab: false },
    ], undefined, 23),
  ];

  return {
    startGroup: "inicio",
    groups,
    variables: ["estado", "nome", "whatsapp", "idade", "filhos", "ocupacao", "situacao", "experiencia", "sonho", "fase", "acompanha", "curso", "apoio", "comprometimento"],
    theme: { ...TB_DEFAULT_THEME, avatarUrl: CDB_SONIA, guestBubbleBg: "#ea580c", buttonBg: "#ea580c" },
    typing: { enabled: true, speed: 28, maxDelay: 1.4 },
  };
}
