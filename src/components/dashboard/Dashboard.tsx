"use client";

import { normalizeSearchText } from "@/lib/text";
import RollingNumber from "@/components/ui/RollingNumber";
import { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import WorkspaceNotice from "@/components/ui/WorkspaceNotice";
import WorkspaceStatus from "@/components/ui/WorkspaceStatus";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import ActiveTab from "@/components/ui/ActiveTab";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { FolderKanban, Users, MousePointer2, CheckCheck, Eye, EyeOff } from "lucide-react";
import { libraryContext } from "@/lib/quiz/library-context";
import { parseCivilRange } from "@/lib/quiz/periodo";
import { useRouter, useSearchParams } from "next/navigation";
import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import type { DashboardMetrics } from "@/lib/quiz/metrics";
import CreateFunnelDialog from "./CreateFunnelDialog";
import SnapshotTimestamp from "./SnapshotTimestamp";
import { getPalette } from "@/lib/quiz/theme";
import { createFunnel, duplicateFunnel, deleteFunnel } from "@/app/dashboard/actions";
import WorkspaceSignOut from "@/components/workspace/WorkspaceSignOut";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import Pagination from "@/components/ui/Pagination";
import WorkspaceDateRange, { type DateRange } from "@/components/ui/WorkspaceDateRange";

const PER_PAGE = 12;
const updateDayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });

function updateDay(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : updateDayFormat.format(date);
}

const folders = ["Todos", "CDB", "SRC", "Resinas", "Páginas", "Quizzes"];

type ModuleTab = "quizzes" | "pages" | "spy";
type VslPage = { name: string; slug: string; tracked?: number };

function readTab(value: string | null): ModuleTab {
  return value === "pages" || value === "spy" ? value : "quizzes";
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  } catch {
    return "";
  }
}

export default function Dashboard({ funnels, metrics, preview = false, accountEmail, snapshotAt, pagesCapturedAt, pages = [] }: { funnels: FunnelSummary[]; metrics: DashboardMetrics; preview?: boolean; accountEmail?: string; snapshotAt?: string; pagesCapturedAt?: string; pages?: VslPage[] }) {
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
  const selectedFolder = searchParams.get("pasta");
  const folder = folders.find(value => value === selectedFolder) ?? "Todos";
  const updateFrom = searchParams.get("atualDe");
  const updateTo = searchParams.get("atualAte");
  const updateRange = useMemo(() => parseCivilRange(updateFrom, updateTo) ?? { from: "", to: "" }, [updateFrom, updateTo]);
  const libraryParams = libraryContext({
    biblioteca: tab, buscaFunil: q, buscaPagina: pageQuery, pasta: folder === "Todos" ? "" : folder,
    atualDe: updateRange.from, atualAte: updateRange.to,
  });
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
  const [menu, setMenu] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FunnelSummary | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
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

  const [page, setPage] = useState(1);

  const updateDates = useMemo(() => [...new Set(funnels.map(funnel => updateDay(funnel.updated_at)).filter(Boolean))].sort(), [funnels]);
  const hasDateFilter = Boolean(updateRange.from || updateRange.to);
  const filtered = useMemo(() => {
    const query = normalizeSearchText(q);
    const folderQuery = normalizeSearchText(folder);
    return funnels.filter((f) => {
      const hay = normalizeSearchText(`${f.name} ${f.slug} ${f.niche ?? ""} ${f.engine}`);
      const byQuery = hay.includes(query);
      const byFolder = folder === "Todos" || hay.includes(folderQuery);
      const day = hasDateFilter ? updateDay(f.updated_at) : "";
      const byDate = !hasDateFilter || (Boolean(day)
        && (!updateRange.from || day >= updateRange.from)
        && (!updateRange.to || day <= updateRange.to));
      return byQuery && byFolder && byDate;
    });
  }, [funnels, folder, q, hasDateFilter, updateRange]);
  const normalizedPageQuery = normalizeSearchText(pageQuery);
  const filteredPages = pages.filter(item => normalizeSearchText(`${item.name} ${item.slug}`).includes(normalizedPageQuery));
  const onPages = tab === "pages";
  const libraryCapturedAt = onPages ? pagesCapturedAt : snapshotAt;
  const count = onPages ? filteredPages.length : filtered.length;
  const hasFilters = onPages ? Boolean(pageQuery.trim()) : Boolean(q.trim()) || folder !== "Todos" || hasDateFilter;
  function clearFilters() {
    if (onPages) updateLibraryParams({ buscaPagina: "" });
    else {
      updateLibraryParams({ buscaFunil: "", pasta: "", atualDe: "", atualAte: "" });
      setPage(1);
    }
    librarySearch.current?.focus();
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  const doDuplicate = async (slug: string) => {
    if (busy) return;
    setMenu(null);
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
      <div onClick={() => setMenu(null)}>
        <header className="ct-page-heading"><div><h1>Meus funis</h1><p>{snapshotAt ? "Dados reais em modo de consulta" : "Criação e desempenho dos funis da CT4 Educação."}</p></div>
          {preview ? <div className="flex items-center gap-3">{snapshotAt && <WorkspaceSignOut className="text-sm text-ct-dim" />}<Link className="ct-action-link" href="/lab/construtor">Criar rascunho</Link></div> : <div className="flex items-center gap-3"><WorkspaceSignOut className="text-sm text-ct-dim" />
            <button className="ct-action-link" onClick={() => setCreating(true)}>Criar funil</button></div>}
        </header>
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
        <section className="ct-panel pb-3">
          <header className="ct-section-heading flex-wrap gap-3">
            <div><h2>Biblioteca</h2>{tab !== "spy" && <p role="status">{count} {onPages ? (count === 1 ? "página" : "páginas") : (count === 1 ? "funil" : "funis")}</p>}
              {tab !== "spy" && libraryCapturedAt && (
                <p>Dados capturados em <SnapshotTimestamp capturedAt={libraryCapturedAt} />.</p>
              )}
            </div>
            {tab !== "spy" && <label className="ct-search"><input
              ref={librarySearch}
              aria-label={onPages ? "Buscar página" : "Buscar funil"}
              placeholder={onPages ? "Buscar página" : "Buscar funil"}
              maxLength={160}
              value={onPages ? pageQuery : q}
              onChange={event => {
                updateLibraryParams({ [onPages ? "buscaPagina" : "buscaFunil"]: event.target.value });
                if (!onPages) setPage(1);
              }}
            /></label>}
          </header>
          <div className="ct-filters"><div className="ct-segments">{([["quizzes","Funis"],["pages","Páginas"],["spy","Referências"]] as const).map(([key,label]) =>
            <button key={key} aria-pressed={tab === key} onClick={()=>setTab(key)}>{tab === key && <ActiveTab group="dashboard-tabs" />}<span>{label}</span></button>)}</div>
            {tab === "quizzes" && <WorkspaceSelect searchable label="Filtrar por pasta" value={folder} onChange={value=>{updateLibraryParams({ pasta: value === "Todos" ? "" : value });setPage(1);}} options={folders.map(f=>({value:f,label:f}))}/>}</div>
          {tab === "quizzes" && updateDates.length > 1 && <div className="px-4 pb-1">
            <WorkspaceDateRange days={updateDates} value={updateRange} label="Atualização dos funis"
              onChange={range => { updateLibraryParams({ atualDe: range.from, atualAte: range.to }); setPage(1); }} />
          </div>}
          <div className="px-4">
              {tab === "quizzes" ? (
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {paged.map((f) => {
                    const pal = getPalette(f.palette_id);
                    return (
                      <article key={f.slug} className={`ct-dashboard-card relative min-w-0 overflow-visible rounded-xl bg-ct-raised p-4 ${menu === f.slug ? "z-30" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => router.push(snapshotAt || !preview ? `/builder/${encodeURIComponent(f.slug)}?${editorParams}` : "/lab/sonia?view=builder")} className="min-w-0 flex-1 text-left">
                            <span className="mb-3 block h-1.5 w-16 rounded-full" style={{ background: pal.primary }} />
                            <h3 className="truncate text-lg font-black">{f.name}</h3>
                            <p className="mt-1 text-xs text-ct-dim [overflow-wrap:anywhere]">/{f.slug} · {fmtDate(f.updated_at)}{f.niche ? ` · ${f.niche}` : ""}</p>
                          </button>
                          {!preview && <div className="relative">
                            <button type="button" aria-label={`Ações de ${f.name}`} aria-expanded={menu === f.slug} onClick={(e) => { e.stopPropagation(); menuTrigger.current = e.currentTarget; setMenu(menu === f.slug ? null : f.slug); }} className="rounded-xl px-2 py-1 text-xl text-ct-dim hover:bg-ct-raised">⋮</button>
                            {menu === f.slug ? (
                              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-2xl border border-ct-line bg-ct-surface py-1 text-sm shadow-2xl">
                                <button onClick={() => router.push(`/builder/${encodeURIComponent(f.slug)}?${editorParams}`)} className="block w-full px-3 py-2 text-left hover:bg-ct-raised">Editar</button>
                                <button onClick={() => router.push(`/dashboard/${encodeURIComponent(f.slug)}?${libraryParams}`)} className="block w-full px-3 py-2 text-left hover:bg-ct-raised">Performance</button>
                                <a href={`/api/export-leads?slug=${encodeURIComponent(f.slug)}`} className="block px-3 py-2 hover:bg-ct-raised">Exportar leads</a>
                                <a href={f.domain ? `https://${f.domain}/${f.slug}` : `/${f.slug}`} target="_blank" rel="noreferrer" className="block px-3 py-2 hover:bg-ct-raised">Visualizar</a>
                                <button disabled={busy} onClick={() => doDuplicate(f.slug)} className="block w-full px-3 py-2 text-left hover:bg-ct-raised">Duplicar</button>
                                <button disabled={busy} onClick={() => { setMenu(null); setPendingDelete(f); }} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50">Excluir</button>
                              </div>
                            ) : null}
                          </div>}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <WorkspaceStatus status={f.status} />
                          <span className="rounded-full bg-ct-raised px-2.5 py-1 text-[11px] font-bold uppercase text-ct-dim">{f.engine}</span>
                          {(snapshotAt || !preview) && <>
                            <Link href={`/builder/${encodeURIComponent(f.slug)}?${editorParams}`} className="text-sm font-semibold text-ct-blue underline">Abrir editor</Link>
                            <Link href={`/dashboard/${encodeURIComponent(f.slug)}?${libraryParams}`} className="text-sm text-ct-blue underline">Ver relatório</Link>
                          </>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

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
                  <p>{hasFilters
                    ? (onPages ? "Nenhuma página corresponde à busca." : "Nenhum funil corresponde aos filtros.")
                    : (onPages ? "Nenhuma página VSL disponível para consulta." : "Nenhum funil disponível.")}</p>
                  {hasFilters && <button type="button" className="mt-2 min-h-11 text-ct-blue underline" onClick={clearFilters}>Limpar filtros</button>}
                </div>
              )}
              {tab === "quizzes" && totalPages > 1 ? <div className="mt-5"><Pagination current={curPage} total={totalPages} onChange={setPage} /></div> : null}
            </div>
        </section>
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
