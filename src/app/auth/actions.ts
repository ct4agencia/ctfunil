"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInToWorkspace(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) return "unavailable";
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return "invalid_credentials";
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

  if (error) {
    if (error.status === 429) return "rate_limited";
    if (error.code === "invalid_credentials") return "invalid_credentials";
    return "unavailable";
  }

  if (data.user?.email?.toLowerCase() !== adminEmail) {
    await supabase.auth.signOut({ scope: "local" });
    return "restricted";
  }

  return "success";
}

/** Server Action: encerra a sessão e volta pro login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function verifyWorkspaceRecoveryCode(email: string, token: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) return "unavailable";
  if (typeof email !== "string" || email.toLowerCase() !== adminEmail ||
      typeof token !== "string" || !/^\d{6}$/.test(token)) return "invalid";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  if (error?.status === 429) return "rate_limited";
  if (error && error.status && error.status >= 500) return "unavailable";
  if (error || !data.session) return "invalid";
  return "success";
}
