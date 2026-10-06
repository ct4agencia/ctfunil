"use server";

import { revalidatePath } from "next/cache";
import { saveFunnelDb } from "@/lib/quiz/funnels-db";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import type { Funnel } from "@/lib/quiz/types";

export async function saveFunnelAction(funnel: Funnel, renameFrom?: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const res = await saveFunnelDb(funnel, renameFrom);
  if (res.ok) {
    // a rota pública é ISR (cache de borda): salvar derruba o cache na hora
    for (const s of new Set([funnel.slug, renameFrom].filter(Boolean) as string[])) {
      revalidatePath(`/${s}`);
      revalidatePath(`/q/${s}`);
    }
  }
  return res;
}
