import Link from "next/link";
import { FileText } from "lucide-react";
import { Brand, ThemeButton } from "@/components/workspace/WorkspaceFrame";

export default function NotFound() {
  return <main className="ct-workspace relative min-h-dvh bg-ct-bg px-4 py-6 text-ct-ink">
    <header className="mx-auto flex max-w-xl items-center justify-between gap-4">
      <Brand />
      <ThemeButton />
    </header>
    <div className="mx-auto mt-10 max-w-xl sm:mt-16">
      <section className="ct-panel px-5 py-10 text-center sm:px-10" aria-labelledby="not-found-title">
        <FileText aria-hidden="true" size={56} strokeWidth={1.5} className="mx-auto text-ct-dim" />
        <h1 id="not-found-title" className="mt-5 text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ct-dim">Este endereço não está disponível.</p>
        <Link href="/ctfunil" className="ct-action-link mt-7 w-full">Voltar a Projetos</Link>
      </section>
    </div>
  </main>;
}
