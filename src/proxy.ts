import { NextResponse, type NextRequest } from "next/server";
import { isOfficialWorkspaceHost, isProductionWorkspaceHost, isReadOnlyWorkspace, realDataPreviewHost, isWorkspacePreview } from "@/lib/workspace-preview";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16: o antigo `middleware.ts` agora se chama `proxy.ts`.
 * Refresca a sessão Supabase e protege as rotas /admin.
 */
/** Rotas de escrita do próprio painel (todas exigem o login do dono). */
const OFFICIAL_WRITE_APIS = new Set(["/api/assistant", "/api/upload", "/api/reset-funnel-data"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const official = isOfficialWorkspaceHost(request.headers.get("host"));
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isReadOnlyWorkspace() && pathname.startsWith("/api/") && pathname !== "/api/assistant" && mutating) {
    return NextResponse.json({ error: "O preview está em modo de consulta." }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  // Painel oficial: grava funis, mas não registra visitas, etapas nem leads.
  // Os funis públicos rodam nos domínios próprios (outro deploy do projeto).
  if (official && pathname.startsWith("/api/") && mutating && !OFFICIAL_WRITE_APIS.has(pathname)) {
    return NextResponse.json({ error: "O painel não registra eventos de funil." }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  const previewHost = realDataPreviewHost(request.headers.get("host"));
  if (previewHost && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", `https://${previewHost}`));
  }
  // Caminhos de um segmento (`/{slug}`):
  // - no preview em consulta, nunca chegam ao resolvedor de funis de produção;
  // - no painel oficial, desde 26/11/2026 o `/{slug}` abre o funil publicado:
  //   é a "URL padrão do CTFunil", com cache (pedido do Luca). Só caminhos de
  //   arquivo (com ponto) param aqui, para robôs não consultarem o banco.
  if (/^\/[^/]+$/.test(pathname) &&
      !["/dashboard", "/analytics", "/ctfunil", "/upbf1", "/manifest.webmanifest", "/calculadora-lucrativa", "/nao-encontrado"].includes(pathname)) {
    if ((isReadOnlyWorkspace() || official) && pathname.includes(".")) return new NextResponse(null, { status: 404 });
  }
  if (isReadOnlyWorkspace() && /^\/[^/]+$/.test(pathname) &&
      !["/dashboard", "/analytics", "/ctfunil", "/upbf1", "/manifest.webmanifest", "/calculadora-lucrativa", "/nao-encontrado"].includes(pathname)) {
    const missing = request.nextUrl.clone();
    missing.protocol = "http:";
    missing.pathname = "/nao-encontrado";
    missing.search = "";
    return NextResponse.rewrite(missing, { status: 404 });
  }
  if ((pathname === "/dashboard" || pathname === "/analytics") && isWorkspacePreview(request.headers.get("host"))) {
    return NextResponse.next();
  }
  // Produção protege o workspace inteiro; o preview privado protege as subpáginas
  // de Projetos, o laboratório e a importação (a raiz de Projetos mostra a demonstração).
  const protectWorkspace = isProductionWorkspaceHost(request.headers.get("host")) || official || (previewHost !== null && (
    pathname.startsWith("/ctfunil/") || pathname.startsWith("/lab/") || pathname.startsWith("/importar/")
  ));
  const response = await updateSession(request, protectWorkspace);
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
