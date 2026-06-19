import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { duplicateVsl } from "@/app/admin/actions";
import type { Vsl } from "@/lib/types";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: vsls } = await supabase
    .from("vsls")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (vsls ?? []) as Vsl[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suas VSLs</h1>
          <p className="text-sm text-slate-500">
            {list.length} {list.length === 1 ? "página" : "páginas"} cadastrada
            {list.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/vsls/new"
          className="rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white transition hover:bg-sky-500"
        >
          + Nova VSL
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">Nenhuma VSL ainda.</p>
          <Link
            href="/admin/vsls/new"
            className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500"
          >
            Criar a primeira
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Domínio</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((vsl) => (
                <tr
                  key={vsl.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {vsl.name}
                  </td>
                  <td className="px-5 py-3 text-slate-500">/{vsl.slug}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {vsl.domain ? (
                      <span className="text-slate-700">{vsl.domain}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        vsl.status === "published"
                          ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                      }
                    >
                      {vsl.status === "published" ? "Publicada" : "Rascunho"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/vsls/${vsl.id}`}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={duplicateVsl}>
                        <input type="hidden" name="id" value={vsl.id} />
                        <button
                          type="submit"
                          className="font-medium text-slate-500 hover:underline"
                        >
                          Duplicar
                        </button>
                      </form>
                      {vsl.status === "published" && (
                        <a
                          href={
                            vsl.domain
                              ? `https://${vsl.domain}/${vsl.slug}`
                              : `/${vsl.slug}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-500 hover:underline"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
