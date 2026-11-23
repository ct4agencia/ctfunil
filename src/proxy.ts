import { NextResponse, type NextRequest } from "next/server";
import { isProductionWorkspaceHost, isReadOnlyWorkspace, realDataPreviewHost, isWorkspacePreview } from "@/lib/workspace-preview";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16: o antigo `middleware.ts` agora se chama `proxy.ts`.
 * Refresca a sessão Supabase e protege as rotas /admin.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isReadOnlyWorkspace() && pathname.startsWith("/api/") && pathname !== "/api/assistant" &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return NextResponse.json({ error: "O preview está em modo de consulta." }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  const previewHost = realDataPreviewHost(request.headers.get("host"));
  if (previewHost && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", `https://${previewHost}`));
  }
  // Keep unknown single-segment requests away from the production funnel resolver.
  if (isReadOnlyWorkspace() && /^\/[^/]+$/.test(pathname) &&
      !["/dashboard", "/analytics", "/ctfunil", "/manifest.webmanifest", "/calculadora-lucrativa", "/nao-encontrado"].includes(pathname)) {
    if (pathname.includes(".")) return new NextResponse(null, { status: 404 });
    const missing = request.nextUrl.clone();
    missing.protocol = "http:";
    missing.pathname = "/nao-encontrado";
    missing.search = "";
    return NextResponse.rewrite(missing, { status: 404 });
  }
  if ((pathname === "/dashboard" || pathname === "/analytics") && isWorkspacePreview(request.headers.get("host"))) {
    return NextResponse.next();
  }
  const response = await updateSession(request, isProductionWorkspaceHost(request.headers.get("host")));
  if (previewHost) {
    const location = response.headers.get("location");
    if (location) {
      const target = new URL(location, request.url);
      response.headers.set("location", new URL(target.pathname + target.search + target.hash, `https://${previewHost}`).href);
    }
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, menos arquivos estáticos e imagens:
     * - _next/static, _next/image
     * - favicon, arquivos de metadata
     * - extensões comuns de imagem
     */
    "/((?!_next/static|_next/image|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
