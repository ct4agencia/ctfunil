import { createClient } from "@/lib/supabase/server";

/**
 * Guarda de admin p/ server actions e rotas de ESCRITA.
 * Espelha o check das rotas de API (ex. funnel-analytics): usuário logado e,
 * se ADMIN_EMAIL estiver setado, email precisa bater. Defesa em profundidade —
 * o proxy já bloqueia a rota, mas server actions com service_role não podem
 * depender só do matcher.
 */
export async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!user || (adminEmail && user.email?.toLowerCase() !== adminEmail)) {
      return { ok: false, error: "unauthorized" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}
