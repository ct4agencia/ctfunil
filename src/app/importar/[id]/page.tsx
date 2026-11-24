import { libraryContext, libraryHref, type LibraryContextQuery } from "@/lib/quiz/library-context";
import { preserveReportOrigin } from "@/lib/quiz/report-origin";
import { headers } from 'next/headers';
import { isRealDataPreview } from '@/lib/workspace-preview';
import { hasPreviewFunnelDraft } from '@/lib/workspace-preview-vsl-drafts';
import { parseCivilRange } from '@/lib/quiz/periodo';
import { requireAdmin } from "@/lib/quiz/admin-guard";
import ImportEditor from './ImportEditor';
export const metadata={title:'Importação | CTFunil',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<LibraryContextQuery & {preview?:string;etapa?:string;tab?:string;from?:string;to?:string;comparar?:string|string[];origem?:string;respFunil?:string}>}) {
  const { id } = await params;
  const query = await searchParams;
  const { preview, etapa, tab, from, to, comparar, origem, respFunil } = query;
  const realPreview = isRealDataPreview((await headers()).get("host"));
  const draftSlug = /^preview-(?:vsl|funil)-([a-z0-9_-]+)$/.exec(id)?.[1];
  const library = realPreview ? libraryContext(query) : new URLSearchParams();
  const reportParams = new URLSearchParams(library);
  preserveReportOrigin(reportParams, origem, respFunil, draftSlug);
  for (const item of typeof comparar === "string" ? [comparar] : comparar ?? []) reportParams.append("comparar", item);
  const reportQuery = reportParams.size ? `?${reportParams}` : "";
  const reportHref = realPreview && draftSlug && hasPreviewFunnelDraft(draftSlug)
    ? `/dashboard/${encodeURIComponent(draftSlug)}${reportQuery}`
    : undefined;
  const openLeads = Boolean(reportHref && tab === "leads");
  const initialRange = openLeads ? parseCivilRange(from, to) : undefined;
  const navigation = reportHref ? new URLSearchParams(reportParams) : new URLSearchParams(library);
  if (openLeads) navigation.set("tab", "leads");
  if (initialRange) {
    navigation.set("from", initialRange.from);
    navigation.set("to", initialRange.to);
  }
  const recoverParams = new URLSearchParams(navigation);
  recoverParams.set("editar", "1");
  const recoverHref = reportHref && draftSlug ? `/builder/${encodeURIComponent(draftSlug)}?${recoverParams}` : undefined;
  const dashboardHref = libraryHref(library, id.startsWith("preview-vsl-") ? "pages" : undefined);
  const auth = realPreview && preview !== "1" ? await requireAdmin() : null;
  return <ImportEditor key={id} accountEmail={auth?.ok ? auth.user.email : undefined} recoverHref={recoverHref} navigationQuery={navigation.toString()} dashboardHref={dashboardHref} openLeads={openLeads} initialRange={initialRange} id={id} reportHref={reportHref} preview={preview === "1"} initialStepId={typeof etapa === "string" ? etapa : undefined}
    readOnly={id.startsWith("preview-vsl-") || id.startsWith("preview-funil-") || realPreview} />;
}
