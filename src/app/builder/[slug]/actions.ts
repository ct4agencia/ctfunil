"use server";

import { saveFunnelDb } from "@/lib/quiz/funnels-db";
import type { Funnel } from "@/lib/quiz/types";

export async function saveFunnelAction(funnel: Funnel): Promise<{ ok: boolean; error?: string }> {
  return saveFunnelDb(funnel);
}
