"use server";

import type { CreationInput } from "@/lib/quiz/creation";
import { revalidatePath } from "next/cache";
import { createFunnelDb, duplicateFunnelDb, deleteFunnelDb, createImportedFunnelDb } from "@/lib/quiz/funnels-db";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import type { Funnel } from "@/lib/quiz/types";

export async function createImportedFunnel(funnel:Funnel) {
  const auth=await requireAdmin();if(!auth.ok)return {ok:false,error:auth.error};
  try {
    const data=JSON.stringify(funnel);
    if(data.length>2_000_000 || !funnel || typeof funnel.name!=='string' || !funnel.name.trim() || funnel.name.length>120 || funnel.settings?.engine!=='layers' || !Array.isArray(funnel.steps) || funnel.steps.length<1 || funnel.steps.length>30) return {ok:false,error:'O conteúdo importado é inválido ou grande demais.'};
    if(funnel.steps.some(step=>!('layers' in step) || !Array.isArray(step.layers) || step.layers.length>500))return {ok:false,error:'Confira os blocos do conteúdo importado.'};
    const result=await createImportedFunnelDb(funnel);if(result.ok)revalidatePath('/dashboard');return result;
  }catch{return {ok:false,error:'O conteúdo importado é inválido.'};}
}

export async function createFunnel(input: CreationInput) {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const r = await createFunnelDb(input);
  revalidatePath("/dashboard");
  return r;
}

export async function duplicateFunnel(slug: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const r = await duplicateFunnelDb(slug);
  revalidatePath("/dashboard");
  return r;
}

export async function deleteFunnel(slug: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const r = await deleteFunnelDb(slug);
  revalidatePath("/dashboard");
  return r;
}
