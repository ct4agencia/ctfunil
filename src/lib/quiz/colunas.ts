/**
 * Colunas de resposta de um funil — modelo ÚNICO para a tela e para o CSV.
 *
 * Antes existiam dois modelos divergentes:
 *   • a TELA nomeava a coluna pelo TEXTO da pergunta (vindo de quiz_answers) —
 *     renomear a pergunta criava uma coluna nova e órfã;
 *   • o CSV nomeava pelo `layer.id` — imune a rename, mas ilegível ("options:
 *     lyr_a1b2"), e por isso os dois nunca se reconciliavam.
 *
 * O inlead resolve com um campo só: o "ID/Name" do bloco. É ele que aparece no
 * chip da tabela E no cabeçalho da planilha (conferido nos prints 12, 13, 16 e
 * 20 em `fotos quizzes/inlead/`). Este módulo implementa esse modelo.
 *
 * REGRA DE OURO: `key` é RÓTULO. A junção resposta↔coluna usa `stepId`/`layerId`.
 * Renomear o ID/Name muda só o cabeçalho — nunca órfã o histórico.
 */

/**
 * `passou` é a lâmina SEM bloco interativo (só texto, imagem, loading, vídeo…).
 * Ela não tem resposta para guardar, mas precisa aparecer: sem isso um funil de
 * 19 lâminas mostrava 12 colunas e não dava pra ver onde a lead parou. A célula
 * é derivada de `max_step_reached`, igual ao "clicked" do botão.
 */
export type ColKind = "options" | "button" | "field" | "passou";

export interface FunnelCol {
  /** chave estável e legível: vira o chip na tela e o header do CSV */
  key: string;
  /** `${kind}: ${key}` — idêntico ao header que o CSV já emite hoje */
  header: string;
  kind: ColKind;
  /** rótulo humano do tipo, para o cabeçalho da tabela */
  label: string;
  /** id da LÂMINA — usado para juntar com quiz_answers.step_id */
  stepId: string;
  /** índice entre as lâminas ATIVAS (é o que max_step_reached conta) */
  stepIdx: number;
  /** título da lâmina: vira o cabeçalho de grupo (linha de cima) */
  stepTitle: string;
  /** id do BLOCO. Chave de junção interna — NUNCA é o `key`. */
  layerId: string;
  /** só para kind="field": nome do campo (telefone, nome, email…) */
  fieldName?: string;
}

/** Respostas de blocos removidos continuam consultáveis pelo ID registrado. */
export function incluirColunasHistoricas(
  cols: FunnelCol[],
  answers: { step_id?: string | null; question?: string | null }[],
): FunnelCol[] {
  const known = new Set(cols.map(col => col.layerId));
  const keys = new Set(cols.map(col => col.key));
  const groups = new Set(cols.map(col => col.stepId));
  const stepIdx = cols.reduce((max, col) => Math.max(max, col.stepIdx + 1), 0);
  let stepId = "historico-typebot";
  while (groups.has(stepId)) stepId += "-";
  const historic: FunnelCol[] = [];
  for (const answer of answers) {
    const layerId = answer.step_id;
    if (!layerId || known.has(layerId)) continue;
    known.add(layerId);
    const base = `historico_${normalizarChave(layerId) || historic.length + 1}`;
    let key = base;
    for (let suffix = 2; keys.has(key); suffix++) key = `${base}#${suffix}`;
    keys.add(key);
    historic.push({
      key, header: `field: ${key}`, kind: "field", layerId, stepId, stepIdx,
      stepTitle: "Respostas anteriores", label: answer.question?.trim().slice(0, 100) || "Bloco anterior",
    });
  }
  return [...cols, ...historic];
}

/** Reúne respostas com identificador de sessão mesmo quando a visita fica fora do recorte. */
export function incluirSessoesComRespostas<T extends { session_id: string | null; created_at: string | null }>(
  sessions: T[],
  answers: { session_id?: string | null; created_at?: string | null }[],
) {
  const known = new Set(sessions.map(session => session.session_id));
  const dates = new Map<string, string>();
  for (const answer of answers) {
    const id = answer.session_id;
    const when = answer.created_at;
    if (!id || known.has(id) || !when || !Number.isFinite(Date.parse(when))) continue;
    const previous = dates.get(id);
    if (!previous || Date.parse(when) < Date.parse(previous)) dates.set(id, when);
  }
  if (!dates.size) return sessions;
  return [
    ...sessions,
    ...Array.from(dates, ([session_id, created_at]) => ({ session_id, created_at, max_step_reached: null, fromAnswer: true as const })),
  ].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
}

/** Cabeçalho de grupo: uma lâmina, abrangendo N colunas. */
export interface FunnelColGroup {
  stepId: string;
  stepIdx: number;
  stepTitle: string;
  /** quantas colunas esta lâmina ocupa (colSpan) */
  span: number;
}

const LABEL: Record<ColKind, string> = { options: "Opções", button: "Botão", field: "Campo", passou: "Passou" };

/**
 * Normaliza o ID/Nome digitado no construtor.
 *
 * O valor vira chave de webhook e cabeçalho de CSV, então acento e espaço
 * atrapalham quem consome do outro lado. "Faixa Etária" -> "Faixa_Etaria",
 * o mesmo padrão do inlead e dos nomes que já existem no cdb-01.
 *
 * Devolve "" para entrada só de símbolos — aí `keyOf` cai no próximo fallback
 * em vez de criar uma coluna sem nome.
 */
export function normalizarChave(v: string): string {
  return (v || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")    // á -> a
    .replace(/[^A-Za-z0-9_-]+/g, "_")                    // espaço, ç, pontuação
    .replace(/^_+|_+$/g, "")                             // sem _ nas pontas
    .slice(0, 40);
}

/** Remove HTML do Quill e normaliza espaços. */
const semTags = (h?: unknown): string =>
  String(h ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chave da coluna, em ordem de preferência. O passo 2 é o que conserta os
 * campos: hoje `webhookKey` NUNCA existe em layer (só em step), então `field:`
 * caía sempre no id opaco em vez de sair como `field: telefone`.
 */
function keyOf(l: any, step: any, idx: number): string {
  return String(
    l?.webhookKey                                             // 1. apelido do BLOCO (editável no construtor)
    // 2. nome do campo — já existe no dado. O `content.type` como 2º fallback
    //    reproduz exatamente o que export-leads/route.ts:51 fazia, pra header
    //    de CSV de funil existente não mudar.
    || (l?.type === "field" ? (l?.content?.name || l?.content?.type || "") : "")
    || step?.webhookKey                                        // 3. apelido da LÂMINA (motor tipado)
    || l?.id                                                   // 4. id opaco — é o que o CSV emite hoje
    || idx,
  );
}

/**
 * Colunas na ordem do funil (lâminas ativas, blocos na ordem em que aparecem).
 * Chaves repetidas ganham sufixo `#2`, `#3`… — dois campos "telefone" em lâminas
 * diferentes gerariam headers idênticos e o CSV ficaria ambíguo.
 */
export function colunasDoFunil(steps: any[], settings?: unknown): FunnelCol[] {
  const config = settings as { engine?: string; typebot?: { groups?: unknown } } | undefined;
  if (config?.engine === "typebot" && Array.isArray(config.typebot?.groups)) {
    steps = config.typebot.groups.flatMap(group => {
      if (!group || typeof group.id !== "string" || !Array.isArray(group.blocks)) return [];
      const layers = group.blocks.flatMap((block: any) => {
        if (typeof block?.id !== "string" || typeof block.type !== "string" || !block.type.startsWith("input-")) return [];
        const choice = ["input-choice", "input-picture", "input-cards", "input-rating"].includes(block.type);
        return [{
          id: block.id,
          type: choice ? "options" : "field",
          webhookKey: typeof block.variable === "string" && block.variable.trim() ? block.variable : block.id,
          content: { name: block.type === "input-phone" ? "telefone" : block.variable },
        }];
      });
      return layers.length ? [{ id: group.id, title: group.title, layers }] : [];
    });
  }
  const cols: FunnelCol[] = [];
  const usadas = new Map<string, number>();
  const ativos = (steps || []).filter((s) => !s?.disabled);

  ativos.forEach((step, idx) => {
    const stepId = String(step?.id ?? idx);
    const stepTitle = semTags(step?.title) || `Lâmina ${idx + 1}`;
    const layers: any[] = Array.isArray(step?.layers) ? step.layers : [];

    const push = (kind: ColKind, bruta: string, layerId: string, fieldName?: string) => {
      const n = (usadas.get(bruta) ?? 0) + 1;
      usadas.set(bruta, n);
      const key = n > 1 ? `${bruta}#${n}` : bruta;
      cols.push({ key, header: `${kind}: ${key}`, kind, label: LABEL[kind], stepId, stepIdx: idx, stepTitle, layerId, fieldName });
    };

    const antes = cols.length;

    // motor TIPADO: a lâmina inteira é a unidade (não tem blocos)
    if (!layers.length) {
      if (step?.type === "question" || step?.type === "slider" || step?.type === "measure") {
        push("options", String(step?.webhookKey || stepId), stepId);
      }
    } else {
      for (const l of layers) {
        if (l?.design?.hidden) continue;          // bloco oculto não roda, não vira coluna
        const layerId = String(l?.id ?? "");
        if (l?.type === "options") push("options", keyOf(l, step, idx), layerId);
        else if (l?.type === "button") push("button", keyOf(l, step, idx), layerId);
        else if (l?.type === "field" || (l?.type === "price" && l?.content?.checkbox)) {
          const nome = String(l?.content?.name || l?.content?.type || layerId);
          push("field", keyOf(l, step, idx), layerId, nome);
        }
      }
    }

    // TODA lâmina ativa precisa de pelo menos uma coluna. As puramente
    // informativas (VAGAS, Pós-Captura, Carregando…) não têm o que responder,
    // mas mostram se a lead chegou até ali — que é como se vê onde ela parou.
    //
    // A chave vem do `webhookKey` da LÂMINA porque aqui não há bloco para
    // nomear: é o único jeito de a coluna de um slider, raspadinha ou medidor
    // deixar de se chamar "zSikDv" na planilha.
    if (cols.length === antes) push("passou", String(step?.webhookKey || stepId), stepId);
  });
  return cols;
}

/** Agrupa as colunas por lâmina — é a linha de cima do cabeçalho no inlead. */
export function gruposDeColunas(cols: FunnelCol[]): FunnelColGroup[] {
  const grupos: FunnelColGroup[] = [];
  for (const c of cols) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult.stepId === c.stepId) { ult.span++; continue; }
    grupos.push({ stepId: c.stepId, stepIdx: c.stepIdx, stepTitle: c.stepTitle, span: 1 });
  }
  return grupos;
}
