import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { workspaceLiveReader } from "@/lib/quiz/workspace-live-read";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Entre para consultar os webhooks." }, { status: 401, headers });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9_-]{1,120}$/.test(slug)) return NextResponse.json({ error: "Funil inválido." }, { status: 400, headers });
  const db = workspaceLiveReader(request.headers.get("host"), admin.supabase);
  if (!db) return NextResponse.json({ error: "A consulta das integrações publicadas está disponível no painel de produção." }, { status: 403, headers });
  const { data, error } = await db.from("funnels").select("webhooks").eq("slug", slug).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível consultar a configuração publicada." }, { status: error ? 502 : 404, headers });
  const entries: unknown[] = Array.isArray(data.webhooks) ? data.webhooks : [];
  const webhooks = entries.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const { id, name, enabled, method, trigger_event, component_id, api_url } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id) return [];

    let host: string | undefined;
    if (typeof api_url === "string") {
      try {
        const url = new URL(api_url);
        if (url.protocol === "http:" || url.protocol === "https:") host = url.hostname;
      } catch {}
    }
    return [{
      id, host,
      name: typeof name === "string" ? name : undefined,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      method: method === "GET" || method === "POST" ? method : undefined,
      trigger_event: trigger_event === "lead_capture" || trigger_event === "click_component" || trigger_event === "vsl_progress" || trigger_event === "vsl_pitch" ? trigger_event : undefined,
      component_id: typeof component_id === "string" ? component_id : undefined,
    }];
  });
  return NextResponse.json({ webhooks }, { headers });
}
