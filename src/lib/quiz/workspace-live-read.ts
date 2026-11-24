import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { createClient as createSessionClient } from "@/lib/supabase/server";
import { isRealDataPreview, isProductionWorkspaceHost } from "@/lib/workspace-preview";

export function workspaceLiveReader(host: string | null, session: Awaited<ReturnType<typeof createSessionClient>>) {
  if (isRealDataPreview(host)) return session;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.VERCEL_ENV !== "production" ||
      (host !== "ctfunil.vercel.app" && !isProductionWorkspaceHost(host)) || !url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
