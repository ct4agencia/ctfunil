import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Lista todos os funis com suas lâminas (id/título/tipo) + layers completos —
 * usado pelo "Importar lâmina" do construtor. Admin only.
 */
export async function GET() {
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
  const sb = createAdminClient();
  const { data, error } = await sb.from("funnels").select("slug,name,steps").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const funnels = (data ?? []).map((f: any) => ({
    slug: f.slug, name: f.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps: (Array.isArray(f.steps) ? f.steps : []).map((s: any, i: number) => ({
      id: s.id, title: s.title || `Lâmina ${i + 1}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      types: Array.isArray(s.layers) ? s.layers.map((l: any) => l.type) : [],
      step: s, // objeto completo pra importar (com layers)
    })),
  }));
  return NextResponse.json({ funnels });
}
