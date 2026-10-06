import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16: o antigo `middleware.ts` agora se chama `proxy.ts`.
 * Refresca a sessão Supabase e protege as rotas /admin.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, menos arquivos estáticos e imagens:
     * - _next/static, _next/image
     * - favicon, arquivos de metadata
     * - extensões comuns de imagem
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
