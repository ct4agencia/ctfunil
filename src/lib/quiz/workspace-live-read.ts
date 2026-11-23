import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isProductionWorkspaceHost } from "@/lib/workspace-preview";

export function workspaceLiveReader(host: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.VERCEL_ENV !== "production" ||
      (host !== "ctfunil.vercel.app" && !isProductionWorkspaceHost(host)) || !url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
