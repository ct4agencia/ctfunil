"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VSL, type VslInput, type WebhookInput } from "@/lib/types";

/** Garante sessão antes de qualquer escrita. */
async function requireAuth() {
  if (isReadOnlyWorkspace()) throw new Error("O preview está em modo de consulta.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

function friendlyError(message: string): string {
  if (message.includes("duplicate") || message.includes("unique")) {
    return "Já existe uma VSL com esse slug. Escolha outro.";
  }
  return message;
}

export async function createVsl(
  input: Partial<VslInput>,
): Promise<{ error?: string }> {
  const supabase = await requireAuth();
  const row = { ...DEFAULT_VSL, ...input };
  const { data, error } = await supabase
    .from("vsls")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/admin");
  redirect(`/admin/vsls/${data.id}`);
}

export async function updateVsl(
  id: string,
  patch: Partial<VslInput>,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("vsls").update(patch).eq("id", id);

  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/admin");
  revalidatePath(`/admin/vsls/${id}`, "layout");
  return { success: true };
}

// ── Webhooks ──────────────────────────────────────────────────
export async function createWebhook(
  vslId: string,
  input: WebhookInput,
): Promise<{ error?: string }> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("webhooks")
    .insert({ ...input, vsl_id: vslId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/vsls/${vslId}/settings`);
  return {};
}

export async function updateWebhook(
  id: string,
  vslId: string,
  patch: Partial<WebhookInput>,
): Promise<{ error?: string }> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("webhooks").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/vsls/${vslId}/settings`);
  return {};
}

export async function deleteWebhook(
  id: string,
  vslId: string,
): Promise<{ error?: string }> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("webhooks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/vsls/${vslId}/settings`);
  return {};
}

export async function duplicateVsl(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin");

  const supabase = await requireAuth();
  const { data: src } = await supabase
    .from("vsls")
    .select("*")
    .eq("id", id)
    .single();
  if (!src) redirect("/admin");

  // Remove campos gerenciados pelo banco e o domínio (único, não se copia).
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    domain: _d,
    slug,
    name,
    ...rest
  } = src as Record<string, unknown> & { slug: string; name: string };

  // Garante um slug único pra cópia.
  const base = `${slug}-copia`;
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: exists } = await supabase
      .from("vsls")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!exists) break;
    candidate = `${base}-${n++}`;
  }

  const copy = {
    ...rest,
    slug: candidate,
    name: `${name} (cópia)`,
    status: "draft",
    domain: null,
  };

  const { data: inserted, error } = await supabase
    .from("vsls")
    .insert(copy)
    .select("id")
    .single();

  if (error || !inserted) redirect("/admin");

  revalidatePath("/admin");
  redirect(`/admin/vsls/${inserted.id}`);
}

export async function deleteVsl(id: string): Promise<void> {
  const supabase = await requireAuth();
  await supabase.from("vsls").delete().eq("id", id);
  revalidatePath("/admin");
  redirect("/admin");
}
