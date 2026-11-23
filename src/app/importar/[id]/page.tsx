import { headers } from 'next/headers';
import { isRealDataPreview } from '@/lib/workspace-preview';
import { getPublicVslUrl } from '@/lib/workspace-real-data';
import { hasPreviewFunnelDraft } from '@/lib/workspace-preview-vsl-drafts';
import ImportEditor from './ImportEditor';
export const metadata={title:'Importação | CTFunil',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{preview?:string;etapa?:string}>}) {
  const { id } = await params;
  const { preview, etapa } = await searchParams;
  const realPreview = isRealDataPreview((await headers()).get("host"));
  const originalVideoUrl = realPreview && id.startsWith("preview-vsl-")
    ? getPublicVslUrl(id.slice("preview-vsl-".length))
    : undefined;
  const draftSlug = /^preview-(?:vsl|funil)-([a-z0-9_-]+)$/.exec(id)?.[1];
  const reportHref = realPreview && draftSlug && hasPreviewFunnelDraft(draftSlug)
    ? `/dashboard/${encodeURIComponent(draftSlug)}`
    : undefined;
  return <ImportEditor key={id} id={id} reportHref={reportHref} originalVideoUrl={originalVideoUrl} preview={preview === "1"} initialStepId={typeof etapa === "string" ? etapa : undefined}
    readOnly={id.startsWith("preview-vsl-") || id.startsWith("preview-funil-") || realPreview} />;
}
