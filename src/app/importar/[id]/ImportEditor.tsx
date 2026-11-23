'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { WorkspaceSelect } from '@/components/ui/WorkspaceSelect';
import type { InleadStep } from '@/lib/quiz/layers/types';
import { Check, Eye, FileArchive, TriangleAlert } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { WorkspaceLoading } from '@/components/workspace/WorkspaceLoading';
import { Brand, ThemeButton, WorkspaceFrame } from '@/components/workspace/WorkspaceFrame';
import LayersBuilder from '@/components/builder/LayersBuilder';
import LayersRunner from '@/components/quiz/layers/LayersRunner';
import TypebotBuilder from '@/components/builder/TypebotBuilder';
import ChatRunner from '@/components/quiz/typebot/ChatRunner';
import { LocalDraftContext } from '@/components/builder/fields';
import { loadImportDraft,saveImportDraft,type ImportDraft } from '@/lib/assistant/import-drafts';
import { restoreMissingVsl } from '@/lib/workspace-vsl-preview';
import type { Funnel } from '@/lib/quiz/types';
import { createImportedFunnel } from '@/app/dashboard/actions';

export default function ImportEditor({id,preview,readOnly,initialStepId,reportHref}:{id:string;preview:boolean;readOnly:boolean;initialStepId?:string;reportHref?:string}) {
  const router = useRouter();
  const [draft,setDraft]=useState<ImportDraft|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;loadImportDraft(id).then(value=>{if (mounted) {
      const slug = /^preview-vsl-([a-z0-9_-]+)$/.exec(id)?.[1];
      setDraft(value && slug ? { ...value, funnel: restoreMissingVsl(value.funnel, slug) } : value ?? null);
    }}).catch(()=>{if(mounted)setError('Não foi possível abrir a importação neste navegador.');}).finally(()=>{if(mounted)setLoaded(true);});return()=>{mounted=false;};},[id]);
  const save=async(funnel:Funnel)=>{if(!draft)return {ok:false,error:'Rascunho não encontrado.'};try{const next={...draft,funnel};await saveImportDraft(next);setDraft(next);return {ok:true};}catch{return {ok:false,error:'Não foi possível salvar neste navegador.'};}};
  const commit=async(funnel:Funnel)=>{const saved=await save(funnel);if(!saved.ok)return saved;const result=await createImportedFunnel(funnel);if(result.ok&&result.slug)window.location.href=`/builder/${encodeURIComponent(result.slug)}`;return result;};
  const [approving, setApproving] = useState(false);
  async function approve() {
    if (!draft || approving) return;
    setApproving(true);
    setError("");
    try {
      const next = { ...draft, reviewed: true };
      await saveImportDraft(next);
      setDraft(next);
    } catch {
      setError("Não foi possível guardar a revisão. Tente novamente.");
    } finally {
      setApproving(false);
    }
  }

  if (!loaded) return <WorkspaceLoading label="Abrindo importação" />;
  if (!draft) return <main className="ct-workspace ct-access">
    <ThemeButton />
    <section className="ct-access-form" aria-labelledby="missing-import-title">
      <Brand />
      <h1 id="missing-import-title" className="mt-4 text-xl font-semibold">Importação indisponível</h1>
      <p role="alert" className="mb-5 text-sm text-ct-dim">
        {error
          ? `${error} Recarregue a página para tentar novamente.`
          : "Importação não encontrada neste navegador. Abra o endereço no navegador em que criou o rascunho ou importe o arquivo novamente."}
      </p>
      <Link href="/ctfunil#anexar-referencia" className="ct-action-link">Anexar arquivo no assistente</Link>
    </section>
  </main>;
  if (!preview && draft.reviewed === false) return <WorkspaceFrame title="Revisão da importação">
    <header className="ct-page-heading"><div><h1>Revise a importação</h1><p>{draft.source}</p></div></header>
    <section className="ct-panel ct-import-review" aria-label="Checklist da importação">
      <ol>
        <li>
          <span className="ct-import-mark" data-done="true"><FileArchive size={17} aria-hidden="true" /></span>
          <div><h2>Arquivo convertido</h2><p>{draft.funnel.steps.length} {draft.funnel.steps.length === 1 ? "etapa preparada" : "etapas preparadas"} neste navegador.</p></div>
        </li>
        <li>
          <span className="ct-import-mark" data-done={!draft.warnings.length}>
            {draft.warnings.length ? <TriangleAlert size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
          </span>
          <div><h2>Conferir o resultado</h2>
            {draft.warnings.length > 0 ? <details className="ct-disclosure"><summary>{draft.warnings.length} {draft.warnings.length === 1 ? "ponto de revisão" : "pontos de revisão"}</summary>
              <ul>{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </details> : <p>A conversão não registrou avisos.</p>}
            <Link href={`/importar/${encodeURIComponent(id)}?preview=1`} className="ct-import-preview">
              <Eye size={16} aria-hidden="true" />Ver prévia
            </Link>
          </div>
        </li>
        <li>
          <span className="ct-import-mark" aria-hidden="true">3</span>
          <div><h2>Abrir para edição</h2><p>O rascunho fica salvo neste navegador.</p></div>
        </li>
      </ol>
      {error && <p role="alert" className="px-4 text-sm text-ct-dim">{error}</p>}
      <footer>
        <Link href="/ctfunil#assistente" className="text-sm text-ct-blue">Voltar ao assistente</Link>
        <StatefulButton type="button" className="ct-action-link" onClick={approve}
          state={approving ? "loading" : error ? "error" : "idle"}
          aria-label={approving ? "Abrindo…" : "Aprovar e abrir no construtor"}
          loadingText="Abrindo…" errorText="Aprovar e abrir no construtor">
          Aprovar e abrir no construtor
        </StatefulButton>
      </footer>
    </section>
  </WorkspaceFrame>;

  const path = `/importar/${encodeURIComponent(id)}`;
  const sourceSlug = /^preview-(?:vsl|funil)-([a-z0-9_-]+)$/.exec(id)?.[1];
  if (draft.funnel.settings?.engine === "typebot") {
    if (preview) return <MotionConfig reducedMotion="user">
      <Link href={path} className="block p-3 text-sm text-ct-blue underline">Voltar à edição</Link>
      <div className="h-[100dvh]">
        <ChatRunner funnel={draft.funnel} preview localOnly />
      </div>
    </MotionConfig>;
    return <LocalDraftContext.Provider value={true}><TypebotBuilder initial={draft.funnel} saveLocal={save} reportHref={reportHref} sourceSlug={sourceSlug} previewHref={path + "?preview=1"} /></LocalDraftContext.Provider>;
  }

  const steps = draft.funnel.steps as unknown as InleadStep[];
  const startIndex = Math.max(0, steps.findIndex(step => step.id === initialStepId));
  const startId = steps[startIndex]?.id;
  const previewHref = (stepId?: string) => `${path}?preview=1${stepId ? `&etapa=${encodeURIComponent(stepId)}` : ""}`;
  const editorHref = startId ? `${path}?etapa=${encodeURIComponent(startId)}` : path;
  const awaitingReview = draft.reviewed === false;

  return <>
    {preview && <div className="ct-workspace flex flex-wrap items-center gap-3 border-b border-ct-line px-4 py-2 text-xs">
      <Link className="text-ct-blue underline" href={editorHref}>{awaitingReview ? "Voltar à revisão" : "Voltar à edição"}</Link>
      {steps.length > 1 && <WorkspaceSelect searchable label="Etapa de início" value={startId ?? ""}
        onChange={stepId => router.replace(previewHref(stepId), { scroll: false })}
        options={steps.map((step, index) => ({ value: step.id, label: `${index + 1}. ${step.title || "Etapa"}` }))} />}
    </div>}
    {preview ? <MotionConfig reducedMotion="user">
      <LayersRunner key={startId} funnel={draft.funnel} startIndex={startIndex} preview
        simulateVideoTime={id.startsWith("preview-vsl-") || id.startsWith("preview-funil-")} />
    </MotionConfig>
      : <LayersBuilder initial={draft.funnel} initialStepId={startId}
          localDraft={{ save, commit: readOnly ? undefined : commit, previewHref: previewHref(), stagePreviewHref: previewHref, reportHref, sourceSlug, dashboardHref: id.startsWith("preview-vsl-") ? "/dashboard?tab=pages" : "/dashboard" }} />}
  </>;
}
