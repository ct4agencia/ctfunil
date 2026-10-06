import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Webhook } from "@/lib/types";

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function db() {
  // service_role bypassa RLS (necessário pra ler webhooks). Sem ela, cai no
  // anon (que ainda consegue inserir lead pela policy "leads anon insert").
  return createSbClient(URL_ENV, SERVICE || ANON, {
    auth: { persistSession: false },
  });
}

type Body = {
  vslId: string;
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

async function fireWebhook(wh: Webhook, payload: Record<string, unknown>) {
  try {
    const headers: Record<string, string> = {};
    if (wh.token) headers["Authorization"] = `Bearer ${wh.token}`;

    if (wh.method === "GET") {
      const url = new URL(wh.api_url);
      Object.entries(payload).forEach(([k, v]) =>
        url.searchParams.set(k, String(v ?? "")),
      );
      await fetch(url.toString(), { method: "GET", headers });
      return;
    }

    // POST
    if (wh.content_type === "json") {
      headers["Content-Type"] = "application/json";
      await fetch(wh.api_url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } else {
      // formData → application/x-www-form-urlencoded (flat key=value),
      // exatamente como o inlead. NÃO usar multipart (FormData), pois o
      // Datacrazy não extrai os campos do multipart pra mapear.
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) =>
        params.append(k, String(v ?? "")),
      );
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      await fetch(wh.api_url, { method: "POST", headers, body: params });
    }
  } catch {
    // best-effort: falha de webhook não quebra a captura
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.vslId || !body.phone) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const t = body.tracking ?? {};
  const code = body.session_id || "l-" + Math.random().toString(36).slice(2, 10);
  const supabase = db();

  const leadRow = {
    vsl_id: body.vslId,
    code,
    name: body.name ?? null,
    phone: body.phone,
    email: null,
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

  const { error } = await supabase.from("leads").insert(leadRow);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dispara webhooks (só com service_role, pois RLS bloqueia leitura via anon).
  if (SERVICE) {
    const [{ data: webhooks }, { data: vslRow }] = await Promise.all([
      supabase.from("webhooks").select("*").eq("vsl_id", body.vslId).eq("enabled", true),
      supabase
        .from("vsls")
        .select("name, slug, hotmart_product_id, checkout_url")
        .eq("id", body.vslId)
        .single(),
    ]);

    // Product ID: usa o manual; senão extrai do link de checkout.
    let produto = vslRow?.hotmart_product_id ?? "";
    if (!produto && vslRow?.checkout_url) {
      try {
        produto =
          new URL(vslRow.checkout_url).pathname.split("/").filter(Boolean)[0] ?? "";
      } catch {
        produto = "";
      }
    }

    // Data+hora do clique (fuso de São Paulo), formato BR.
    const dataHora = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const componentId = body.componentId ?? "";
    // Dispara: webhooks de "Captura de lead" (sempre) + "Click em componente"
    // cujo ID/Name casa com o ID do botão do popup.
    const toFire = ((webhooks ?? []) as Webhook[]).filter(
      (wh) =>
        wh.trigger_event === "lead_capture" ||
        (wh.trigger_event === "click_component" &&
          (wh.component_id ?? "") === componentId),
    );

    // Payload no MESMO formato do inlead, pra casar com os mapeamentos
    // existentes no Datacrazy (nome, telefone, e flag {componente}: "clicked").
    const payload: Record<string, unknown> = {
      code,
      nome: body.name ?? "",
      telefone: body.phone,
      pagina: vslRow?.name ?? "",
      slug: vslRow?.slug ?? "",
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
    // Flag do componente clicado (ex.: webhook: "clicked"), como o inlead faz.
    if (componentId) payload[componentId] = "clicked";

    await Promise.allSettled(toFire.map((wh) => fireWebhook(wh, payload)));
  }

  return NextResponse.json({ ok: true });
}
