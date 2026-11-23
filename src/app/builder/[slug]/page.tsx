import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { isRealDataPreview } from "@/lib/workspace-preview";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { getPreviewFunnelDraft, hasPreviewVslDraft } from "@/lib/workspace-preview-vsl-drafts";
import PreviewVslDraftButton from "./PreviewVslDraftButton";
import BuilderRenderer from "@/components/builder/BuilderRenderer";
import { resolveFunnel, funnelIsDraft } from "@/lib/quiz/funnels-db";

export const metadata: Metadata = { title: "Construtor de Quiz" };

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isRealDataPreview((await headers()).get("host"))) {
    const snapshot = await getWorkspaceSnapshot();
    const funnel = snapshot.funnels.find(item => item.slug === slug);
    if (!funnel) notFound();
    const draft = getPreviewFunnelDraft(slug, funnel.name);
    return <WorkspaceFrame title="Construtor">
      <header className="ct-page-heading"><div><h1>{funnel.name}</h1><p>/{funnel.slug}</p></div></header>
      <section className="ct-panel space-y-3 p-4 sm:p-6" aria-labelledby="preview-builder-title">
        <h2 id="preview-builder-title" className="font-semibold">Funil em modo de consulta</h2>
        <p className="text-sm text-ct-dim">{draft ? "Edite uma cópia das etapas e dos blocos neste navegador." : "Para editar uma cópia, importe um HTML ou ZIP da página. Você também pode começar com um rascunho vazio."}</p>
        <div className="flex flex-wrap items-center gap-4">
          {draft && <PreviewVslDraftButton funnel={draft} video={hasPreviewVslDraft(slug)} />}
          <Link className={draft ? "text-sm text-ct-blue" : "ct-action-link"} href="/ctfunil#anexar-referencia">Importar uma referência</Link>
          <Link className="text-sm text-ct-blue" href="/lab/construtor">Abrir construtor de rascunhos</Link>
          <Link className="text-sm text-ct-blue" href={`/dashboard/${encodeURIComponent(slug)}`}>Ver relatório do funil</Link>
        </div>
      </section>
    </WorkspaceFrame>;
  }
  const funnel = await resolveFunnel(slug);
  if (!funnel) notFound();
  // O BuilderRenderer faz code-split por engine (só baixa o construtor usado).
  return <BuilderRenderer funnel={funnel} draft={await funnelIsDraft(slug)} />;
}
