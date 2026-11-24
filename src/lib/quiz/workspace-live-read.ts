import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { createClient as createSessionClient } from "@/lib/supabase/server";
import { isOfficialWorkspaceHost, isRealDataPreview } from "@/lib/workspace-preview";

export function workspaceLiveReader(host: string | null, session: Awaited<ReturnType<typeof createSessionClient>>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Painel oficial: mesma leitura administrativa do construtor e das métricas.
  if (isOfficialWorkspaceHost(host) && url && key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  if (isRealDataPreview(host)) return session;
  return null;
}
