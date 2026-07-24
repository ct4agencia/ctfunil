import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { fireWebhook, phoneToIntl, dataHoraBr } from "@/lib/quiz/webhooks";
import type { FunnelWebhook } from "@/lib/quiz/types";

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function db() {
  return createSbClient(URL_ENV, SERVICE || ANON, { auth: { persistSession: false } });
}

type Body = {
  funnelSlug: string;
  name: string;
  phone: string;
  componentId?: string;
  viewport?: string;
  screen?: string;
  platform?: string;
  user_agent?: string;
  session_id?: string;
  estado?: string;
  cidade?: string;
  tracking?: Record<string, string>;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.funnelSlug || !body.phone) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const t = body.tracking ?? {};
  const sb = db();

  const leadRow = {
    funnel_slug: body.funnelSlug,
    session_id: body.session_id ?? null,
    name: body.name ?? null,
    phone: body.phone,
    component_id: body.componentId ?? null,
    utm_source: t.utm_source ?? null,
    utm_medium: t.utm_medium ?? null,
    utm_campaign: t.utm_campaign ?? null,
    utm_content: t.utm_content ?? null,
    utm_term: t.utm_term ?? null,
    src: t.src ?? null,
    xcod: t.xcod ?? null,
    fbclid: t.fbclid ?? null,
    ctwa_clid: t.ctwa_clid ?? null,
    source_id: t.source_id ?? null,
    fbp: t.fbp ?? null,
    fbc: t.fbc ?? null,
    viewport: body.viewport ?? null,
    screen: body.screen ?? null,
    platform: body.platform ?? null,
    user_agent: body.user_agent ?? null,
  };

  const { error } = await sb.from("funnel_leads").insert(leadRow);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Webhooks: precisa do service_role pra ler os webhooks do funil (RLS).
  if (SERVICE) {
    const { data: funnel } = await sb
      .from("funnels")
      .select("name, slug, hotmart_product_id, checkout_url, webhooks, settings, steps")
      .eq("slug", body.funnelSlug)
      .maybeSingle();

    let produto = funnel?.hotmart_product_id ?? "";
    if (!produto && funnel?.checkout_url) {
      try {
        produto = new URL(funnel.checkout_url).pathname.split("/").filter(Boolean)[0] ?? "";
      } catch {
        produto = "";
      }
    }
    // Nome legível do produto p/ Datacrazy (campo "Produto"): settings.produto_nome
    // (ex.: "Clube das Bolsas") ou o nome do funil como fallback.
    const produtoNome = (funnel?.settings as { produto_nome?: string } | null)?.produto_nome || funnel?.name || "";
    // Fonte de tráfego derivada do utm_source (FB/Instagram → Meta, etc.) — igual inlead.
    const fonteTrafego = (() => {
      const s = (t.utm_source || "").toLowerCase();
      if (!s) return "";
      if (/fb|face|meta|insta|ig\b/.test(s)) return "Meta";
      if (/goog|gads|google/.test(s)) return "Google";
      if (/tiktok|^tt$/.test(s)) return "TikTok";
      if (/kwai/.test(s)) return "Kwai";
      return t.utm_source || "";
    })();

    const dataHora = dataHoraBr();

    const componentId = body.componentId ?? "";
    const webhooks = ((funnel?.webhooks ?? []) as FunnelWebhook[]).filter(
      (wh) =>
        wh.enabled &&
        (wh.trigger_event === "lead_capture" ||
          (wh.trigger_event === "click_component" && (wh.component_id ?? "") === componentId)),
    );

    // Telefone p/ webhook (Datacrazy): +55 + número limpo (E.164). No banco fica
    // só dígitos; aqui formatamos só na hora de enviar pro webhook, quando ativado.
    const phoneIntl = phoneToIntl(body.phone);

    // Respostas do quiz (pra Datacrazy): busca quiz_answers desta sessão e monta
    // pergunta_N / resposta_N (1 por pergunta, última prevalece) + um campo único
    // "respostas" legível. Best-effort: se a tabela/sessão não tiver, segue vazio.
    const respFields: Record<string, string> = {};
    const namedFields: Record<string, string> = {}; // campos NOMEADOS (Faixa_Etaria, Filhos…) p/ Datacrazy
    let respostasStr = "";
    if (body.session_id) {
      const { data: qa } = await sb
        .from("quiz_answers")
        .select("question, answer, created_at, step_id")
        .eq("session_id", body.session_id)
        .order("created_at", { ascending: true });
      const order: string[] = [];
      const ansByQ = new Map<string, string>();
      for (const row of qa ?? []) {
        const q = String(row.question ?? "").trim();
        const a = String(row.answer ?? "").trim();
        if (!q || !a) continue;
        if (!ansByQ.has(q)) order.push(q);
        ansByQ.set(q, a); // re-resposta (voltou e mudou) → última prevalece
      }
      order.forEach((q, i) => {
        respFields[`pergunta_${i + 1}`] = q;
        respFields[`resposta_${i + 1}`] = ansByQ.get(q)!;
      });
      respostasStr = order.map((q) => `${q}: ${ansByQ.get(q)}`).join(" | ");

      // Campos NOMEADOS por pergunta (igual inlead): cada lâmina de pergunta tem
      // uma `webhookKey` (ex.: Idade→"Faixa_Etaria"); casa por step_id, última prevalece.
      const stepKey = new Map<string, string>();
      for (const st of (funnel?.steps as { id?: string; webhookKey?: string }[] | null) ?? []) {
        if (st?.id && st?.webhookKey) stepKey.set(st.id, st.webhookKey);
      }
      for (const row of qa ?? []) {
        const key = stepKey.get(String((row as { step_id?: string }).step_id ?? ""));
        const a = String(row.answer ?? "").trim();
        if (key && a) namedFields[key] = a; // ordem asc → última resposta prevalece
      }
    }

    // REQ-3 (spec vturb): % da VSL já assistida até a captura — campo ADITIVO,
    // o formato existente não muda (Datacrazy só ganha mais um campo mapeável).
    let vslWatchPct = 0;
    if (body.session_id) {
      const { data: s } = await sb
        .from("funnel_sessions")
        .select("vsl_watch_pct")
        .eq("session_id", body.session_id)
        .maybeSingle();
      vslWatchPct = Number(s?.vsl_watch_pct ?? 0);
    }

    const payload: Record<string, unknown> = {
      code: body.session_id ?? "",
      nome: body.name ?? "",
      telefone: phoneIntl,
      estado: body.estado ?? "",
      cidade: body.cidade ?? "",
      pagina: funnel?.name ?? "",
      slug: funnel?.slug ?? body.funnelSlug,
      produto,
      Produto: produtoNome,               // nome legível (Datacrazy)
      Fonte_de_Trafego: fonteTrafego,     // Meta/Google/… derivado do utm_source
      data: dataHora,
      respostas: respostasStr,
      vsl_watch_pct: vslWatchPct,
      ...respFields,
      ...namedFields,                     // Faixa_Etaria, Filhos, Ocupacao, …
      utm_source: t.utm_source ?? "",
      utm_medium: t.utm_medium ?? "",
      utm_campaign: t.utm_campaign ?? "",
      utm_content: t.utm_content ?? "",
      utm_term: t.utm_term ?? "",
      utm_id: t.utm_id ?? "",             // ID do anúncio (Meta)
      src: t.src ?? "",
      xcod: t.xcod ?? "",
      fbclid: t.fbclid ?? "",
      ctwa_clid: t.ctwa_clid ?? "",
      source_id: t.source_id ?? "",
      fbp: t.fbp ?? "",
      fbc: t.fbc ?? "",
    };
    if (componentId) payload[componentId] = "clicked";

    await Promise.allSettled(webhooks.map((wh) => fireWebhook(wh, payload)));
  }

  return NextResponse.json({ ok: true });
}
