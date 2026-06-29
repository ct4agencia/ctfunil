import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { funnelMetrics } from "@/lib/quiz/metrics";

/**
 * Análise por funil (sub-abas Respostas / Resultados / Performance, estilo inlead).
 * Admin only. Junta funnelMetrics (Performance) + quiz_answers (Resultados por
 * pergunta) + respostas por lead (sessão → respostas + nome/telefone).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (adminEmail && user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  // Filtro de datas (ISO, por created_at). Vazio = tudo.
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const range = { from, to };

  const performance = await funnelMetrics(slug, range);

  // deltas vs PERÍODO ANTERIOR (mesma duração imediatamente antes do início)
  let deltas: Record<string, number> | null = null;
  if (from) {
    const fromMs = new Date(from).getTime();
    const toMs = to ? new Date(to).getTime() : Date.now();
    const len = Math.max(1, toMs - fromMs);
    const prev = await funnelMetrics(slug, { from: new Date(fromMs - len).toISOString(), to: new Date(fromMs).toISOString() });
    const pct = (cur: number, prv: number) => (prv > 0 ? Math.round(((cur - prv) / prv) * 1000) / 10 : cur > 0 ? 100 : 0);
    deltas = {
      visitantes: pct(performance.visitantes, prev.visitantes),
      respostas: pct(performance.respostas, prev.respostas),
      leads: pct(performance.leads, prev.leads),
      conclusoes: pct(performance.conclusoes, prev.conclusoes),
      score: pct(performance.score, prev.score),
      taxaConclusao: pct(performance.taxaConclusao, prev.taxaConclusao),
      taxaInteracao: pct(performance.taxaInteracao, prev.taxaInteracao),
      mediaEtapas: pct(performance.mediaEtapas, prev.mediaEtapas),
      tempoMedioSeg: pct(performance.tempoMedioSeg, prev.tempoMedioSeg),
    };
  }
  const sb = createAdminClient();

  // Resultados: por pergunta → opções com contagem/%
  let answersQ = sb.from("quiz_answers").select("session_id,question,answer").eq("funnel_slug", slug).limit(50000);
  if (from) answersQ = answersQ.gte("created_at", from);
  if (to) answersQ = answersQ.lte("created_at", to);
  const { data: answers } = await answersQ;
  const qMap = new Map<string, Map<string, number>>();
  const qOrder: string[] = [];
  const bySession = new Map<string, Record<string, string>>();
  for (const a of answers ?? []) {
    const q = (a.question as string)?.trim() || "—";
    const ans = (a.answer as string)?.trim() || "—";
    const sid = String(a.session_id ?? "");
    if (!qMap.has(q)) { qMap.set(q, new Map()); qOrder.push(q); }
    const am = qMap.get(q)!;
    am.set(ans, (am.get(ans) ?? 0) + 1);
    if (sid) { if (!bySession.has(sid)) bySession.set(sid, {}); bySession.get(sid)![q] = ans; }
  }
  const resultados = qOrder.map((question) => {
    const am = qMap.get(question)!;
    const total = Array.from(am.values()).reduce((a, b) => a + b, 0);
    return {
      question, total,
      options: Array.from(am.entries())
        .map(([label, value]) => ({ label, value, pct: total ? Math.round((value / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.value - a.value),
    };
  });

  // Respostas: por lead (sessão → respostas + dados do lead capturado)
  let leadsQ = sb.from("funnel_leads")
    .select("session_id,name,phone,created_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term,src,fbclid,ctwa_clid,source_id,viewport,screen,platform,user_agent")
    .eq("funnel_slug", slug).order("created_at", { ascending: false }).limit(5000);
  if (from) leadsQ = leadsQ.gte("created_at", from);
  if (to) leadsQ = leadsQ.lte("created_at", to);
  const { data: leads } = await leadsQ;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadBy = new Map((leads ?? []).map((l: any) => [String(l.session_id ?? ""), l]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trackOf = (l: any) => l ? {
    utm_source: l.utm_source || "", utm_medium: l.utm_medium || "", utm_campaign: l.utm_campaign || "",
    utm_content: l.utm_content || "", utm_term: l.utm_term || "", src: l.src || "", fbclid: l.fbclid || "",
    ctwa_clid: l.ctwa_clid || "", source_id: l.source_id || "", viewport: l.viewport || "", screen: l.screen || "",
    platform: l.platform || "", user_agent: l.user_agent || "",
  } : {};
  const respostas = Array.from(bySession.entries()).map(([sid, ans]) => {
    const l = leadBy.get(sid);
    return { session: sid.slice(0, 8), name: (l?.name as string) || null, phone: (l?.phone as string) || null, when: (l?.created_at as string) || null, answers: ans, track: trackOf(l) };
  });

  // % de conclusão por etapa (igual inlead: 1ª etapa = 100%, demais relativas a ela)
  const firstTotal = resultados[0]?.total || 0;
  const questionStats = resultados.map((r) => ({
    question: r.question, total: r.total,
    pct: firstTotal ? Math.round((r.total / firstTotal) * 100) : 0,
  }));

  return NextResponse.json({ performance, deltas, resultados, questions: qOrder, questionStats, respostas });
}
