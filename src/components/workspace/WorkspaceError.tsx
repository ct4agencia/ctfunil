"use client";

import Link from "next/link";
import { CircleAlert, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

export default function WorkspaceError({
  title,
  editor = false,
  returnLink = { href: "/ctfunil", label: "Voltar a Projetos" },
}: {
  title: string;
  editor?: boolean;
  returnLink?: { href: string; label: string };
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className="ct-workspace grid min-h-dvh place-items-center px-4 py-8">
      <section aria-labelledby="ct-workspace-error-title" className="ct-panel w-full max-w-md p-6 sm:p-8">
        <CircleAlert size={24} className="text-ct-blue" aria-hidden="true" />
        <h1 ref={heading} tabIndex={-1} id="ct-workspace-error-title" className="mt-3 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-ct-dim">
          {editor ? "Ao recarregar, alterações que ainda não foram salvas podem ser perdidas." : "Não foi possível carregar os dados. Tente recarregar a página."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-ct-action px-4 py-2 font-semibold text-white"
            onClick={() => window.location.reload()}>
            <RefreshCw size={16} aria-hidden="true" /> Recarregar página
          </button>
          <Link href={returnLink.href} className="text-ct-blue">{returnLink.label}</Link>
        </div>
      </section>
    </main>
  );
}
