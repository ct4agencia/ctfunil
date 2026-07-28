import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Export CSV dos leads (Data, Nome, Telefone, Email, Funil, respostas do quiz, tracking).
 * Só o admin autenticado. Filtro opcional por ?slug=. Junta funnel_leads + quiz_answers
 * por session_id. Abre no Excel (BOM UTF-8). Telefone fica como dígitos (como no banco).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (!adminEmail || user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get("slug") || "";
  const sb = createAdminClient();

  // 1) leads
  let q = sb.from("funnel_leads").select("*").order("created_at", { ascending: false }).limit(20000);
  if (slug) q = q.eq("funnel_slug", slug);
  const { data: leads, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = leads ?? [];

  // 2) respostas do quiz → mapa session_id -> { pergunta: resposta }
  const bySession = new Map<string, Record<string, string>>();
  const questionOrder: string[] = [];
  try {
    let aq = sb.from("quiz_answers").select("session_id,question,answer").limit(100000);
    if (slug) aq = aq.eq("funnel_slug", slug);
    const { data: answers } = await aq;
    for (const a of answers ?? []) {
      const sid = String(a.session_id ?? "");
      const question = String(a.question ?? "—").trim() || "—";
      if (!sid) continue;
      if (!bySession.has(sid)) bySession.set(sid, {});
      bySession.get(sid)![question] = String(a.answer ?? "");
      if (!questionOrder.includes(question)) questionOrder.push(question);
    }
  } catch { /* sem respostas */ }

  // 3) cabeçalho: Data, Nome, Telefone, Email, Funil, <perguntas...>, tracking
  const trackingCols = ["utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term", "src", "xcod", "fbclid", "ctwa_clid", "source_id"];
  const header = ["Data", "Nome", "Telefone", "Email", "Funil", ...questionOrder, ...trackingCols, "Plataforma"];

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
    } catch { return iso || ""; }
  };
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [header.map(esc).join(",")];
  for (const l of rows) {
    const ans = bySession.get(String(l.session_id ?? "")) || {};
    const row = [
      fmtDate(l.created_at as string),
      l.name ?? "",
      l.phone ?? "",
      (l as Record<string, unknown>).email ?? "",
      l.funnel_slug ?? "",
      ...questionOrder.map((qn) => ans[qn] ?? ""),
      ...trackingCols.map((c) => (l as Record<string, unknown>)[c] ?? ""),
      l.platform ?? "",
    ];
    lines.push(row.map(esc).join(","));
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM p/ Excel
  const fname = `leads-${slug || "todos"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
