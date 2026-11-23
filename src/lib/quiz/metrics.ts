import type { Funnel } from "@/lib/quiz/types";
import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveFunnel, listFunnelsDb } from "./funnels-db";
import type { Step } from "./types";

export interface DashboardMetrics {
  totalFunis: number;
  totalSessoes: number;
  totalRespostas: number;
  totalLeads: number;
  totalConclusoes: number;
  taxaConclusao: number;
  daily: { day: string; sessoes: number }[];
  porFunil: { slug: string; name: string; sessoes: number; pct: number; color: string }[];
}

const DONUT_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444"];

/** M11: partes da data no fuso de São Paulo (gráficos diário/horário). */
const SP_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", hour12: false,
});
function spParts(d: Date): { day: string; month: string; hour: string } {
  const p = Object.fromEntries(SP_FMT.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: p.day, month: p.month, hour: p.hour === "24" ? "00" : p.hour };
}

/** Métricas agregadas (overview do dashboard, estilo Datacrazy). */
/** Índices de estágio (1ª pergunta / captura / fim) de um funil — reusável em
 *  dashboardMetrics (batch) e funnelMetrics. Espelha a lógica: typebot usa grupos;
 *  layers computa sobre lâminas ATIVAS (o runtime pula as desativadas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stageIdx(f: { steps: any; settings: any }): { firstQ: number; captureI: number; lastI: number; totalSteps: number } {
  const steps = (f.steps as Step[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbGroups: any[] | null = f.settings?.engine === "typebot" && Array.isArray((f.settings as any)?.typebot?.groups) ? (f.settings as any).typebot.groups : null;
  if (tbGroups) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qi = tbGroups.findIndex((g: any) => Array.isArray(g?.blocks) && g.blocks.some((b: any) => typeof b?.type === "string" && b.type.startsWith("input-")));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ci = tbGroups.findIndex((g: any) => Array.isArray(g?.blocks) && g.blocks.some((b: any) => b?.type === "input-phone"));
    const lastI = Math.max(0, tbGroups.length - 1);
    return { firstQ: qi < 0 ? 1 : qi, captureI: ci < 0 ? Math.max(0, lastI - 1) : ci, lastI, totalSteps: tbGroups.length };
  }
  const enabled = steps.filter((s) => !(s as { disabled?: boolean }).disabled);
  const { firstQ, captureI, lastI } = stageIndices(enabled.length ? enabled : steps);
  return { firstQ, captureI, lastI, totalSteps: enabled.length || steps.length };
}

/**
 * A coluna `hydrated_at` só passa a existir depois da migration 0014. Enquanto
 * ela não roda, filtrar por ela faz o PostgREST devolver 42703 e TODA contagem
 * virar 0 — o painel exibe "funil morto" em vez de erro. Detectamos uma vez e,
 * sem a coluna, contamos como antes (todas as sessões). Assim o deploy pode ir
 * ao ar antes da migration e passa a excluir beacon-only assim que ela rodar.
 */
let _hydratedAt: boolean | null = null;
/**
 * Só cacheia o que é PERMANENTE: sucesso, ou 42703 (coluna realmente ausente).
 * Antes, `_hydratedAt = !error` gravava `false` em qualquer falha — inclusive
 * uma queda de rede momentânea. Como a variável é de módulo, a instância
 * serverless passava a contar TODAS as sessões como visitante até morrer, e
 * duas instâncias devolviam números diferentes para o mesmo funil.
 */
async function hydratedAtDisponivel(issues?: MetricsIssue[], client?: ReturnType<typeof createAdminClient>): Promise<boolean> {
  if (_hydratedAt !== null) return _hydratedAt;
  const { error } = await (client ?? createAdminClient()).from("funnel_sessions").select("hydrated_at").limit(1);
  if (!error) { _hydratedAt = true; return true; }
  if (error.code === "42703") {         // coluna não existe: migration 0014 pendente
    _hydratedAt = false;
    console.warn("[metrics] hydrated_at ausente (migration 0014 pendente) — Visitante conta TODAS as sessões");
    return false;
  }
  // transitório: NÃO cacheia, e avisa que "Visitantes" está com outra definição
  issues?.push({
    code: "db_error",
    msg: "Banco instável ao conferir a definição de Visitante — o número pode estar inflado.",
    campos: ["visitantes"],
    detalhe: `${error.code ?? ""} ${error.message}`.trim(),
  });
  return false;
}

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const sb = createAdminClient();
  const usaHidratacao = await hydratedAtDisponivel();
  const soHidratadas = <T>(q: T): T => (usaHidratacao ? (q as { not: (a: string, b: string, c: null) => T }).not("hydrated_at", "is", null) : q);
  // ANTES: ~5 queries POR funil (17×5 ≈ 85). AGORA: 4 queries agregadas + JS.
  const sinceDaily = new Date(Date.now() - 7 * 86400000).toISOString();
  const [funRes, sessRes, leadRes, dailyRes] = await Promise.all([
    sb.from("funnels").select("slug,name,steps,settings").order("updated_at", { ascending: false }),
    // Visitante = hidratou (hydrated_at not null) — mesma regra do funnelMetrics.
    soHidratadas(sb.from("funnel_sessions").select("funnel_slug,max_step_reached")).limit(100000),
    sb.from("funnel_leads").select("funnel_slug").limit(100000),
    soHidratadas(sb.from("funnel_sessions").select("created_at")).gte("created_at", sinceDaily).limit(100000),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const funis = (funRes.data ?? []) as any[];

  const sessByFunnel = new Map<string, number[]>();
  for (const s of sessRes.data ?? []) {
    const slug = s.funnel_slug as string;
    let arr = sessByFunnel.get(slug);
    if (!arr) { arr = []; sessByFunnel.set(slug, arr); }
    arr.push((s.max_step_reached as number) ?? 0);
  }
  const leadsByFunnel = new Map<string, number>();
  for (const l of leadRes.data ?? []) { const slug = l.funnel_slug as string; leadsByFunnel.set(slug, (leadsByFunnel.get(slug) ?? 0) + 1); }

  let totalSessoes = 0, totalRespostas = 0, totalLeads = 0, totalConclusoes = 0;
  const porFunil: DashboardMetrics["porFunil"] = [];
  funis.forEach((f, i) => {
    const idx = stageIdx(f);
    const ms = sessByFunnel.get(f.slug) ?? [];
    const visitantes = ms.length;
    const respostas = ms.filter((x) => x >= idx.firstQ).length;
    const conclusoes = ms.filter((x) => x >= idx.lastI).length;
    totalSessoes += visitantes; totalRespostas += respostas;
    totalLeads += (leadsByFunnel.get(f.slug) ?? 0); totalConclusoes += conclusoes;
    porFunil.push({ slug: f.slug, name: f.name, sessoes: visitantes, pct: 0, color: DONUT_COLORS[i % DONUT_COLORS.length] });
  });
  porFunil.forEach((p) => { p.pct = totalSessoes ? Math.round((p.sessoes / totalSessoes) * 1000) / 10 : 0; });
  porFunil.sort((a, b) => b.sessoes - a.sessoes);

  // diário (últimos 7 dias)
  const daily: { day: string; sessoes: number }[] = [];
  const buckets = new Map<string, number>();
  for (let d = 6; d >= 0; d--) { const { day, month } = spParts(new Date(Date.now() - d * 86400000)); buckets.set(`${day}/${month}`, 0); }
  for (const r of dailyRes.data ?? []) { const { day, month } = spParts(new Date(r.created_at as string)); const key = `${day}/${month}`; if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1); }
  for (const [day, sessoes] of buckets) daily.push({ day, sessoes });

  return {
    totalFunis: funis.length, totalSessoes, totalRespostas, totalLeads, totalConclusoes,
    taxaConclusao: totalSessoes ? Math.round((totalConclusoes / totalSessoes) * 1000) / 10 : 0,
    daily, porFunil,
  };
}

/* ════════════════════════════════════════════════════════════════
 * Analytics GLOBAL (9 abas, estilo Datacrazy). Agrega sobre todos os
 * funis: visão geral + quiz + tráfego + operação + leads. As abas sem
 * fonte de dados ainda (Vendas/Criativos/VSL/Diagnóstico) são marcadas
 * comingSoon e exibem painel honesto "entra na próxima etapa".
 * ════════════════════════════════════════════════════════════════ */
export interface GlobalAnalytics {
  overview: DashboardMetrics;
  quiz: { question: string; total: number; options: { label: string; value: number; pct: number }[] }[];
  traffic: {
    sources: { name: string; value: number; pct: number }[];
    campaigns: { name: string; value: number; pct: number }[];
    total: number;
  };
  operacao: {
    slug: string; name: string; visitantes: number; respostas: number; leads: number;
    conclusoes: number; taxaConclusao: number; score: number;
  }[];
  /** criativos/anúncios: leads e cliques por utm_content (fallback campanha/src) */
  creatives: { content: string; campaign: string; source: string; clicks: number; leads: number; conv: number; funnels: string[] }[];
  leads: { total: number; recent: { name: string; phone: string; funnel: string; when: string }[] };
}

function topN(map: Map<string, number>, n: number) {
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  return {
    total,
    list: Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: total ? Math.round((value / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, n),
  };
}

export async function globalAnalytics(): Promise<GlobalAnalytics> {
  // PERF: independentes — rodam em paralelo (antes eram 2 awaits em série).
  const [overview, funis] = await Promise.all([dashboardMetrics(), listFunnelsDb()]);

  // operação: KPIs por funil (paralelo)
  const ms = await Promise.all(funis.map((f) => funnelMetrics(f.slug)));
  const operacao: GlobalAnalytics["operacao"] = funis.map((f, i) => {
    const m = ms[i];
    return {
      slug: f.slug, name: f.name, visitantes: m.visitantes, respostas: m.respostas,
      leads: m.leads, conclusoes: m.conclusoes, taxaConclusao: m.taxaConclusao, score: m.score,
    };
  });
  operacao.sort((a, b) => b.visitantes - a.visitantes);

  // quiz: distribuição de respostas (quiz_answers)
  const quiz: GlobalAnalytics["quiz"] = [];
  const sources = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const creativeMap = new Map<string, { clicks: number; leads: number; campaign: string; source: string; funis: Map<string, number> }>();
  const leadsOut: GlobalAnalytics["leads"] = { total: 0, recent: [] };
  try {
    const sb = createAdminClient();
    // PERF: os 5 fetches são independentes — paralelizados (antes: em série).
    const [{ data: answers }, { data: sess }, { data: leadsC }, { count: leadTotal }, leadRowsRes] = await Promise.all([
      sb.from("quiz_answers").select("question,answer").limit(20000),
      sb.from("funnel_sessions").select("utm_source,utm_campaign,utm_content,src,funnel_slug").limit(20000),
      sb.from("funnel_leads").select("utm_source,utm_campaign,utm_content,src,funnel_slug").limit(20000),
      sb.from("funnel_leads").select("*", { count: "exact", head: true }),
      sb.from("funnel_leads").select("name,phone,funnel_slug,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    const qMap = new Map<string, Map<string, number>>();
    for (const a of answers ?? []) {
      const q = (a.question as string) || "—";
      if (!qMap.has(q)) qMap.set(q, new Map());
      const am = qMap.get(q)!;
      const ans = (a.answer as string) || "—";
      am.set(ans, (am.get(ans) ?? 0) + 1);
    }
    for (const [question, am] of Array.from(qMap.entries()).slice(0, 10)) {
      const total = Array.from(am.values()).reduce((x, y) => x + y, 0);
      quiz.push({
        question, total,
        options: Array.from(am.entries()).map(([label, value]) => ({ label, value, pct: total ? Math.round((value / total) * 1000) / 10 : 0 })).sort((a, b) => b.value - a.value).slice(0, 8),
      });
    }

    // tráfego global (funnel_sessions) — M9: src como fallback de origem (CTWA)
    for (const s of sess ?? []) {
      const srcVal = (((s.utm_source as string) || (s.src as string)) || "").trim();
      const camp = (((s.utm_campaign as string) || (s.utm_source as string) || (s.src as string)) || "").trim();
      if (srcVal) sources.set(srcVal, (sources.get(srcVal) ?? 0) + 1);
      if (camp) campaigns.set(camp, (campaigns.get(camp) ?? 0) + 1);
      // criativo = utm_content (fallback campanha/origem) → conta CLIQUES (sessões)
      const content = (((s.utm_content as string) || (s.utm_campaign as string) || (s.src as string)) || "").trim();
      if (content) {
        const e = creativeMap.get(content) || { clicks: 0, leads: 0, campaign: camp, source: srcVal, funis: new Map<string, number>() };
        e.clicks++; if (!e.campaign) e.campaign = camp; if (!e.source) e.source = srcVal;
        const fs = ((s as Record<string, unknown>).funnel_slug as string) || "";
        if (fs) e.funis.set(fs, (e.funis.get(fs) ?? 0) + 1);
        creativeMap.set(content, e);
      }
    }
    // leads por criativo (utm_content) — dados existentes em funnel_leads
    for (const l of leadsC ?? []) {
      const content = (((l.utm_content as string) || (l.utm_campaign as string) || (l.src as string)) || "").trim();
      if (!content) continue;
      const camp = (((l.utm_campaign as string) || (l.utm_source as string) || (l.src as string)) || "").trim();
      const srcVal = (((l.utm_source as string) || (l.src as string)) || "").trim();
      const e = creativeMap.get(content) || { clicks: 0, leads: 0, campaign: camp, source: srcVal, funis: new Map<string, number>() };
      e.leads++; if (!e.campaign) e.campaign = camp; if (!e.source) e.source = srcVal;
      const fs = ((l as Record<string, unknown>).funnel_slug as string) || "";
      if (fs) e.funis.set(fs, (e.funis.get(fs) ?? 0) + 1);
      creativeMap.set(content, e);
    }

    // A6: total de leads = contagem EXATA (não o tamanho da página de 50)
    const { data: leadRows, error: leadErr } = leadRowsRes;
    if (!leadErr && leadRows) {
      leadsOut.total = leadTotal ?? leadRows.length;
      leadsOut.recent = leadRows.slice(0, 12).map((l) => ({
        name: (l.name as string) || "—",
        phone: (l.phone as string) || "—",
        funnel: (l.funnel_slug as string) || "—",
        when: (l.created_at as string) || "",
      }));
    }
  } catch {
    /* sem dados */
  }

  const src = topN(sources, 8);
  const camp = topN(campaigns, 8);
  const creatives = Array.from(creativeMap.entries())
    .map(([content, v]) => ({
      content, campaign: v.campaign, source: v.source, clicks: v.clicks, leads: v.leads,
      conv: v.clicks ? Math.round((v.leads / v.clicks) * 1000) / 10 : 0,
      // funis onde o criativo rodou (mais tráfego primeiro), por SLUG (pedido do Luca)
      funnels: Array.from(v.funis.entries()).sort((a, b) => b[1] - a[1]).map(([slug]) => slug),
    }))
    .sort((a, b) => b.leads - a.leads || b.clicks - a.clicks)
    .slice(0, 50);
  return {
    overview, quiz, operacao, creatives, leads: leadsOut,
    traffic: { sources: src.list, campaigns: camp.list, total: src.total },
  };
}

/**
 * Métricas por funil (modelo do print "Performance" do inlead). Lê os dados
 * reais de funnel_sessions + step_events e agrega em JS. Best-effort.
 */

/**
 * Por que um número não é confiável. Lista vazia = tudo certo.
 *
 * Existe porque o supabase-js NÃO lança exceção em erro do PostgREST: devolve
 * `{ data: null, count: null, error }`. Como `error` era descartado e o código
 * caía em `?? 0`, um banco fora do ar produzia exatamente a mesma tela que um
 * funil sem tráfego — tudo zero, score "Crítico", rejeição 100%. Não dava pra
 * distinguir "quebrou" de "não vendeu".
 */
export interface MetricsIssue {
  code: "db_error" | "sem_funil" | "coluna_ausente" | "amostra_truncada" | "rpc_ausente";
  /** em português: é isto que aparece na tela */
  msg: string;
  /** quais campos de FunnelMetrics ficaram inválidos */
  campos: string[];
  /** código + mensagem do PostgREST — só tooltip técnico, nunca dado de lead */
  detalhe?: string;
}

/**
 * Retenção lâmina a lâmina, lida de `step_events.step_id`.
 *
 * Diferente do funil de 5 estágios, que usa `max_step_reached` (um ÍNDICE, que
 * se reinterpreta quando o funil é editado), aqui a chave é o `step_id` — que
 * é estável e viaja com a lâmina. Responde "onde eu perco gente" com precisão
 * de lâmina, não de estágio.
 *
 * Aditivo: não altera nenhum número existente da tela.
 */
export interface RetencaoLamina {
  stepId: string;
  /** título da lâmina hoje; "(lâmina removida)" para id órfão */
  titulo: string;
  /** posição atual no funil; -1 se a lâmina não existe mais */
  idx: number;
  /** sessões distintas que alcançaram esta lâmina */
  sessoes: number;
  /** % sobre a lâmina mais alcançada (normalmente a primeira) */
  pct: number;
  /** quantos por cento caíram em relação à lâmina anterior do funil */
  queda: number;
}

export interface DeviceSlice { label: string; value: number; pct: number }
/**
 * Mix de aparelho. Sai de `funnel_leads` (viewport/user_agent), a única tabela
 * que guarda esse dado — logo mede LEADS, não visitantes. Comparar com o Meta
 * Ads (que reporta por clique) não vai bater, e o rótulo tem que avisar.
 */
export interface DeviceMix {
  /** Mobile / Tablet / Desktop */
  tipo: DeviceSlice[];
  /** iOS / Android / Windows / macOS / Linux / Outro */
  so: DeviceSlice[];
  /** leads com ao menos um dado de aparelho */
  total: number;
  /** leads sem viewport nem user_agent — exibido, nunca escondido */
  semDado: number;
}

export interface FunnelMetrics {
  found: boolean;
  /**
   * true = ao menos um número não pôde ser calculado.
   * CONTRATO DA UI: com `degraded`, os campos listados em `issues[].campos`
   * NUNCA podem ser renderizados como número — têm que sair como "—".
   */
  degraded: boolean;
  issues: MetricsIssue[];
  name: string;
  totalSteps: number;
  visitantes: number;
  respostas: number;
  leads: number;
  conclusoes: number;
  taxaConclusao: number; // %
  taxaInteracao: number; // % (respostas/visitantes)
  taxaRejeicao: number; // % (1 - interação)
  mediaEtapas: number; // média de max_step_reached+1
  /** @deprecated média de (last_seen_at − created_at). Mantido 1 release por
   *  compatibilidade — use `tempoMedianoSeg`, que mede o que o nome diz. */
  tempoMedioSeg: number;
  /**
   * MEDIANA do tempo entre o primeiro e o último avanço de lâmina, lida de
   * `step_events`. Troca a fonte porque `last_seen_at` significava "instante em
   * que atingiu a lâmina mais profunda" (o guard .lt() de /api/step) e o
   * `created_at` da sessão congela na primeira visita de sempre — os dois juntos
   * produziam 00h00m00s ou um número inflado por sessões esquecidas abertas.
   * Mediana, não média: 3 abas esquecidas não distorcem o número.
   */
  tempoMedianoSeg: number;
  /** Quantas sessões tinham 2+ eventos (base do tempo). Sem isso o número
   *  parece falar de todos os visitantes, e fala só de quem avançou. */
  sessoesComTempo: number;
  /** Mix de aparelho — dos LEADS, não dos visitantes (o dado só existe em
   *  funnel_leads). O rótulo na tela precisa dizer isso. */
  dispositivos?: DeviceMix;
  /** Retenção lâmina a lâmina (step_events.step_id). Aditivo, não altera nada. */
  retencao?: RetencaoLamina[];
  score: number; // 0–100 composto
  funil: { label: string; value: number; pct: number }[];
  /**
   * Série temporal DO PERÍODO ESCOLHIDO. Até 07/08/2026 era sempre "últimas 24h
   * de agora" — escolher "Ontem" ou "30 dias" descartava tudo e o gráfico
   * aparecia vazio, sem nenhum aviso. Agora vem da RPC `funnel_traffic_series`.
   *
   * `hour` é RÓTULO, não um horário: "14:00" quando o período cabe em horas,
   * "24/07" quando é agregado por dia. A tela só imprime a string.
   */
  trafego: { hour: string; visitantes: number; respostas: number; leads: number; conclusoes: number }[];
  /**
   * Visitantes nas últimas 24h REAIS — independe do período escolhido. Existe
   * para o card de recência, que antes somava `trafego` justamente porque ele
   * era travado em 24h. `undefined` quando o período não alcança agora (em
   * "Ontem" a razão 24h/período não significa nada e a tela esconde o card).
   */
  visitantes24h?: number;
  totalRastreado: number;
  melhorOrigem: string;
  campanhas: { name: string; value: number; pct: number }[];
  /**
   * Insumos da faixa de conferência — como o Luca reconcilia o que vê na tela
   * com o que existe no banco. Sem isto, "os leads caíram" é indistinguível de
   * "o cálculo mudou". Ausente quando a RPC 0019 ainda não rodou.
   */
  conferencia?: {
    /** COUNT(*) bruto em funnel_leads: o número ANTIGO da tela */
    leadsLinhas: number;
    /** COUNT(DISTINCT session_id): pessoas, não envios */
    leadsSessoes: number;
    /** leadsLinhas − leadsSessoes: mesmo lead enviou o formulário 2x+ */
    duplicados: number;
    /** leadsSessoes − leads: lead sem sessão correspondente na base/período */
    orfaos: number;
    /** qual lâmina é cada estágio HOJE — torna visível o drift de índice */
    firstQ: number; lastI: number;
    labelFirstQ: string; labelLastI: string;
  };
}

const QUESTION_TYPES = ["question", "measure", "slider"];
const LAYER_Q = ["options", "slider", "roulette", "measure"];

/** Índices das etapas-chave. Funciona nos DOIS motores:
 *  - tipado: pelo step.type (question/capture)
 *  - layers: pela presença de blocos (options/slider/roulette = pergunta; field = captura) */
function stageIndices(steps: Step[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLayers = steps.some((s: any) => Array.isArray(s?.layers));
  if (isLayers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasLayer = (s: any, types: string[]) => Array.isArray(s?.layers) && s.layers.some((l: any) => types.includes(l?.type));
    const firstQ = steps.findIndex((s) => hasLayer(s, LAYER_Q));
    const captureI = steps.findIndex((s) => hasLayer(s, ["field"]));
    return {
      firstQ: firstQ < 0 ? 1 : firstQ,
      captureI: captureI < 0 ? steps.length - 2 : captureI,
      lastI: steps.length - 1,
    };
  }
  const firstQ = steps.findIndex((s) => QUESTION_TYPES.includes(s.type));
  const captureI = steps.findIndex((s) => s.type === "capture");
  return {
    firstQ: firstQ < 0 ? 1 : firstQ,
    captureI: captureI < 0 ? steps.length - 2 : captureI,
    lastI: steps.length - 1,
  };
}

/** Janela de datas opcional (ISO). Filtra por created_at. */
export interface DateRange { from?: string; to?: string }

/** Conta leads REAIS (tabela funnel_leads) de um funil — fonte de verdade. */
async function realLeadCount(slug: string, range?: DateRange, issues?: MetricsIssue[]): Promise<number> {
  try {
    const sb = createAdminClient();
    let q = sb.from("funnel_leads").select("*", { count: "exact", head: true }).eq("funnel_slug", slug);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { count, error } = await q;
    if (error) {
      issues?.push({
        code: error.code === "42703" ? "coluna_ausente" : "db_error",
        msg: "Não consegui contar os leads no banco.",
        campos: ["leads"],
        detalhe: `${error.code ?? ""} ${error.message}`.trim(),
      });
      return 0;   // placeholder: `degraded` impede a tela de exibir isto
    }
    return count ?? 0;
  } catch (e) {
    issues?.push({ code: "db_error", msg: "Não consegui contar os leads no banco.", campos: ["leads"], detalhe: String(e) });
    return 0;
  }
}

/**
 * Tempo de navegação: mediana de (último avanço − primeiro avanço) por sessão.
 * Clip [1s, 30min] corta bounce e aba esquecida aberta; mínimo 2 eventos porque
 * quem só entrou não tem duração — e contar esses como "0s" era o que puxava a
 * média para baixo.
 */
async function tempoMediano(slug: string, range?: DateRange, issues?: MetricsIssue[]): Promise<{ seg: number; sessoes: number }> {
  try {
    const sb = createAdminClient();
    let q = sb.from("step_events").select("session_id,created_at").eq("funnel_slug", slug).limit(100000);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { data, error } = await q;
    if (error) {
      issues?.push({
        code: error.code === "42703" ? "coluna_ausente" : "db_error",
        msg: "Não consegui calcular o tempo de navegação.",
        campos: ["tempoMedianoSeg"],
        detalhe: `${error.code ?? ""} ${error.message}`.trim(),
      });
      return { seg: 0, sessoes: 0 };
    }
    const porSessao = new Map<string, { min: number; max: number; n: number }>();
    for (const e of data ?? []) {
      const sid = String((e as { session_id?: string }).session_id ?? "");
      if (!sid) continue;
      const t = new Date(String((e as { created_at?: string }).created_at)).getTime();
      if (!Number.isFinite(t)) continue;
      const a = porSessao.get(sid);
      if (!a) porSessao.set(sid, { min: t, max: t, n: 1 });
      else { a.min = Math.min(a.min, t); a.max = Math.max(a.max, t); a.n++; }
    }
    const dur: number[] = [];
    for (const a of porSessao.values()) {
      if (a.n < 2) continue;
      const s = (a.max - a.min) / 1000;
      if (s >= 1 && s <= 1800) dur.push(s);
    }
    if (!dur.length) return { seg: 0, sessoes: 0 };
    dur.sort((x, y) => x - y);
    const m = dur.length >> 1;
    const seg = dur.length % 2 ? dur[m] : (dur[m - 1] + dur[m]) / 2;
    return { seg: Math.round(seg), sessoes: dur.length };
  } catch (e) {
    issues?.push({ code: "db_error", msg: "Não consegui calcular o tempo de navegação.", campos: ["tempoMedianoSeg"], detalhe: String(e) });
    return { seg: 0, sessoes: 0 };
  }
}

/** Mix de aparelho dos leads. Os dados já existiam e já chegavam ao cliente —
 *  só o painel era um placeholder. */
async function mixDispositivos(slug: string, range?: DateRange): Promise<DeviceMix | undefined> {
  try {
    const sb = createAdminClient();
    let q = sb.from("funnel_leads").select("viewport,user_agent").eq("funnel_slug", slug).limit(20000);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { data, error } = await q;
    if (error || !data) return undefined;

    const tipos = new Map<string, number>();
    const sos = new Map<string, number>();
    let comDado = 0, semDado = 0;
    for (const l of data) {
      const ua = String((l as { user_agent?: string }).user_agent ?? "");
      const vp = String((l as { viewport?: string }).viewport ?? "");
      if (!ua && !vp) { semDado++; continue; }
      comDado++;
      const larg = Number(vp.split("x")[0]) || 0;
      const tipo = /iPad|Tablet/i.test(ua) || (larg >= 768 && larg <= 1023) ? "Tablet"
        : /Mobi|Android|iPhone/i.test(ua) || (larg > 0 && larg < 768) ? "Mobile"
          : "Desktop";
      tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
      const so = /iPhone|iPad|iOS/i.test(ua) ? "iOS"
        : /Android/i.test(ua) ? "Android"
          : /Windows/i.test(ua) ? "Windows"
            : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
              : /Linux/i.test(ua) ? "Linux" : "Outro";
      sos.set(so, (sos.get(so) ?? 0) + 1);
    }
    if (!comDado && !semDado) return undefined;
    const fatia = (m: Map<string, number>): DeviceSlice[] =>
      Array.from(m.entries())
        .map(([label, value]) => ({ label, value, pct: comDado ? Math.round((value / comDado) * 1000) / 10 : 0 }))
        .sort((a, b) => b.value - a.value);
    return { tipo: fatia(tipos), so: fatia(sos), total: comDado, semDado };
  } catch {
    return undefined;   // painel some; não derruba o resto da tela
  }
}

/**
 * Retenção lâmina a lâmina. Conta SESSÕES DISTINTAS por `step_id` — a chave
 * estável, que sobrevive a reordenar/desativar lâmina (o `max_step_reached` do
 * funil de 5 estágios não sobrevive: é índice).
 *
 * Ids órfãos (lâmina apagada depois de ter recebido tráfego) aparecem como
 * "(lâmina removida)" em vez de sumirem — o histórico dela é real.
 */
async function retencaoPorLamina(
  slug: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: any[],
  range?: DateRange,
): Promise<RetencaoLamina[] | undefined> {
  try {
    const sb = createAdminClient();
    let q = sb.from("step_events").select("session_id,step_id").eq("funnel_slug", slug).limit(100000);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { data, error } = await q;
    if (error || !data?.length) return undefined;

    const porStep = new Map<string, Set<string>>();
    for (const e of data) {
      const st = String((e as { step_id?: string }).step_id ?? "");
      const sid = String((e as { session_id?: string }).session_id ?? "");
      if (!st || !sid) continue;
      if (!porStep.has(st)) porStep.set(st, new Set());
      porStep.get(st)!.add(sid);
    }
    if (!porStep.size) return undefined;

    const ativas = steps.filter((s) => !s?.disabled);
    const ordem = new Map<string, number>(ativas.map((s, i) => [String(s?.id ?? i), i]));
    const titulo = (id: string): string => {
      const s = ativas.find((x) => String(x?.id) === id);
      return s ? (String(s.title ?? "").replace(/<[^>]+>/g, "").trim() || `Lâmina ${(ordem.get(id) ?? 0) + 1}`) : "(lâmina removida)";
    };

    const linhas = Array.from(porStep.entries())
      .map(([stepId, ss]) => ({ stepId, titulo: titulo(stepId), idx: ordem.get(stepId) ?? -1, sessoes: ss.size, pct: 0, queda: 0 }))
      // as que ainda existem vêm na ordem do funil; as órfãs no fim
      .sort((a, b) => (a.idx < 0 ? 1 : b.idx < 0 ? -1 : a.idx - b.idx));

    const base = Math.max(...linhas.map((l) => l.sessoes), 1);
    linhas.forEach((l, i) => {
      l.pct = Math.round((l.sessoes / base) * 1000) / 10;
      const ant = i > 0 ? linhas[i - 1] : null;
      l.queda = ant && ant.sessoes > 0 ? Math.round(((l.sessoes - ant.sessoes) / ant.sessoes) * 1000) / 10 : 0;
    });
    return linhas;
  } catch {
    return undefined;   // painel some; não derruba o resto da tela
  }
}

export async function funnelMetrics(slug: string, range?: DateRange, source?: { client: ReturnType<typeof createAdminClient>; funnel: Pick<Funnel, "steps" | "settings" | "name"> }): Promise<FunnelMetrics> {
  const issues: MetricsIssue[] = [];
  const empty: FunnelMetrics = {
    found: false, degraded: false, issues, name: slug, totalSteps: 0, visitantes: 0, respostas: 0, leads: 0, conclusoes: 0,
    taxaConclusao: 0, taxaInteracao: 0, taxaRejeicao: 0, mediaEtapas: 0, tempoMedioSeg: 0, score: 0,
    tempoMedianoSeg: 0, sessoesComTempo: 0,
    funil: [], trafego: [], totalRastreado: 0, melhorOrigem: "—", campanhas: [],
  };
  const funnel = source ? source.funnel : await resolveFunnel(slug);
  if (!funnel) {
    issues.push({ code: "sem_funil", msg: `Funil "${slug}" não encontrado.`, campos: [] });
    return { ...empty, degraded: true, issues };
  }
  const steps = funnel.steps;
  // typebot: os índices vivem nos GRUPOS (steps fica vazio nesse motor). max_step_reached
  // é o índice do grupo, então firstQ/lastI/captureI têm que ser em termos de grupo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbGroups: any[] | null = funnel.settings?.engine === "typebot" && Array.isArray((funnel.settings as any)?.typebot?.groups) ? (funnel.settings as any).typebot.groups : null;
  // `captureI` não entra aqui: era usado só para estimar leads por
  // `max_step_reached >= captureI` na série de tráfego. Lead agora é semi-join
  // com funnel_leads (a regra: quem deixou nome e telefone), então chegar na
  // lâmina de captura sem preencher deixou de contar. `stageIndices` continua
  // devolvendo o campo — outras métricas usam.
  let firstQ: number, lastI: number, totalSteps: number;
  if (tbGroups) {
    totalSteps = tbGroups.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qi = tbGroups.findIndex((g: any) => Array.isArray(g?.blocks) && g.blocks.some((b: any) => typeof b?.type === "string" && b.type.startsWith("input-")));
    firstQ = qi < 0 ? 1 : qi;
    lastI = Math.max(0, tbGroups.length - 1);
  } else {
    // o LayersRunner PULA lâminas desativadas no runtime → max_step_reached é o
    // índice na lista FILTRADA. Calculamos os índices sobre as ATIVAS pra bater
    // (senão a última etapa/VSL nunca é "alcançada" → conclusões = 0).
    const enabled = steps.filter((s) => !(s as { disabled?: boolean }).disabled);
    ({ firstQ, lastI } = stageIndices(enabled.length ? enabled : steps));
    totalSteps = enabled.length || steps.length;
  }

  /**
   * REGRA BASE DO PAINEL (Luca, 06/08/2026) — vale a POSIÇÃO, não o tipo:
   *   1ª resposta = interação concluída no PRIMEIRO card (o hero)
   *   2ª resposta = interação concluída no SEGUNDO card
   * Botão, slide, roleta ou opção: se o lead avançou, ele interagiu.
   *
   * `stageIndices` procurava a primeira lâmina COM PERGUNTA, e isso escondia o
   * começo do funil: no cdb-01 a 1ª pergunta é o 3º card que o lead vê (as
   * lâminas 2 e 3 do construtor estão OFF), então a perda no hero — 83% dos
   * visitantes — não aparecia em lugar nenhum da tela.
   *
   * `lastI` continua vindo do conteúdo: o fim é a última lâmina.
   */
  firstQ = 1;

  const usaHidratacao = await hydratedAtDisponivel(issues, source?.client);

  /** Campos derivados da AMOSTRA (não são COUNT exato) — se ela falhar ou
   *  truncar, é este conjunto que deixa de ser confiável. */
  const CAMPOS_AMOSTRA = ["mediaEtapas", "tempoMedioSeg", "trafego", "campanhas", "totalRastreado", "melhorOrigem"];
  const LIMITE_AMOSTRA = 5000;

  let sessions: { max_step_reached: number; created_at: string; last_seen_at: string; utm_source: string | null; utm_campaign: string | null; src: string | null }[] = [];
  try {
    const sb = source?.client ?? createAdminClient();
    let q = sb
      .from("funnel_sessions")
      .select("max_step_reached,created_at,last_seen_at,utm_source,utm_campaign,src")
      .eq("funnel_slug", slug)
      .order("created_at", { ascending: false })
      .limit(LIMITE_AMOSTRA);
    // só visitantes que hidrataram (amostra p/ média/tempo/tráfego)
    if (usaHidratacao) q = q.not("hydrated_at", "is", null);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { data, error } = await q;
    if (error) {
      issues.push({
        code: error.code === "42703" ? "coluna_ausente" : "db_error",
        msg: "Não consegui ler as sessões do período.",
        campos: CAMPOS_AMOSTRA,
        detalhe: `${error.code ?? ""} ${error.message}`.trim(),
      });
    }
    sessions = data ?? [];
  } catch (e) {
    issues.push({ code: "db_error", msg: "Não consegui ler as sessões do período.", campos: CAMPOS_AMOSTRA, detalhe: String(e) });
  }
  // Bateu no teto: metade da tela é COUNT exato e metade sai desta amostra, então
  // acima de 5.000 os dois grupos divergem. Antes isso acontecia em silêncio.
  if (sessions.length >= LIMITE_AMOSTRA) {
    issues.push({
      code: "amostra_truncada",
      msg: `Mais de ${LIMITE_AMOSTRA.toLocaleString("pt-BR")} sessões no período: média de etapas, tempo, tráfego e campanhas usam só as mais recentes.`,
      campos: CAMPOS_AMOSTRA,
    });
  }

  // Contagens EXATAS (escalam além das 5000 amostradas) — COUNT no banco, não no JS.
  // visitantes = todas as sessões; respostas = chegaram na 1ª pergunta; conclusões = chegaram ao fim.
  const sbCount = source?.client ?? createAdminClient();
  const countSessions = async (minStep?: number, campos: string[] = []): Promise<number> => {
    try {
      let q = sbCount.from("funnel_sessions").select("*", { count: "exact", head: true })
        .eq("funnel_slug", slug);
      // Visitante = HIDRATOU (app montou). hydrated_at not null exclui o beacon-only
      // (carregou mas nunca renderizou). Alinha a contagem com o inlead.
      if (usaHidratacao) q = q.not("hydrated_at", "is", null);
      if (range?.from) q = q.gte("created_at", range.from);
      if (range?.to) q = q.lte("created_at", range.to);
      if (minStep !== undefined) q = q.gte("max_step_reached", minStep);
      const { count, error } = await q;
      if (error) {
        issues.push({
          code: error.code === "42703" ? "coluna_ausente" : "db_error",
          msg: "Não consegui contar as sessões no banco.",
          campos,
          detalhe: `${error.code ?? ""} ${error.message}`.trim(),
        });
        return 0;   // placeholder: `degraded` impede a tela de exibir isto
      }
      return count ?? 0;
    } catch (e) {
      issues.push({ code: "db_error", msg: "Não consegui contar as sessões no banco.", campos, detalhe: String(e) });
      return 0;
    }
  };
  // C2: "leads" = leads REAIS (funnel_leads), não "quem chegou na lâmina de captura".
  //
  // REGRA BASE DO PAINEL (definida pelo Luca, 06/08/2026):
  //   1ª resposta = interação concluída no PRIMEIRO card (o hero)
  //   2ª resposta = interação concluída no SEGUNDO card
  // Vale a POSIÇÃO, não o tipo de bloco: botão, slide, roleta ou opção — se o
  // lead avançou, interagiu. `max_step_reached` é o índice da lâmina alcançada
  // entre as ATIVAS, então avançar do card 1 para o 2 grava 1: `>= 1` é
  // exatamente "concluiu a interação do hero".
  //
  // Antes isto era ancorado na primeira lâmina COM PERGUNTA, o que escondia o
  // começo do funil: no cdb-01 a 1ª pergunta é o 3º card, então a perda no hero
  // (83% dos visitantes) não aparecia em lugar nenhum da tela. O índice usado é
  // o `firstQ = 1` fixado acima.
  //
  // Só existe 2ª etapa se o funil tiver um 3º card para alcançar; senão a linha
  // repetiria a anterior.
  const ativasCount = tbGroups
    ? tbGroups.length
    : steps.filter((s) => !(s as { disabled?: boolean }).disabled).length;
  const secondQ = ativasCount > 2 ? 2 : -1;

  /**
   * Agregado EXATO via RPC (migration 0019). Devolve os 5 estágios já
   * monotônicos — `leads` vira semi-join (pessoas), não COUNT de linhas.
   * Se a migration ainda não rodou, cai no caminho antigo e a tela avisa.
   */
  type Agg = {
    visitantes: number; respostas: number; resp2: number; leads: number; conclusoes: number;
    soma_etapas: number; rastreadas: number; leads_linhas: number; leads_sess: number;
  };
  let agg: Agg | null = null;
  try {
    const { data, error } = await sbCount.rpc("funnel_metrics_agg", {
      p_slug: slug,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
      p_first_q: firstQ,
      p_second_q: secondQ >= 0 ? secondQ : 1_000_000,   // sem 2ª pergunta: ninguém atinge
      p_last_i: lastI,
    });
    if (error) {
      issues.push({
        code: "rpc_ausente",
        msg: "Cálculo exato indisponível (migration 0019 pendente) — média de etapas e campanhas usam amostra.",
        campos: [],
        detalhe: `${error.code ?? ""} ${error.message}`.trim(),
      });
    } else if (Array.isArray(data) && data.length) {
      const r = data[0] as Record<string, unknown>;
      agg = {
        visitantes: Number(r.visitantes ?? 0), respostas: Number(r.respostas ?? 0),
        resp2: Number(r.resp2 ?? 0), leads: Number(r.leads ?? 0), conclusoes: Number(r.conclusoes ?? 0),
        soma_etapas: Number(r.soma_etapas ?? 0), rastreadas: Number(r.rastreadas ?? 0),
        leads_linhas: Number(r.leads_linhas ?? 0), leads_sess: Number(r.leads_sess ?? 0),
      };
    }
  } catch (e) {
    issues.push({ code: "rpc_ausente", msg: "Cálculo exato indisponível — usando amostra.", campos: [], detalhe: String(e) });
  }

  const [visitantes, respostas, conclusoes, leads, resp1, resp2] = agg
    ? [agg.visitantes, agg.respostas, agg.conclusoes, agg.leads, agg.respostas, agg.resp2]
    : await Promise.all([
        countSessions(undefined, ["visitantes", "taxaConclusao", "taxaInteracao", "taxaRejeicao", "score", "funil"]),
        countSessions(firstQ, ["respostas", "taxaInteracao", "taxaRejeicao", "score"]),
        countSessions(lastI, ["conclusoes", "taxaConclusao", "score", "funil"]),
        realLeadCount(slug, range, issues),
        countSessions(firstQ, ["funil"]),   // "1ª resposta" = MESMO número do card
        countSessions(secondQ >= 0 ? secondQ : 1_000_000, ["funil"]),
      ]);
  // Clamp em 100: `leads` vem de OUTRA tabela (funnel_leads) e não tem relação
  // com as sessões — o mesmo lead enviando 2x conta 2, então leads > visitantes
  // acontece. Sem o teto, o clipPath do trapézio estourava a caixa e o desenho
  // aparecia invertido. Paliativo: a Fase 2 torna o funil monotônico na origem.
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 1000) / 10) : 0);
  const taxaConclusao = pct(conclusoes, visitantes);
  const taxaInteracao = pct(respostas, visitantes);
  const taxaRejeicao = Math.round((100 - taxaInteracao) * 10) / 10;
  // média de etapas/tempo: calculadas sobre a amostra recente (representativa), não dividem pela contagem total
  // Exato quando a RPC respondeu (soma sobre TODAS as sessões do período);
  // senão cai na amostra de 5.000, que a tela já sinaliza como truncada.
  const mediaEtapas = agg
    ? (agg.visitantes ? Math.round((agg.soma_etapas / agg.visitantes) * 10) / 10 : 0)
    : sessions.length ? Math.round((sessions.reduce((a, s) => a + s.max_step_reached + 1, 0) / sessions.length) * 10) / 10 : 0;
  const tempos = sessions.map((s) => (new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime()) / 1000).filter((t) => t >= 0 && t < 3600 * 6);
  const tempoMedioSeg = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const score = Math.min(100, Math.round((taxaConclusao * 0.6 + taxaInteracao * 0.4) * 10) / 10);

  // Fontes próprias, em paralelo: o tempo vem de step_events (não de
  // last_seen_at) e o mix de aparelho de funnel_leads.
  const [tmp, dispositivos, retencao] = await Promise.all([
    tempoMediano(slug, range, issues),
    mixDispositivos(slug, range),
    retencaoPorLamina(slug, steps, range),
  ]);

  // Funil = histograma cumulativo do "estágio máximo atingido". Cada etapa é um
  // predicado sobre a MESMA população (os visitantes), então é impossível uma
  // superar a anterior. Antes, "1ª resposta" usava índice fixo 1 e o card usava
  // firstQ: dois números diferentes do mesmo conceito na mesma tela (provado em
  // produção no cdb-01: card 14, funil 20).
  // Etapa que não existe no funil é OMITIDA, não vira linha repetida. Sem isto,
  // um funil de lâmina única (a raspadinha) desenhava 5 etapas com o MESMO
  // número — barra reta, zero informação: com 1 lâmina, "chegou ao fim" é
  // verdade para todo mundo que entrou.
  const temPergunta = firstQ >= 1 && firstQ <= lastI;
  const temFim = lastI > firstQ;
  const funil = [
    { label: "Visitantes", value: visitantes, pct: 100 },
    ...(temPergunta ? [{ label: "1ª interação", value: resp1, pct: pct(resp1, visitantes) }] : []),
    ...(secondQ >= 0 && secondQ <= lastI ? [{ label: "2ª interação", value: resp2, pct: pct(resp2, visitantes) }] : []),
    { label: "Leads capturados", value: leads, pct: pct(leads, visitantes) },
    ...(temFim ? [{ label: "Conclusões", value: conclusoes, pct: pct(conclusoes, visitantes) }] : []),
  ];

  // ── Série de tráfego ──────────────────────────────────────────────────────
  // O cálculo anterior descartava toda sessão com mais de 24h (`if (now - t >
  // 24h) continue`), então o gráfico ignorava o período: escolher "Ontem"
  // esvaziava a caixa e nada na tela dizia por quê. A RPC respeita o período e
  // ainda conta lead pelo semi-join com funnel_leads — a regra do Luca (lead é
  // quem deixou nome e telefone), não `max_step_reached >= captureI`.
  //
  // Sem fallback de propósito: cair de volta na janela de 24h quando o usuário
  // pediu 30 dias é mentir em silêncio, que era exatamente o defeito. Se a RPC
  // falhar, a série fica vazia e `invalidos` faz a tela mostrar "—".
  const now = Date.now();
  const msPeriodo = range?.from
    ? (range.to ? new Date(range.to).getTime() : now) - new Date(range.from).getTime()
    : Infinity;
  // até 48h a barra por hora ainda cabe na largura da caixa; acima disso, dia
  const bucket: "hour" | "day" = msPeriodo <= 48 * 3600 * 1000 ? "hour" : "day";

  let trafego: FunnelMetrics["trafego"] = [];
  try {
    const { data, error } = await sbCount.rpc("funnel_traffic_series", {
      p_slug: slug,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
      p_bucket: bucket,
      p_first_q: firstQ,
      p_last_i: lastI,
    });
    if (error) {
      issues.push({
        code: "rpc_ausente",
        msg: "Não consegui montar o gráfico de tráfego do período.",
        campos: ["trafego"],
        detalhe: `${error.code ?? ""} ${error.message}`.trim(),
      });
    } else if (Array.isArray(data)) {
      // PEGADINHA: `date_trunc(campo at time zone 'America/Sao_Paulo')` devolve
      // o horário de SP já convertido, mas ROTULADO como UTC. Formatar em UTC
      // imprime o rótulo correto — qualquer outro fuso desloca 3h outra vez.
      const fmt = new Intl.DateTimeFormat("pt-BR", bucket === "hour"
        ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }
        : { day: "2-digit", month: "2-digit", timeZone: "UTC" });
      const pontos = (data as Record<string, unknown>[]).map((r) => ({
        t: new Date(String(r.bucket)).getTime(),
        visitantes: Number(r.visitantes ?? 0),
        respostas: Number(r.respostas ?? 0),
        leads: Number(r.leads ?? 0),
        conclusoes: Number(r.conclusoes ?? 0),
      }));

      // `group by` não devolve bucket vazio: medido no cdb-01 em 24/07, a série
      // vem 01,02,06,07,11,12 — sem as horas mortas. Num gráfico de linha isso
      // cola dois picos separados por 4 h como se fossem consecutivos: os
      // números certos, o tempo mentindo. O cálculo antigo não sofria disso
      // porque criava as 24 horas fixas antes de contar.
      //
      // Preenche entre o primeiro e o último ponto REAL (não a borda do
      // período): em "Tudo", um funil com meses de histórico geraria centenas
      // de colunas vazias à toa. O teto de 400 é só para o caso patológico.
      const passo = bucket === "hour" ? 3_600_000 : 86_400_000;
      const cheio: typeof pontos = [];
      for (let i = 0; i < pontos.length; i++) {
        cheio.push(pontos[i]);
        const prox = pontos[i + 1];
        if (!prox) break;
        for (let t = pontos[i].t + passo; t < prox.t && cheio.length < 400; t += passo) {
          cheio.push({ t, visitantes: 0, respostas: 0, leads: 0, conclusoes: 0 });
        }
      }

      trafego = cheio.map((p) => ({
        hour: fmt.format(new Date(p.t)),
        visitantes: p.visitantes, respostas: p.respostas,
        leads: p.leads, conclusoes: p.conclusoes,
      }));
    }
  } catch (e) {
    issues.push({ code: "rpc_ausente", msg: "Não consegui montar o gráfico de tráfego do período.", campos: ["trafego"], detalhe: String(e) });
  }

  // Recência: 24h REAIS, fora do período. Só faz sentido quando o período
  // alcança agora — em "Ontem" a razão 24h/período não significa nada, então
  // fica `undefined` e a tela esconde o card em vez de mostrar 0%.
  let visitantes24h: number | undefined;
  if (!range?.to || new Date(range.to).getTime() >= now - 3600 * 1000) {
    let q24 = sbCount.from("funnel_sessions").select("*", { count: "exact", head: true })
      .eq("funnel_slug", slug)
      .gte("created_at", new Date(now - 24 * 3600 * 1000).toISOString());
    if (usaHidratacao) q24 = q24.not("hydrated_at", "is", null);
    const { count, error } = await q24;
    if (!error) visitantes24h = count ?? 0;
  }

  // campanhas (por utm_campaign, fallback utm_source)
  const campMap = new Map<string, number>();
  let rastreado = 0;
  const origMap = new Map<string, number>();
  for (const s of sessions) {
    // M9: tráfego de WhatsApp/CTWA chega por `src` (sem utm) — usa como fallback.
    const camp = (s.utm_campaign || s.utm_source || s.src || "").trim();
    if (camp) { campMap.set(camp, (campMap.get(camp) ?? 0) + 1); rastreado++; }
    const orig = (s.utm_source || s.src || "").trim();
    if (orig) origMap.set(orig, (origMap.get(orig) ?? 0) + 1);
  }
  const campanhas = Array.from(campMap.entries())
    .map(([name, value]) => ({ name, value, pct: rastreado ? Math.round((value / rastreado) * 1000) / 10 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const melhorOrigem = Array.from(origMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Rótulo da lâmina de cada estágio: torna VISÍVEL o drift de índice. `firstQ`
  // e `lastI` são recalculados do funil ATUAL a cada request, então editar o
  // funil reinterpreta todo o histórico — antes, em silêncio.
  const ativas = steps.filter((s) => !(s as { disabled?: boolean }).disabled);
  const rotulo = (i: number): string => {
    const s = ativas[i] as { title?: string; type?: string } | undefined;
    if (!s) return "—";
    return String(s.title || s.type || `lâmina ${i + 1}`).replace(/<[^>]+>/g, "").trim().slice(0, 40);
  };

  return {
    found: true, degraded: issues.length > 0, issues,
    name: funnel.name, totalSteps,
    visitantes, respostas, leads, conclusoes,
    taxaConclusao, taxaInteracao, taxaRejeicao, mediaEtapas, tempoMedioSeg, score,
    tempoMedianoSeg: tmp.seg, sessoesComTempo: tmp.sessoes, dispositivos, retencao,
    funil, trafego, visitantes24h,
    totalRastreado: agg ? agg.rastreadas : rastreado,
    melhorOrigem, campanhas,
    ...(agg ? {
      conferencia: {
        leadsLinhas: agg.leads_linhas,
        leadsSessoes: agg.leads_sess,
        duplicados: Math.max(0, agg.leads_linhas - agg.leads_sess),
        orfaos: Math.max(0, agg.leads_sess - agg.leads),
        // `firstQ` é o índice ALCANÇADO (card 2). Quem interagiu foi o card
        // ANTERIOR, e é ele que a conferência precisa nomear.
        firstQ: firstQ - 1, lastI,
        labelFirstQ: rotulo(firstQ), labelLastI: rotulo(lastI),
      },
    } : {}),
  };
}
