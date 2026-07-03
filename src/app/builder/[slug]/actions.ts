"use server";

import { saveFunnelDb } from "@/lib/quiz/funnels-db";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import type { Funnel } from "@/lib/quiz/types";

export async function saveFunnelAction(funnel: Funnel, renameFrom?: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  return saveFunnelDb(funnel, renameFrom);
}
