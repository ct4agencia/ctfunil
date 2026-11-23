import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { workspaceLiveReader } from "@/lib/quiz/workspace-live-read";
import type { FunnelWebhook } from "@/lib/quiz/types";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!(await requireAdmin()).ok) return NextResponse.json({ error: "Entre para consultar os webhooks." }, { status: 401, headers });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9_-]{1,120}$/.test(slug)) return NextResponse.json({ error: "Funil inválido." }, { status: 400, headers });
  const db = workspaceLiveReader(request.headers.get("host"));
  if (!db) return NextResponse.json({ error: "A consulta das integrações publicadas está disponível no painel de produção." }, { status: 403, headers });
  const { data, error } = await db.from("funnels").select("webhooks").eq("slug", slug).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível consultar a configuração publicada." }, { status: error ? 502 : 404, headers });
  const webhooks = Array.isArray(data.webhooks) ? data.webhooks as FunnelWebhook[] : [];
  return NextResponse.json({ webhooks: webhooks.map(({ id, name, enabled, method, trigger_event, component_id, api_url }) => {
    let host;
    try { host = new URL(api_url).hostname; } catch {}
    return { id, name, enabled, method, trigger_event, component_id, host };
  }) }, { headers });
}
