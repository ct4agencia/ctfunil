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

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const sb = createAdminClient();
  // ANTES: ~5 queries POR funil (17×5 ≈ 85). AGORA: 4 queries agregadas + JS.
  const sinceDaily = new Date(Date.now() - 7 * 86400000).toISOString();
  const [funRes, sessRes, leadRes, dailyRes] = await Promise.all([
    sb.from("funnels").select("slug,name,steps,settings").order("updated_at", { ascending: false }),
    // Visitante = hidratou (hydrated_at not null) — mesma regra do funnelMetrics.
    sb.from("funnel_sessions").select("funnel_slug,max_step_reached").not("hydrated_at", "is", null).limit(100000),
    sb.from("funnel_leads").select("funnel_slug").limit(100000),
    sb.from("funnel_sessions").select("created_at").not("hydrated_at", "is", null).gte("created_at", sinceDaily).limit(100000),
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

export interface FunnelMetrics {
  found: boolean;
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
  tempoMedioSeg: number; // segundos
  score: number; // 0–100 composto
  funil: { label: string; value: number; pct: number }[];
  trafego: { hour: string; visitantes: number; respostas: number; leads: number; conclusoes: number }[];
  totalRastreado: number;
  melhorOrigem: string;
  campanhas: { name: string; value: number; pct: number }[];
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
async function realLeadCount(slug: string, range?: DateRange): Promise<number> {
  try {
    const sb = createAdminClient();
    let q = sb.from("funnel_leads").select("*", { count: "exact", head: true }).eq("funnel_slug", slug);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function funnelMetrics(slug: string, range?: DateRange): Promise<FunnelMetrics> {
  const empty: FunnelMetrics = {
    found: false, name: slug, totalSteps: 0, visitantes: 0, respostas: 0, leads: 0, conclusoes: 0,
    taxaConclusao: 0, taxaInteracao: 0, taxaRejeicao: 0, mediaEtapas: 0, tempoMedioSeg: 0, score: 0,
    funil: [], trafego: [], totalRastreado: 0, melhorOrigem: "—", campanhas: [],
  };
  const funnel = await resolveFunnel(slug);
  if (!funnel) return empty;
  const steps = funnel.steps;
  // typebot: os índices vivem nos GRUPOS (steps fica vazio nesse motor). max_step_reached
  // é o índice do grupo, então firstQ/lastI/captureI têm que ser em termos de grupo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbGroups: any[] | null = funnel.settings?.engine === "typebot" && Array.isArray((funnel.settings as any)?.typebot?.groups) ? (funnel.settings as any).typebot.groups : null;
  let firstQ: number, captureI: number, lastI: number, totalSteps: number;
  if (tbGroups) {
    totalSteps = tbGroups.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qi = tbGroups.findIndex((g: any) => Array.isArray(g?.blocks) && g.blocks.some((b: any) => typeof b?.type === "string" && b.type.startsWith("input-")));
    firstQ = qi < 0 ? 1 : qi;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ci = tbGroups.findIndex((g: any) => Array.isArray(g?.blocks) && g.blocks.some((b: any) => b?.type === "input-phone"));
    lastI = Math.max(0, tbGroups.length - 1);
    captureI = ci < 0 ? Math.max(0, lastI - 1) : ci;
  } else {
    // o LayersRunner PULA lâminas desativadas no runtime → max_step_reached é o
    // índice na lista FILTRADA. Calculamos os índices sobre as ATIVAS pra bater
    // (senão a última etapa/VSL nunca é "alcançada" → conclusões = 0).
    const enabled = steps.filter((s) => !(s as { disabled?: boolean }).disabled);
    ({ firstQ, captureI, lastI } = stageIndices(enabled.length ? enabled : steps));
    totalSteps = enabled.length || steps.length;
  }

  let sessions: { max_step_reached: number; created_at: string; last_seen_at: string; utm_source: string | null; utm_campaign: string | null; src: string | null }[] = [];
  try {
    const sb = createAdminClient();
    let q = sb
      .from("funnel_sessions")
      .select("max_step_reached,created_at,last_seen_at,utm_source,utm_campaign,src")
      .eq("funnel_slug", slug)
      .not("hydrated_at", "is", null) // só visitantes que hidrataram (amostra p/ média/tempo/tráfego)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (range?.from) q = q.gte("created_at", range.from);
    if (range?.to) q = q.lte("created_at", range.to);
    const { data } = await q;
    sessions = data ?? [];
  } catch {
    /* sem dados */
  }

  // Contagens EXATAS (escalam além das 5000 amostradas) — COUNT no banco, não no JS.
  // visitantes = todas as sessões; respostas = chegaram na 1ª pergunta; conclusões = chegaram ao fim.
  const sbCount = createAdminClient();
  const countSessions = async (minStep?: number): Promise<number> => {
    try {
      // Visitante = HIDRATOU (app montou). hydrated_at not null exclui o beacon-only
      // (carregou mas nunca renderizou). Alinha a contagem com o inlead.
      let q = sbCount.from("funnel_sessions").select("*", { count: "exact", head: true })
        .eq("funnel_slug", slug).not("hydrated_at", "is", null);
      if (range?.from) q = q.gte("created_at", range.from);
      if (range?.to) q = q.lte("created_at", range.to);
      if (minStep !== undefined) q = q.gte("max_step_reached", minStep);
      const { count } = await q;
      return count ?? 0;
    } catch { return 0; }
  };
  // C2: "leads" = leads REAIS (funnel_leads), não "quem chegou na lâmina de captura".
  // resp1/resp2 = interação do lead no 1º / 2º card (max_step ≥ 1 / ≥ 2) — universal p/ layers e typebot.
  const [visitantes, respostas, conclusoes, leads, resp1, resp2] = await Promise.all([
    countSessions(), countSessions(firstQ), countSessions(lastI), realLeadCount(slug, range),
    countSessions(1), countSessions(2),
  ]);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const taxaConclusao = pct(conclusoes, visitantes);
  const taxaInteracao = pct(respostas, visitantes);
  const taxaRejeicao = Math.round((100 - taxaInteracao) * 10) / 10;
  // média de etapas/tempo: calculadas sobre a amostra recente (representativa), não dividem pela contagem total
  const mediaEtapas = sessions.length ? Math.round((sessions.reduce((a, s) => a + s.max_step_reached + 1, 0) / sessions.length) * 10) / 10 : 0;
  const tempos = sessions.map((s) => (new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime()) / 1000).filter((t) => t >= 0 && t < 3600 * 6);
  const tempoMedioSeg = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const score = Math.min(100, Math.round((taxaConclusao * 0.6 + taxaInteracao * 0.4) * 10) / 10);

  const funil = [
    { label: "Visitantes", value: visitantes, pct: 100 },
    { label: "1ª resposta", value: resp1, pct: pct(resp1, visitantes) },
    { label: "2ª resposta", value: resp2, pct: pct(resp2, visitantes) },
    { label: "Leads capturados", value: leads, pct: pct(leads, visitantes) },
    { label: "Conclusões", value: conclusoes, pct: pct(conclusoes, visitantes) },
  ];

  // tráfego últimas 24h por hora
  const now = Date.now();
  const buckets = new Map<string, { v: number; r: number; l: number; c: number }>();
  for (let h = 23; h >= 0; h--) {
    buckets.set(`${spParts(new Date(now - h * 3600 * 1000)).hour}:00`, { v: 0, r: 0, l: 0, c: 0 });
  }
  for (const s of sessions) {
    const t = new Date(s.created_at).getTime();
    if (now - t > 24 * 3600 * 1000) continue;
    const key = `${spParts(new Date(s.created_at)).hour}:00`;
    const b = buckets.get(key);
    if (!b) continue;
    b.v++;
    if (s.max_step_reached >= firstQ) b.r++;
    if (s.max_step_reached >= captureI) b.l++;
    if (s.max_step_reached >= lastI) b.c++;
  }
  const trafego = Array.from(buckets.entries()).map(([hour, b]) => ({ hour, visitantes: b.v, respostas: b.r, leads: b.l, conclusoes: b.c }));

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

  return {
    found: true, name: funnel.name, totalSteps,
    visitantes, respostas, leads, conclusoes,
    taxaConclusao, taxaInteracao, taxaRejeicao, mediaEtapas, tempoMedioSeg, score,
    funil, trafego, totalRastreado: rastreado, melhorOrigem, campanhas,
  };
}
