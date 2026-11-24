import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import WorkspaceSignOut from "@/components/workspace/WorkspaceSignOut";

/**
 * Layout das páginas protegidas do admin (route group `(panel)`).
 * O login fica fora deste grupo, então não é bloqueado.
 *
 * Gate em duas camadas:
 *  - proxy.ts: redireciona quem não tem sessão.
 *  - aqui: allowlist por email (só ADMIN_EMAIL acessa).
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  // FAIL-CLOSED: sem ADMIN_EMAIL ninguém entra (antes a env ausente liberava
  // qualquer usuário autenticado).
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
    // Logado, mas não é o email autorizado.
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-bold text-slate-900">
            VSL Plataforma
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user.email}</span>
            <WorkspaceSignOut className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
