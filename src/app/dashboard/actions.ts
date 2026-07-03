"use server";

import { revalidatePath } from "next/cache";
import { createFunnelDb, duplicateFunnelDb, deleteFunnelDb } from "@/lib/quiz/funnels-db";
import { requireAdmin } from "@/lib/quiz/admin-guard";

export async function createFunnel(name: string, presetId: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const r = await createFunnelDb(name, presetId);
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
