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
export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const funis = await listFunnelsDb();
  let totalSessoes = 0, totalRespostas = 0, totalLeads = 0, totalConclusoes = 0;
  const porFunil: DashboardMetrics["porFunil"] = [];
  // paralelo: todos os funnelMetrics ao mesmo tempo (antes era 1 por vez)
  const metricasPorFunil = await Promise.all(funis.map((f) => funnelMetrics(f.slug)));
  funis.forEach((f, i) => {
    const m = metricasPorFunil[i];
    totalSessoes += m.visitantes; totalRespostas += m.respostas; totalLeads += m.leads; totalConclusoes += m.conclusoes;
    porFunil.push({ slug: f.slug, name: f.name, sessoes: m.visitantes, pct: 0, color: DONUT_COLORS[i % DONUT_COLORS.length] });
  });
  porFunil.forEach((p) => { p.pct = totalSessoes ? Math.round((p.sessoes / totalSessoes) * 1000) / 10 : 0; });
  porFunil.sort((a, b) => b.sessoes - a.sessoes);

  // diário (últimos 7 dias) — todas as sessões
  const daily: { day: string; sessoes: number }[] = [];
  try {
    const sb = createAdminClient();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await sb.from("funnel_sessions").select("created_at").gte("created_at", since).limit(20000);
    const buckets = new Map<string, number>();
    for (let d = 6; d >= 0; d--) {
      const { day, month } = spParts(new Date(Date.now() - d * 86400000));
      buckets.set(`${day}/${month}`, 0);
    }
    for (const r of data ?? []) {
      const { day, month } = spParts(new Date(r.created_at as string));
      const key = `${day}/${month}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    for (const [day, sessoes] of buckets) daily.push({ day, sessoes });
  } catch { /* sem dados */ }

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
  const overview = await dashboardMetrics();
  const funis = await listFunnelsDb();

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
  const leadsOut: GlobalAnalytics["leads"] = { total: 0, recent: [] };
  try {
    const sb = createAdminClient();
    const { data: answers } = await sb.from("quiz_answers").select("question,answer").limit(20000);
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
    const { data: sess } = await sb.from("funnel_sessions").select("utm_source,utm_campaign,src").limit(20000);
    for (const s of sess ?? []) {
      const src = (((s.utm_source as string) || (s.src as string)) || "").trim();
      const camp = (((s.utm_campaign as string) || (s.utm_source as string) || (s.src as string)) || "").trim();
      if (src) sources.set(src, (sources.get(src) ?? 0) + 1);
      if (camp) campaigns.set(camp, (campaigns.get(camp) ?? 0) + 1);
    }

    // A6: total de leads = contagem EXATA (não o tamanho da página de 50)
    const { count: leadTotal } = await sb.from("funnel_leads").select("*", { count: "exact", head: true });
    const { data: leadRows, error: leadErr } = await sb
      .from("funnel_leads")
      .select("name,phone,funnel_slug,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
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
  return {
    overview, quiz, operacao, leads: leadsOut,
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

/** Conta leads REAIS (tabela funnel_leads) de um funil — fonte de verdade. */
async function realLeadCount(slug: string): Promise<number> {
  try {
    const sb = createAdminClient();
    const { count } = await sb.from("funnel_leads").select("*", { count: "exact", head: true }).eq("funnel_slug", slug);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function funnelMetrics(slug: string): Promise<FunnelMetrics> {
  const empty: FunnelMetrics = {
    found: false, name: slug, totalSteps: 0, visitantes: 0, respostas: 0, leads: 0, conclusoes: 0,
    taxaConclusao: 0, taxaInteracao: 0, taxaRejeicao: 0, mediaEtapas: 0, tempoMedioSeg: 0, score: 0,
    funil: [], trafego: [], totalRastreado: 0, melhorOrigem: "—", campanhas: [],
  };
  const funnel = await resolveFunnel(slug);
  if (!funnel) return empty;
  const steps = funnel.steps;
  const { firstQ, captureI, lastI } = stageIndices(steps);

  let sessions: { max_step_reached: number; created_at: string; last_seen_at: string; utm_source: string | null; utm_campaign: string | null; src: string | null }[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("funnel_sessions")
      .select("max_step_reached,created_at,last_seen_at,utm_source,utm_campaign,src")
      .eq("funnel_slug", slug)
      .order("created_at", { ascending: false })
      .limit(5000);
    sessions = data ?? [];
  } catch {
    /* sem dados */
  }

  const visitantes = sessions.length;
  const respostas = sessions.filter((s) => s.max_step_reached >= firstQ).length;
  // C2: "leads" = leads REAIS (funnel_leads), não "quem chegou na lâmina de captura".
  const leads = await realLeadCount(slug);
  const conclusoes = sessions.filter((s) => s.max_step_reached >= lastI).length;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const taxaConclusao = pct(conclusoes, visitantes);
  const taxaInteracao = pct(respostas, visitantes);
  const taxaRejeicao = Math.round((100 - taxaInteracao) * 10) / 10;
  const mediaEtapas = visitantes ? Math.round((sessions.reduce((a, s) => a + s.max_step_reached + 1, 0) / visitantes) * 10) / 10 : 0;
  const tempos = sessions.map((s) => (new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime()) / 1000).filter((t) => t >= 0 && t < 3600 * 6);
  const tempoMedioSeg = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const score = Math.min(100, Math.round((taxaConclusao * 0.6 + taxaInteracao * 0.4) * 10) / 10);

  const funil = [
    { label: "Visitantes", value: visitantes, pct: 100 },
    { label: "Respostas", value: respostas, pct: pct(respostas, visitantes) },
    { label: "Leads", value: leads, pct: pct(leads, visitantes) },
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
    found: true, name: funnel.name, totalSteps: steps.length,
    visitantes, respostas, leads, conclusoes,
    taxaConclusao, taxaInteracao, taxaRejeicao, mediaEtapas, tempoMedioSeg, score,
    funil, trafego, totalRastreado: rastreado, melhorOrigem, campanhas,
  };
}
