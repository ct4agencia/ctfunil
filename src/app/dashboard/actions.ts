"use server";

import { revalidatePath } from "next/cache";
import { createFunnelDb, duplicateFunnelDb, deleteFunnelDb } from "@/lib/quiz/funnels-db";

export async function createFunnel(name: string, presetId: string) {
  const r = await createFunnelDb(name, presetId);
  revalidatePath("/dashboard");
  return r;
}

export async function duplicateFunnel(slug: string) {
  const r = await duplicateFunnelDb(slug);
  revalidatePath("/dashboard");
  return r;
}

export async function deleteFunnel(slug: string) {
  const r = await deleteFunnelDb(slug);
  revalidatePath("/dashboard");
  return r;
}
