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
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

  const performance = await funnelMetrics(slug);
  const sb = createAdminClient();

  // Resultados: por pergunta → opções com contagem/%
  const { data: answers } = await sb.from("quiz_answers").select("session_id,question,answer").eq("funnel_slug", slug).limit(50000);
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
  const { data: leads } = await sb.from("funnel_leads").select("session_id,name,phone,created_at").eq("funnel_slug", slug).order("created_at", { ascending: false }).limit(3000);
  const leadBy = new Map((leads ?? []).map((l) => [String(l.session_id ?? ""), l]));
  const respostas = Array.from(bySession.entries()).map(([sid, ans]) => {
    const l = leadBy.get(sid);
    return { session: sid.slice(0, 8), name: (l?.name as string) || null, phone: (l?.phone as string) || null, when: (l?.created_at as string) || null, answers: ans };
  });

  return NextResponse.json({ performance, resultados, questions: qOrder, respostas });
}
