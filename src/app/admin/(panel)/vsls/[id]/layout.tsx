import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceTabs from "@/components/admin/WorkspaceTabs";
import type { Vsl } from "@/lib/types";

export default async function VslWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vsls")
    .select("id, name, slug, status, domain")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const vsl = data as Pick<Vsl, "id" | "name" | "slug" | "status" | "domain">;

  const pageUrl = vsl.domain
    ? `https://${vsl.domain}/${vsl.slug}`
    : `/${vsl.slug}`;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ← Todas as VSLs
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{vsl.name}</h1>
            <p className="text-sm text-slate-500">
              {vsl.domain ? `${vsl.domain}/${vsl.slug}` : `/${vsl.slug}`}
            </p>
          </div>
          {vsl.status === "published" && (
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Abrir página ↗
            </a>
          )}
        </div>
      </div>

      <WorkspaceTabs id={id} />

      <div className="py-6">{children}</div>
    </div>
  );
}
