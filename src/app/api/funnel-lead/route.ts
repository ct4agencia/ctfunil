import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
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
  tracking?: Record<string, string>;
};

/** Dispara um webhook no MESMO formato do inlead (Datacrazy mapeia os campos). */
async function fireWebhook(wh: FunnelWebhook, payload: Record<string, unknown>) {
  try {
    const headers: Record<string, string> = {};
    if (wh.token) headers["Authorization"] = `Bearer ${wh.token}`;

    if (wh.method === "GET") {
      const url = new URL(wh.api_url);
      Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, String(v ?? "")));
      await fetch(url.toString(), { method: "GET", headers });
      return;
    }
    if (wh.content_type === "json") {
      headers["Content-Type"] = "application/json";
      await fetch(wh.api_url, { method: "POST", headers, body: JSON.stringify(payload) });
    } else {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => params.append(k, String(v ?? "")));
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      await fetch(wh.api_url, { method: "POST", headers, body: params });
    }
  } catch {
    /* best-effort: falha de webhook não quebra a captura */
  }
}

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
      .select("name, slug, hotmart_product_id, checkout_url, webhooks")
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

    const dataHora = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const componentId = body.componentId ?? "";
    const webhooks = ((funnel?.webhooks ?? []) as FunnelWebhook[]).filter(
      (wh) =>
        wh.enabled &&
        (wh.trigger_event === "lead_capture" ||
          (wh.trigger_event === "click_component" && (wh.component_id ?? "") === componentId)),
    );

    // Telefone p/ webhook (Datacrazy): +55 + número limpo (E.164). No banco fica
    // só dígitos; aqui formatamos só na hora de enviar pro webhook, quando ativado.
    const phoneDigits = String(body.phone ?? "").replace(/\D/g, "");
    const phoneIntl = phoneDigits ? "+55" + phoneDigits.replace(/^55/, "") : "";

    const payload: Record<string, unknown> = {
      code: body.session_id ?? "",
      nome: body.name ?? "",
      telefone: phoneIntl,
      pagina: funnel?.name ?? "",
      slug: funnel?.slug ?? body.funnelSlug,
      produto,
      data: dataHora,
      utm_source: t.utm_source ?? "",
      utm_medium: t.utm_medium ?? "",
      utm_campaign: t.utm_campaign ?? "",
      utm_content: t.utm_content ?? "",
      utm_term: t.utm_term ?? "",
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
