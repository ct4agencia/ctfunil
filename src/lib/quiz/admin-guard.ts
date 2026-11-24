import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda de admin p/ server actions e rotas de ESCRITA.
 * Espelha o check das rotas de API (ex. funnel-analytics): usuário logado e,
 * se ADMIN_EMAIL estiver setado, email precisa bater. Defesa em profundidade —
 * o proxy já bloqueia a rota, mas server actions com service_role não podem
 * depender só do matcher.
 */
export async function requireAdmin(): Promise<{ ok: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthorized" };

    // FAIL-CLOSED: sem ADMIN_EMAIL, NEGA. A regra antiga era
    // `adminEmail && email !== adminEmail`, que liberava QUALQUER usuário
    // autenticado quando a env sumia — e o signup do Supabase está aberto,
    // então bastava criar conta pra alcançar /api/reset-funnel-data.
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!adminEmail) {
      console.error("[admin-guard] ADMIN_EMAIL nao configurada — negando acesso admin");
      return { ok: false, error: "admin nao configurado" };
    }
    if (user.email?.toLowerCase() !== adminEmail) return { ok: false, error: "unauthorized" };
    return { ok: true, user, supabase };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}
