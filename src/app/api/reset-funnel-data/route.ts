import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Reseta os dados de UM funil (Respostas/Sessões/Eventos/Leads). Admin only.
 * Apaga só por funnel_slug — nunca global. Recomendação de extrair CSV antes
 * fica na UI (botão "Exportar leads" ao lado).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (!adminEmail || user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let slug = "";
  try { slug = (await request.json())?.slug || ""; } catch { /* body inválido */ }
  if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

  const sb = createAdminClient();
  const tables = ["funnel_leads", "quiz_answers", "step_events", "funnel_sessions"];
  const result: Record<string, string> = {};
  for (const t of tables) {
    const { error } = await sb.from(t).delete().eq("funnel_slug", slug);
    result[t] = error ? `erro: ${error.message}` : "ok";
  }
  return NextResponse.json({ ok: true, slug, result });
}
