"use server";

import { revalidatePath, updateTag } from "next/cache";
import { saveFunnelDb, publishFunnelDb, funnelIsDraft, funnelCacheTag } from "@/lib/quiz/funnels-db";
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
      // a página fixa /upbf1/roleta guarda a roleta do funil por até 60 s
      updateTag(funnelCacheTag(s));
    }
  }
  return res;
}

export async function publishFunnelAction(funnel:Funnel):Promise<{ok:boolean;error?:string}> {
  const auth=await requireAdmin();if(!auth.ok)return {ok:false,error:auth.error};
  if(!await funnelIsDraft(funnel.slug))return {ok:false,error:'Este funil não é um rascunho.'};
  const saved=await saveFunnelDb(funnel);if(!saved.ok)return saved;
  const result=await publishFunnelDb(funnel.slug);
  if(result.ok){revalidatePath(`/${funnel.slug}`);revalidatePath(`/q/${funnel.slug}`);revalidatePath('/dashboard');updateTag(funnelCacheTag(funnel.slug));}
  return result;
}
