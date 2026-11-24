import { libraryContext, type LibraryContextQuery } from "@/lib/quiz/library-context";
import { preserveReportOrigin } from "@/lib/quiz/report-origin";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { isOfficialWorkspaceHost, isRealDataPreview } from "@/lib/workspace-preview";
import { getWorkspaceSnapshot } from "@/lib/workspace-real-data";
import { getPreviewFunnelDraft, hasPreviewVslDraft } from "@/lib/workspace-preview-vsl-drafts";
import { parseCivilRange } from "@/lib/quiz/periodo";
import PreviewVslDraftButton from "./PreviewVslDraftButton";
import BuilderRenderer from "@/components/builder/BuilderRenderer";
import { resolveFunnel, funnelIsDraft } from "@/lib/quiz/funnels-db";

export const metadata: Metadata = { title: "Construtor de Quiz" };

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<LibraryContextQuery & { editar?: string; tab?: string; from?: string; to?: string; comparar?: string | string[]; origem?: string; respFunil?: string }>;
}) {
  const { slug } = await params;
  const host = (await headers()).get("host");
  if (isOfficialWorkspaceHost(host)) {
    // Painel oficial: o construtor abre o funil do banco e salva nele.
    const [snapshot, funnel, draft] = await Promise.all([getWorkspaceSnapshot(), resolveFunnel(slug), funnelIsDraft(slug)]);
    if (!funnel) notFound();
    const query = await searchParams;
    const openLeads = query.tab === "leads";
    return <BuilderRenderer funnel={funnel} draft={draft} accountEmail={snapshot.accountEmail}
      openLeads={openLeads} initialRange={openLeads ? parseCivilRange(query.from, query.to) : undefined} />;
  }
  if (isRealDataPreview(host)) {
    const snapshot = await getWorkspaceSnapshot();
    const funnel = snapshot.funnels.find(item => item.slug === slug);
    if (!funnel) notFound();
    const query = await searchParams;
    const autoOpen = query.editar === "1";
    const openLeads = query.tab === "leads";
    const initialRange = openLeads ? parseCivilRange(query.from, query.to) : undefined;
    const reportParams = new URLSearchParams(initialRange);
    preserveReportOrigin(reportParams, query.origem, query.respFunil, slug);
    const compared = typeof query.comparar === "string" ? [query.comparar] : query.comparar ?? [];
    for (const item of compared) reportParams.append("comparar", item);
    for (const [key, value] of libraryContext(query)) reportParams.set(key, value);
    const reportQuery = reportParams.size ? `?${reportParams}` : "";
    const draftParams = new URLSearchParams(reportParams);
    if (openLeads) draftParams.set("tab", "leads");
    const draftQuery = draftParams.size ? `?${draftParams}` : "";
    const draft = getPreviewFunnelDraft(slug, funnel.name);
    return <WorkspaceFrame title="Construtor" accountEmail={snapshot.accountEmail}>
      <header className="ct-page-heading"><div><h1>{funnel.name}</h1><p>/{funnel.slug}</p></div></header>
      <section className="ct-panel space-y-3 p-4 sm:p-6" aria-labelledby="preview-builder-title">
        <h2 id="preview-builder-title" className="font-semibold">Funil em modo de consulta</h2>
        <p className="text-sm text-ct-dim">{draft ? "Edite uma cópia das etapas e dos blocos neste navegador." : "Para editar uma cópia, importe um HTML ou ZIP da página. Você também pode começar com um rascunho vazio."}</p>
        <div className="flex flex-wrap items-center gap-4">
          {draft && <PreviewVslDraftButton funnel={draft} video={hasPreviewVslDraft(slug)} autoOpen={autoOpen} draftQuery={draftQuery} />}
          <Link className={draft ? "text-sm text-ct-blue" : "ct-action-link"} href="/ctfunil/assistente#anexar-referencia">Importar uma referência</Link>
          <Link className="text-sm text-ct-blue" href="/lab/construtor">Abrir construtor de rascunhos</Link>
          <Link className="text-sm text-ct-blue" href={`/dashboard/${encodeURIComponent(slug)}${reportQuery}`}>Ver relatório do funil</Link>
        </div>
      </section>
    </WorkspaceFrame>;
  }
  const funnel = await resolveFunnel(slug);
  if (!funnel) notFound();
  // O BuilderRenderer faz code-split por engine (só baixa o construtor usado).
  return <BuilderRenderer funnel={funnel} draft={await funnelIsDraft(slug)} />;
}
