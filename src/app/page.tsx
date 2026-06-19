import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import VslView from "@/components/vsl/VslView";
import BlockRenderer from "@/components/vsl/BlockRenderer";
import PixelScripts from "@/components/vsl/PixelScripts";
import type { Vsl } from "@/lib/types";

/**
 * Raiz multi-domínio:
 *  - Se a requisição vier de um domínio próprio cadastrado numa VSL
 *    publicada, renderiza essa VSL (a página "mora" no domínio comprado).
 *  - Caso contrário (domínio da plataforma / localhost / *.vercel.app),
 *    manda pro admin.
 */
export default async function Home() {
  const h = await headers();
  const host = (h.get("host") || "")
    .toLowerCase()
    .split(":")[0]
    .replace(/^www\./, "");

  const platformHost = process.env.NEXT_PUBLIC_PLATFORM_HOST?.toLowerCase();
  const isPlatform =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    (platformHost && host === platformHost);

  if (!isPlatform && host) {
    // Vários VSLs podem compartilhar o domínio (cada um em /{slug}).
    // Na raiz nua, mostra o mais recente publicado desse domínio.
    const supabase = await createClient();
    const { data } = await supabase
      .from("vsls")
      .select("*")
      .eq("domain", host)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const vsl = data[0] as Vsl;
      const hasBlocks = Array.isArray(vsl.blocks) && vsl.blocks.length > 0;
      return (
        <>
          <PixelScripts
            settings={vsl.settings ?? {}}
            utmifyPixelId={vsl.utmify_pixel_id}
            hotmartAccountId={vsl.hotmart_account_id}
          />
          {hasBlocks ? (
            <BlockRenderer vsl={vsl} blocks={vsl.blocks} />
          ) : (
            <VslView vsl={vsl} />
          )}
        </>
      );
    }
  }

  redirect("/admin");
}
