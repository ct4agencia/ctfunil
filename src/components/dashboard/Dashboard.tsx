"use client";

import { normalizeSearchText } from "@/lib/text";
import RollingNumber from "@/components/ui/RollingNumber";
import { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import WorkspaceNotice from "@/components/ui/WorkspaceNotice";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import ActiveTab from "@/components/ui/ActiveTab";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { FolderKanban, Users, MousePointer2, CheckCheck, Eye, EyeOff } from "lucide-react";
import { libraryContext } from "@/lib/quiz/library-context";
import { useRouter, useSearchParams } from "next/navigation";
import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import type { DashboardMetrics } from "@/lib/quiz/metrics";
import CreateFunnelDialog from "./CreateFunnelDialog";
import SnapshotTimestamp from "./SnapshotTimestamp";
import { createFunnel, duplicateFunnel, deleteFunnel } from "@/app/dashboard/actions";
import WorkspaceSignOut from "@/components/workspace/WorkspaceSignOut";
import FunnelLibrary from "./funis/FunnelLibrary";
import type { FunnelStats } from "./funis/FunnelCard";
import { Plus } from "lucide-react";

type ModuleTab = "quizzes" | "pages" | "spy";
type VslPage = { name: string; slug: string; tracked?: number };

function readTab(value: string | null): ModuleTab {
  return value === "pages" || value === "spy" ? value : "quizzes";
}

export default function Dashboard({ funnels, metrics, preview = false, accountEmail, snapshotAt, pagesCapturedAt, pages = [], stats = {}, statsSource, statsMissing = "Sem dados deste funil." }: { funnels: FunnelSummary[]; metrics: DashboardMetrics; preview?: boolean; accountEmail?: string; snapshotAt?: string; pagesCapturedAt?: string; pages?: VslPage[]; stats?: Record<string, FunnelStats>; statsSource?: string; statsMissing?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = readTab(searchParams.get("tab"));
  function setTab(next: ModuleTab) {
    if (next === tab) return;
    const url = new URL(window.location.href);
    if (next === "quizzes") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }
  const [hideMetrics, setHideMetrics] = useState(false);
  const q = searchParams.get("buscaFunil")?.slice(0, 160) ?? "";
  const pageQuery = searchParams.get("buscaPagina")?.slice(0, 160) ?? "";
  const libraryParams = libraryContext({ biblioteca: tab, buscaFunil: q, buscaPagina: pageQuery });
  const editorParams = new URLSearchParams(libraryParams);
  editorParams.set("editar", "1");
  function updateLibraryParams(values: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FunnelSummary | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const librarySearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = confirmation.current;
    if (!dialog) return;
    if (pendingDelete && !dialog.open) dialog.showModal();
    if (!pendingDelete && dialog.open) dialog.close();
  }, [pendingDelete]);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  function notify(message: string, error = false) {
    recordWorkspaceNotice("Meus funis", message, error);
    setNotice({ message, error });
  }

  const normalizedPageQuery = normalizeSearchText(pageQuery);
  const filteredPages = pages.filter(item => normalizeSearchText(`${item.name} ${item.slug}`).includes(normalizedPageQuery));
  const count = filteredPages.length;
  const hasFilters = Boolean(pageQuery.trim());
  function clearFilters() {
    updateLibraryParams({ buscaPagina: "" });
    librarySearch.current?.focus();
  }
  // Consulta (preview) e demonstração não gravam: duplicar e excluir ficam desligados.
  const readOnly = preview;
  const editorHref = (slug: string) => snapshotAt || !preview ? `/builder/${encodeURIComponent(slug)}?${editorParams}` : "/lab/sonia?view=builder";
  const reportHref = (slug: string) => `/dashboard/${encodeURIComponent(slug)}?${libraryParams}`;
  const librarySwitch = <div className="ct-segments">{([["quizzes","Funis"],["pages","Páginas"],["spy","Referências"]] as const).map(([key,label]) =>
    <button key={key} aria-pressed={tab === key} onClick={()=>setTab(key)}>{tab === key && <ActiveTab group="dashboard-tabs" />}<span>{label}</span></button>)}</div>;

  const doDuplicate = async (slug: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await duplicateFunnel(slug);
      if (result.ok && result.slug) router.push(`/builder/${result.slug}`);
      else if (result.ok) router.refresh();
      else notify(result.error ?? "Não foi possível duplicar o funil.", true);
    } catch {
      notify("Não foi possível duplicar o funil.", true);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      const result = await deleteFunnel(pendingDelete.slug);
      if (result.ok) {
        setPendingDelete(null);
        notify("Funil excluído.");
        router.refresh();
      } else {
        setPendingDelete(null);
        notify(result.error ?? "Não foi possível excluir o funil.", true);
      }
    } catch {
      setPendingDelete(null);
      notify("Não foi possível excluir o funil.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkspaceFrame title="Meus funis" activeTab={tab} accountEmail={accountEmail} demo={preview && !snapshotAt}>
      <div>
        {tab === "quizzes" ? (
          <header className="ctf-heading">
            <div className="ctf-heading-title">
              <h1>Funis</h1>
              <span className="ctf-count-badge">{funnels.length} {funnels.length === 1 ? "funil" : "funis"}</span>
              {snapshotAt && <p>Dados reais em modo de consulta: nada é gravado.</p>}
            </div>
            <div className="ctf-heading-actions">
              {(snapshotAt || !preview) && <WorkspaceSignOut className="text-sm text-ct-dim" />}
              {preview
                ? <Link className="ctf-create" href="/lab/construtor" title="No modo consulta, abre um rascunho local que não é gravado no banco."><Plus size={16} aria-hidden="true" />Criar funil</Link>
                : <button type="button" className="ctf-create" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />Criar funil</button>}
            </div>
          </header>
        ) : (
          <header className="ct-page-heading"><div><h1>Meus funis</h1><p>{snapshotAt ? "Dados reais em modo de consulta" : "Criação e desempenho dos funis da CT4 Educação."}</p></div>
            {preview ? <div className="flex items-center gap-3">{snapshotAt && <WorkspaceSignOut className="text-sm text-ct-dim" />}<Link className="ct-action-link" href="/lab/construtor">Criar rascunho</Link></div> : <div className="flex items-center gap-3"><WorkspaceSignOut className="text-sm text-ct-dim" />
              <button className="ct-action-link" onClick={() => setCreating(true)}>Criar funil</button></div>}
          </header>
        )}
        <section aria-labelledby="dashboard-metrics-heading">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="dashboard-metrics-heading" className="text-sm font-semibold">Indicadores gerais</h2>
              {snapshotAt && <p className="text-xs text-ct-dim">Dados capturados em <SnapshotTimestamp capturedAt={snapshotAt} />.</p>}
            </div>
            <button type="button" aria-pressed={hideMetrics} aria-controls="dashboard-metric-values"
              className="inline-flex items-center gap-2 rounded-lg border border-ct-line px-3 py-2 text-xs text-ct-dim hover:bg-ct-raised"
              onClick={() => setHideMetrics(hidden => !hidden)}>
              {hideMetrics ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              Ocultar valores
            </button>
          </div>
          <div id="dashboard-metric-values" className="ct-metrics">
            {([{ label: "Funis", value: metrics.totalFunis, icon: FolderKanban }, { label: "Sessões", value: metrics.totalSessoes, icon: MousePointer2 },
              { label: "Leads", value: metrics.totalLeads, icon: Users }, { label: "Conclusões", value: metrics.totalConclusoes, icon: CheckCheck }]).map(({ label, value, icon: Icon }) => (
              <div className="ct-metric" key={label}>
                <div><span>{label}</span><Icon size={17} aria-hidden="true" /></div>
                <strong><RollingNumber value={value} hidden={hideMetrics} /></strong>
              </div>
            ))}
          </div>
        </section>
        {tab === "quizzes" ? (
          <section className="ct-panel" aria-label="Biblioteca de funis">
            <div className="ct-filters pt-5">{librarySwitch}</div>
            <FunnelLibrary
              funnels={funnels}
              stats={stats}
              statsMissing={statsMissing}
              statsSource={statsSource}
              hideValues={hideMetrics}
              readOnly={readOnly}
              busy={busy}
              editorHref={editorHref}
              reportHref={reportHref}
              onDuplicate={slug => { void doDuplicate(slug); }}
              onDelete={(funnel, trigger) => { menuTrigger.current = trigger; setPendingDelete(funnel); }}
              notify={notify}
            />
          </section>
        ) : (
        <section className="ct-panel pb-3">
          <header className="ct-section-heading flex-wrap gap-3">
            <div><h2>Biblioteca</h2>{tab !== "spy" && <p role="status">{count} {count === 1 ? "página" : "páginas"}</p>}
              {tab !== "spy" && pagesCapturedAt && (
                <p>Dados capturados em <SnapshotTimestamp capturedAt={pagesCapturedAt} />.</p>
              )}
            </div>
            {tab !== "spy" && <label className="ct-search"><input
              ref={librarySearch}
              aria-label="Buscar página"
              placeholder="Buscar página"
              maxLength={160}
              value={pageQuery}
              onChange={event => updateLibraryParams({ buscaPagina: event.target.value })}
            /></label>}
          </header>
          <div className="ct-filters">{librarySwitch}</div>
          <div className="px-4">
              {tab === "pages" && (
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                  {filteredPages.map(item => (
                    <article key={item.slug} className="ct-dashboard-card min-w-0 rounded-xl border border-ct-line bg-ct-surface p-4 [overflow-wrap:anywhere]">
                      <p className="text-xs font-medium text-ct-dim">Página VSL · /{item.slug}</p>
                      <h3 className="mt-2 text-lg font-semibold">
                        <Link href={`/builder/${encodeURIComponent(item.slug)}?${editorParams}`}>{item.name}</Link>
                      </h3>
                      <p className="mt-1 text-sm text-ct-dim">{item.tracked === undefined ? "Rastreamento de vídeo fora da captura" : `${item.tracked.toLocaleString("pt-BR")} sessões com rastreamento de vídeo`}</p>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <Link href={`/builder/${encodeURIComponent(item.slug)}?${editorParams}`} className="text-sm font-semibold text-ct-blue underline">Abrir editor</Link>
                        <Link href={`/dashboard/${encodeURIComponent(item.slug)}?${libraryParams}`} className="text-sm text-ct-blue underline">Ver relatório</Link>
                      </div>
                    </article>
                  ))}

                </div>
              )}

              {tab === "spy" && (
                <article className="ct-dashboard-card mt-4 rounded-xl border border-ct-line bg-ct-surface p-4">
                  <h3 className="text-lg font-semibold">Importar referência</h3>
                  <p className="mt-2 text-sm text-ct-dim">Anexe um arquivo HTML ou ZIP no assistente para revisar a estrutura e criar um rascunho editável.</p>
                  <Link href="/ctfunil/assistente#anexar-referencia" className="mt-3 inline-block text-sm text-ct-blue">Anexar referência no assistente</Link>
                </article>
              )}

              {tab !== "spy" && count === 0 && (
                <div className="ct-empty mt-4 rounded-xl border border-dashed border-ct-line">
                  <p>{hasFilters ? "Nenhuma página corresponde à busca." : "Nenhuma página VSL disponível para consulta."}</p>
                  {hasFilters && <button type="button" className="mt-2 min-h-11 text-ct-blue underline" onClick={clearFilters}>Limpar filtros</button>}
                </div>
              )}
            </div>
        </section>
        )}
        <Link className="inline-flex items-center gap-2 text-sm text-ct-blue" href="https://viverdebolsas.com.br/calculadora-lucrativa" target="_blank" rel="noreferrer">Calculadora de Lucro ↗</Link>
        {!preview && <button className="ml-5 text-sm text-ct-blue" onClick={()=>setCreating(true)}>Criar um novo funil</button>}
      </div>

      {creating && <CreateFunnelDialog onClose={() => setCreating(false)} onCreate={async input => {
        const result = await createFunnel(input);
        if (result.ok && result.slug) router.push('/builder/' + result.slug);
        return result;
      }}/>}
      {notice && <WorkspaceNotice {...notice} onDismiss={() => setNotice(null)} />}
      <dialog ref={confirmation} className="ct-confirm ct-delete-modal-confirmation" aria-labelledby="ct-delete-title" aria-describedby="ct-delete-summary"
        onCancel={event => { event.preventDefault(); if (!busy) setPendingDelete(null); }}
        onClose={() => { if (!confirmation.current?.open && menuTrigger.current?.isConnected) menuTrigger.current.focus(); }}>
        <div className="flex items-center gap-2">
          <DeleteConfirmationIcon />
          <h2 id="ct-delete-title" className="font-semibold">Excluir funil?</h2>
        </div>
        <p id="ct-delete-summary" className="mt-2 text-sm text-ct-dim">O funil {pendingDelete?.name} será excluído. Essa ação é permanente.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} className="ct-confirm-cancel" onClick={() => setPendingDelete(null)} autoFocus>Cancelar</button>
          <button type="button" disabled={busy} className="ct-confirm-delete" onClick={doDelete}>{busy ? "Excluindo…" : "Excluir funil"}</button>
        </div>
      </dialog>
    </WorkspaceFrame>
  );
}
