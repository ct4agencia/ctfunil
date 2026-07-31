import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Export CSV das respostas — PADRÃO INLEAD.
 *
 * Formato copiado do arquivo real do inlead (leads_cdb-bolsas-src-04-google.csv):
 *   code, created_at, <uma coluna por BLOCO>, tracking
 * onde cada coluna de bloco vem prefixada pelo tipo e identificada por uma chave
 * ESTÁVEL:  "options: Faixa_Etaria" · "button: Df1RsH" · "field: nome"
 *
 * Diferenças em relação ao export antigo (Data/Nome/Telefone/Email/…):
 *  - exporta por SESSÃO, não só quem virou lead → dá pra ver quem abandonou e onde;
 *  - as colunas saem na ORDEM DO FUNIL e vêm da estrutura das lâminas, não do texto
 *    da pergunta (renomear a lâmina não quebra mais a coluna);
 *  - inclui os botões como "clicked", derivado do progresso (max_step_reached),
 *    que é como a aba Respostas já mostra na tela;
 *  - o tracking vai num campo só, no formato "chave: valor | chave: valor";
 *  - saiu a coluna "Email": lia uma coluna que não existe em funnel_leads e vinha
 *    sempre vazia (o e-mail digitado pela lead é descartado hoje — bug à parte).
 *
 * Só o admin autenticado. Filtro opcional por ?slug=. BOM UTF-8 p/ abrir no Excel.
 */

type Layer = { id?: string; type?: string; webhookKey?: string; content?: Record<string, unknown> };
type Step = { id?: string; title?: string; disabled?: boolean; layers?: Layer[]; type?: string; webhookKey?: string };

/** Uma coluna do CSV: prefixo do tipo + chave estável. */
type Col = { header: string; kind: "options" | "button" | "field"; stepId: string; stepIdx: number; fieldName?: string };

/** Monta as colunas a partir da ESTRUTURA do funil (ordem das lâminas). */
function colunasDoFunil(steps: Step[]): Col[] {
  const cols: Col[] = [];
  const ativos = steps.filter((s) => !s?.disabled);
  ativos.forEach((step, idx) => {
    const layers = Array.isArray(step.layers) ? step.layers : [];
    // motor tipado: a lâmina inteira é a unidade (não tem blocos)
    if (!layers.length) {
      if (step.type === "question" || step.type === "slider" || step.type === "measure") {
        cols.push({ header: `options: ${step.webhookKey || step.id || idx}`, kind: "options", stepId: String(step.id ?? idx), stepIdx: idx });
      }
      return;
    }
    for (const l of layers) {
      const id = String(l.id ?? "");
      if (l.type === "options") {
        cols.push({ header: `options: ${l.webhookKey || step.webhookKey || id}`, kind: "options", stepId: String(step.id ?? idx), stepIdx: idx });
      } else if (l.type === "button") {
        cols.push({ header: `button: ${id}`, kind: "button", stepId: String(step.id ?? idx), stepIdx: idx });
      } else if (l.type === "field") {
        const nome = String((l.content?.name as string) || (l.content?.type as string) || id);
        cols.push({ header: `field: ${nome}`, kind: "field", stepId: String(step.id ?? idx), stepIdx: idx, fieldName: nome });
      }
    }
  });
  return cols;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get("slug") || "";
  const sb = createAdminClient();

  // 1) estrutura do funil -> ordem e nome das colunas
  let cols: Col[] = [];
  if (slug) {
    const { data: f } = await sb.from("funnels").select("steps").eq("slug", slug).maybeSingle();
    cols = colunasDoFunil((f?.steps as Step[]) ?? []);
  }

  // 2) sessões (a linha do CSV é a SESSÃO, não o lead)
  let sq = sb.from("funnel_sessions")
    .select("session_id,created_at,max_step_reached,utm_source,utm_medium,utm_campaign,utm_content,utm_term,src,xcod,ctwa_clid,source_id")
    .order("created_at", { ascending: false }).limit(20000);
  if (slug) sq = sq.eq("funnel_slug", slug);
  const { data: sessions, error } = await sq;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3) respostas por sessão+lâmina
  const ansBy = new Map<string, Map<string, string>>();
  let aq = sb.from("quiz_answers").select("session_id,step_id,answer").limit(100000);
  if (slug) aq = aq.eq("funnel_slug", slug);
  const { data: answers } = await aq;
  for (const a of answers ?? []) {
    const sid = String(a.session_id ?? "");
    if (!sid) continue;
    if (!ansBy.has(sid)) ansBy.set(sid, new Map());
    ansBy.get(sid)!.set(String(a.step_id ?? ""), String(a.answer ?? ""));
  }

  // 4) leads (nome/telefone preenchem as colunas field:)
  let lq = sb.from("funnel_leads").select("session_id,name,phone,fbclid").limit(20000);
  if (slug) lq = lq.eq("funnel_slug", slug);
  const { data: leads } = await lq;
  const leadBy = new Map((leads ?? []).map((l) => [String(l.session_id ?? ""), l as Record<string, unknown>]));

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
    } catch { return iso || ""; }
  };
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const TRACK = ["utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term", "src", "xcod", "ctwa_clid", "source_id"] as const;

  const header = ["code", "created_at", ...cols.map((c) => c.header), "tracking"];
  const lines = [header.map(esc).join(",")];

  for (const s of sessions ?? []) {
    const sid = String(s.session_id ?? "");
    const ans = ansBy.get(sid);
    const lead = leadBy.get(sid);
    const max = Number(s.max_step_reached ?? 0);

    const celulas = cols.map((c) => {
      if (c.kind === "options") return ans?.get(c.stepId) ?? "";
      // botão: a lead passou desta lâmina, logo clicou (mesma regra da tela)
      if (c.kind === "button") return max > c.stepIdx ? "clicked" : "";
      // campo: nome/telefone vêm do lead capturado
      const n = (c.fieldName || "").toLowerCase();
      if (/tel|phone|whats/.test(n)) return (lead?.phone as string) ?? "";
      if (/nome|name/.test(n)) return (lead?.name as string) ?? "";
      return "";
    });

    // tracking consolidado, formato do inlead: "chave: valor | chave: valor"
    const track = TRACK
      .map((k) => [k, (s as Record<string, unknown>)[k]] as const)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    if (lead?.fbclid) track.push(`fbclid: ${lead.fbclid}`);

    lines.push([
      // "code" curto como o inlead (o session_id inteiro é longo e tem o ::slug)
      sid.replace(/::.*$/, "").replace(/^s-/, "").slice(0, 12),
      fmtDate(s.created_at as string),
      ...celulas,
      track.join(" | "),
    ].map(esc).join(","));
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM p/ Excel
  const stamp = new Date().toISOString().slice(0, 10);
  const fname = `leads_${slug || "todos"}_${stamp}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
