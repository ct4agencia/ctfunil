/**
 * Constrói o cdb-type01-copia com a COPY NOVA (Doc 16F9Bj...), reusando áudios,
 * apostila, VSL e checkout do cdb-type01. Só a foto da apostila é mantida.
 * Uso: node scripts/build-type01-copia.cjs [apply]
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8"); const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
  return env;
}
const vslCfg = JSON.parse(readFileSync(join(__dirname, ".vsl-embed.txt"), "utf8"));
const AUDIO1 = "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/1782952420046-1_27s_WhatsApp_Audio_2026-07-01_at_19.23.16.ogg";
const AUDIO2 = "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/1782952508476-2_40s_WhatsApp_Audio_2026-07-01_at_19.23.16.ogg";
const APOSTILA = "https://mmoahavnqucxmpnnprct.supabase.co/storage/v1/object/public/vsl-assets/uploads/opt-md-Vw2vD-1d8ebb39-c0ea-4334-a40b-8600e8750876.webp";

let _i = 0; const id = () => `b${(++_i).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const chars = (r) => [...(r || "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim()].length;
const seg = (n) => Math.min(4.5, Math.max(0.8, Math.round((0.5 + n / 35) * 10) / 10));
const t = (richText) => ({ id: id(), type: "text", richText });
const w = (seconds) => ({ id: id(), type: "wait", seconds });
const voice = (duration, url) => ({ id: id(), type: "voice", duration, url });
const img = (url) => ({ id: id(), type: "image", url });
const choice = (variable, labels) => ({ id: id(), type: "input-choice", ...(variable ? { variable } : {}), items: labels.map((label) => ({ id: id(), label })) });
const inputText = (variable, placeholder) => ({ id: id(), type: "input-text", variable, placeholder, button: "Enviar" });
const inputPhone = (variable, placeholder) => ({ id: id(), type: "input-phone", variable, placeholder, button: "Enviar" });
const BUBBLE = new Set(["text", "image", "voice"]);
// interleava wait proporcional entre bolhas consecutivas
function msgs(...bs) {
  const out = [];
  bs.forEach((b, i) => { out.push(b); if (i < bs.length - 1 && BUBBLE.has(b.type)) out.push(w(b.type === "text" ? seg(chars(b.richText)) : 1.4)); });
  return out;
}
let gi = 0;
const grp = (gid, title, blocks, to) => ({ id: gid, title, x: 40 + (gi++) * 320, y: 40, blocks, to });

const groups = [
  grp("b1", "Bloco 1 - Hero", [
    ...msgs(
      t("Oii! Tudo bem? 😊"),
      t("Vi que você se interessou em aprender a fazer bolsas artesanais na tela em casa…"),
      t("Me responde uma coisa rapidinho: você gostaria mesmo de ganhar **R$5.000 por mês** fazendo bolsas aí de casa? 😊"),
    ),
    choice(undefined, ["Sim, quero! 🙌"]),
  ], "b2"),

  grp("b2", "Bloco 2 - Reserva da Vaga", [
    t("Amei! 🥰"), w(1.2),
    t("Deixa eu ver aqui se ainda tem vaga no seu estado…"), w(3),
    t("Achei! ✅"), w(1.2),
    t("Consegui **reservar uma vaga** pra você no maior treinamento de bolsas do Brasil."), w(6),
    voice("0:27", AUDIO1),
    choice(undefined, ["Pode sim! 👏"]),
  ], "b3"),

  grp("b3", "Bloco 3 - Idade", [t("Quantos anos você tem? 🎂"), choice("idade", ["18 a 34", "35 a 54", "55 a 64", "+65"])], "b4"),
  grp("b4", "Bloco 4 - Filhos", [t("Você tem filhos? 👶"), choice("filhos", ["Sim", "Não"])], "b5"),
  grp("b5", "Bloco 5 - Ocupação", [t("Hoje em dia, qual é a sua ocupação? 💼"), choice("ocupacao", ["Só trabalho", "Só estudo", "Aposentada", "Dona de casa", "Trabalho e estudo"])], "b6"),
  grp("b6", "Bloco 6 - Situação atual", [t("E me conta: com qual dessas situações você mais se identifica hoje?"), choice("situacao", ["Trabalho muito e ganho pouco 💪", "Não tenho uma profissão definida", "Busco algo que me dê liberdade e renda extra 🤍", "Insatisfeita e querendo mudar de vida 😔"])], "b7"),
  grp("b7", "Bloco 7 - Experiência", [t("Sobre bolsas artesanais… qual seu nível hoje? 🧶"), choice("experiencia", ["Nunca fiz", "Sou iniciante", "Já tenho experiência 🧵"])], "b8"),
  grp("b8", "Bloco 8 - Sonho", [
    ...msgs(t("Imagina que você já está ganhando esses **R$5.000 por mês**… 💰"), t("Qual seria a **primeira coisa** que você faria com esse dinheiro?")),
    choice("sonho", ["Sair do meu emprego 🚶‍♀️", "Abrir meu próprio ateliê 🏠", "Ajudar minha família ❤️", "Realizar um sonho antigo 💭"]),
  ], "b9"),
  grp("b9", "Bloco 9 - Fase de vida", [t("E hoje, em que fase da sua vida você sente que está?"), choice("fase", ["Estou recomeçando do zero", "Sempre gostei de trabalhos manuais", "Cansei de depender dos outros", "Quero algo que seja só meu"])], "b10"),
  grp("b10", "Bloco 10 - Acompanha conteúdo", [t("Você já acompanha algum conteúdo sobre bolsas artesanais? (YouTube, Instagram, TikTok) 📱"), choice("acompanha", ["Sim, acompanho muito", "Vejo às vezes", "Não acompanho"])], "b11"),
  grp("b11", "Bloco 11 - Curso online", [t("E curso online, você já fez algum antes? 💻"), choice("curso", ["Sim, já fiz e concluí 💪", "Comecei mas não terminei 😩", "Nunca fiz ❌"])], "b12"),
  grp("b12", "Bloco 12 - Rede de apoio", [t("Última perguntinha! Durante o curso, você teria alguém pra te apoiar, seja emocional ou financeiramente?"), choice("apoio", ["Sim, com certeza 🙏", "Talvez 🤔", "Não 🙁"])], "b13"),

  grp("b13", "Bloco 13 - Resultado", [
    ...msgs(
      t("Prontinho! Deixa eu analisar suas respostas aqui… 📊"),
    ), w(3),
    ...msgs(
      t("Uau! 😱 Não acredito…"),
      t("Você atingiu **94% de compatibilidade** com o perfil ideal pra receber a **bolsa de estudos de 6 meses** do Clube das Bolsas! 🎉"),
      t("O mínimo necessário era 87%, e você foi muito além! 🚀"),
      t("Você tem tudo que a gente procura numa aluna. Que orgulho! 🥹"),
    ),
    choice(undefined, ["Quero ativar minha bolsa! 🎓"]),
  ], "b14"),

  grp("b14", "Bloco 14 - Apresentação Sônia", [
    w(4), voice("0:47", AUDIO2), w(35),
    t("E pra gente começar com o pé direito, eu preparei um **presente de boas-vindas** que você vai amar 🎁"),
    choice(undefined, ["Quero meu presente! 🎁"]),
  ], "b15"),

  grp("b15", "Bloco 15 - Apostila", [
    t("Como forma de reconhecimento por ter chegado até aqui… 🎁"), w(2),
    img(APOSTILA), w(1.4),
    t("Vou te mandar de graça uma **apostila super completa** de como fazer **Bolsas de Celular em Crochê** 📘✨"), w(3),
    t("Ela ensina do zero, mesmo pra quem nunca fez nada de crochê na vida!"),
    choice(undefined, ["Adorei, quero receber! 🥰"]),
  ], "b16"),

  grp("b16", "Bloco 16 - Captura", [
    t("Para eu confirmar sua bolsa e enviar a apostila, preciso que você preencha seus dados:"), w(2),
    t("Como você gostaria que eu te chamasse?"),
    inputText("nome", "Digite seu nome…"),
    t("Agora só me confirma o seu WhatsApp com DDD."), w(1.5),
    t("Para que possamos **concluir o cadastro da sua bolsa de estudos!**"),
    inputPhone("whatsapp", "WhatsApp com DDD"),
  ], "b17"),

  grp("b17", "Bloco 17 - Fechamento", [
    ...msgs(
      t("Prontinho, **{nome}**! 🥳"),
      t("Já anotei tudo aqui. Daqui a pouquinho vou te mandar a apostila e umas mensagens especiais, combinado? 😊"),
      t("Ah, importante: eu **só consigo te ajudar se você responder minhas mensagens**, então fica de olho nas notificações pra não me deixar no vácuo, viu? 🔔"),
      t("Agora sim… vamos ativar a sua bolsa de estudos! ⬇️"),
    ),
    choice(undefined, ["Quero ativar minha Bolsa de Estudos 🎓"]),
  ], "b18"),

  grp("b18", "Bloco 18 - Encaminhamento VSL", [
    ...msgs(
      t("Agora clique no botão abaixo e veja um **vídeo rapidinho**, onde eu te explico tudo que você vai aprender no Clube das Bolsas 🎥"),
      t("E o mais importante: eu te mostro **o passo a passo pra ativar a sua bolsa de estudos de 6 meses** que você acabou de conquistar 🎓"),
      t("⚠️ **Só um aviso importante:** pra você **não correr o risco de perder a sua bolsa**, é essencial assistir o vídeo **até o final**, tá?"),
    ),
    choice(undefined, ["QUERO ASSISTIR E ATIVAR MINHA BOLSA"]),
  ], "vsl"),

  grp("vsl", "VSL - Ativar Bolsa", [
    { id: id(), type: "vsl", ...vslCfg },
  ], undefined),
];

async function main() {
  const apply = process.argv[2] === "apply";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: f } = await sb.from("funnels").select("settings").eq("slug", "cdb-type01-copia").maybeSingle();
  if (!f) throw new Error("cdb-type01-copia não encontrado");
  const oldTb = f.settings.typebot || {};
  const tb = {
    startGroup: "b1",
    groups,
    variables: ["nome", "whatsapp", "idade", "filhos", "ocupacao", "situacao", "experiencia", "sonho", "fase", "acompanha", "curso", "apoio"],
    theme: oldTb.theme,   // mantém a aparência (Sônia, avatar, cores)
    typing: oldTb.typing || { enabled: true, speed: 28, maxDelay: 1.4 },
  };
  console.log(`Grupos: ${groups.length} | waits: ${groups.flatMap((g) => g.blocks).filter((b) => b.type === "wait").length} | áudios: ${groups.flatMap((g) => g.blocks).filter((b) => b.type === "voice").length} | imgs: ${groups.flatMap((g) => g.blocks).filter((b) => b.type === "image").length}`);
  if (apply) {
    const settings = { ...f.settings, engine: "typebot", typebot: tb };
    const { error } = await sb.from("funnels").update({ settings, updated_at: new Date().toISOString() }).eq("slug", "cdb-type01-copia");
    if (error) throw error;
    console.log("✅ cdb-type01-copia reconstruído com a copy nova");
  } else {
    console.log("(dry-run — rode com 'apply')");
  }
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
