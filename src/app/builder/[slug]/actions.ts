"use server";

import { saveFunnelDb } from "@/lib/quiz/funnels-db";
import type { Funnel } from "@/lib/quiz/types";

export async function saveFunnelAction(funnel: Funnel, renameFrom?: string): Promise<{ ok: boolean; error?: string }> {
  return saveFunnelDb(funnel, renameFrom);
}
