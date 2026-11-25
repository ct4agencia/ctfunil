"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { saveUpbf1RouletteSettings, UPBF1_SETTINGS_TAG } from "@/lib/upbf1-roleta";
import type { Upbf1RouletteSettings } from "@/lib/upbf1-roleta-config";

export async function saveUpbf1RouletteAction(input: Upbf1RouletteSettings):
  Promise<{ ok: true; settings: Upbf1RouletteSettings } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "Sua sessão expirou. Entre novamente para salvar." };
  const result = await saveUpbf1RouletteSettings({
    autoRedirect: input?.autoRedirect, seconds: input?.seconds,
  } as Upbf1RouletteSettings, auth.user.email);
  // A roleta guarda a leitura por até 60 s: derruba o cache para valer na hora.
  if (result.ok) updateTag(UPBF1_SETTINGS_TAG);
  return result;
}
