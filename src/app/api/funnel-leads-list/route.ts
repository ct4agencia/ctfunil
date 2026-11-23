import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/** Lista paginada de leads de um funil (aba Leads do construtor). Admin only. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (!adminEmail || user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isReadOnlyWorkspace()) {
    return NextResponse.json({ error: "Dados individuais e exportações não estão disponíveis no preview." }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  const u = new URL(request.url);
  const slug = u.searchParams.get("slug") || "";
  const page = Math.max(0, parseInt(u.searchParams.get("page") || "0"));
  const per = Math.min(200, Math.max(10, parseInt(u.searchParams.get("per") || "50")));

  const sb = createAdminClient();
  let q = sb.from("funnel_leads").select("name,phone,funnel_slug,utm_source,utm_campaign,src,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * per, page * per + per - 1);
  if (slug) q = q.eq("funnel_slug", slug);
  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [], total: count ?? 0, page, per });
}
