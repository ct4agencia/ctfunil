import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas do painel que exigem login (CTFUNNEL + admin VSL herdado). */
const PROTECTED = ["/dashboard", "/builder", "/analytics", "/admin"];

/**
 * Atualiza a sessão Supabase a cada request (refresh de token via cookies)
 * e protege o painel inteiro (/dashboard, /builder, /analytics, /admin).
 * Aposenta o painel VSL antigo: /admin* → /dashboard. Login em /admin/login.
 * Allowlist por email (ADMIN_EMAIL) garante 1 só dono.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/admin/login";
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // PÁGINAS PÚBLICAS (funil da lead /q, APIs, home): nada de auth/getUser.
  // Isso tira ~200–400ms (1 ida ao Supabase) de TODA requisição pública —
  // principalmente da página que a LEAD vê. Só rotas protegidas pagam o custo.
  if (!isProtected && !isLoginRoute) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não rodar código entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allowlist: só o dono (ADMIN_EMAIL) conta como logado, se a env existir.
  const allowed = !!user && (!process.env.ADMIN_EMAIL || user.email === process.env.ADMIN_EMAIL);

  // 1) Sem login tentando acessar o painel (menos o login) → vai pro login
  if (isProtected && !isLoginRoute && !allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // 2) Já logado abrindo o login → vai pro dashboard
  if (isLoginRoute && allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3) Aposenta o painel VSL antigo: qualquer /admin (logado) → /dashboard
  if (allowed && (pathname === "/admin" || pathname.startsWith("/admin/")) && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
