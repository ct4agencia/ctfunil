"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DropdownMenu, Popover, Tooltip } from "radix-ui";
import { ArrowUpDown, Check, ChevronDown, Plus, Search } from "lucide-react";
import { normalizeSearchText } from "@/lib/text";
import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import { funnelPublicUrl } from "@/lib/quiz/public-url";
import WorkspaceCheckbox from "@/components/ui/WorkspaceCheckbox";
import FunnelCard, { type FunnelStats } from "./FunnelCard";
import { useFunnelCategories } from "./categories";
import "./funis.css";

/**
 * Aba Funis de Meus funis no formato da Inlead (pedido do Luca, 28/11):
 * abas por situação, filtro de categorias, busca, ordenação, grade de
 * cartões e "Ver mais".
 */

const PAGE_SIZE = 12;
const WITHOUT_CATEGORY = "sem";

const STATUS_TABS = [
  { key: "todos", label: "Todos" },
  { key: "publicados", label: "Publicados" },
  { key: "rascunhos", label: "Rascunhos" },
] as const;
type StatusTab = (typeof STATUS_TABS)[number]["key"];

const SORTS = [
  { key: "recentes", label: "Mais recentes" },
  { key: "antigos", label: "Mais antigos" },
  { key: "nome", label: "Nome (A–Z)" },
  { key: "visitas", label: "Mais visitas" },
  { key: "leads", label: "Mais leads" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function isPublished(funnel: FunnelSummary) {
  return funnel.status === "published" || funnel.status === "Publicado";
}

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function FunnelLibrary({
  funnels, stats, statsMissing, statsSource, hideValues, readOnly, busy, editorHref, reportHref, onDuplicate, onDelete, notify,
}: {
  funnels: FunnelSummary[];
  stats: Record<string, FunnelStats>;
  statsMissing: string;
  statsSource?: string;
  hideValues: boolean;
  readOnly: boolean;
  busy: boolean;
  editorHref: (slug: string) => string;
  reportHref: (slug: string) => string;
  onDuplicate: (slug: string) => void;
  onDelete: (funnel: FunnelSummary, trigger: HTMLElement | null) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.get("buscaFunil")?.slice(0, 160) ?? "";
  const statusParam = searchParams.get("situacao");
  const status: StatusTab = STATUS_TABS.some(tab => tab.key === statusParam) ? statusParam as StatusTab : "todos";
  const sortParam = searchParams.get("ordem");
  const sort: SortKey = SORTS.some(item => item.key === sortParam) ? sortParam as SortKey : "recentes";
  const categoryParam = searchParams.get("categorias") ?? "";
  const { categories, links, create, toggle, rename, remove } = useFunnelCategories();
  const selectedCategories = useMemo(() => {
    const known = new Set([...categories.map(category => category.id), WITHOUT_CATEGORY]);
    return categoryParam.split(",").filter(id => known.has(id));
  }, [categoryParam, categories]);

  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setPortalHost(node.closest<HTMLElement>(".ct-workspace"));
  }, []);
  const searchInput = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function updateParams(values: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }

  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const funnel of funnels) for (const id of links[funnel.slug] ?? []) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [funnels, links]);

  const statusCounts = useMemo(() => {
    const published = funnels.filter(isPublished).length;
    return { todos: funnels.length, publicados: published, rascunhos: funnels.length - published };
  }, [funnels]);

  const filtered = useMemo(() => {
    const needle = normalizeSearchText(query);
    const wanted = new Set(selectedCategories);
    const list = funnels.filter(funnel => {
      if (status === "publicados" && !isPublished(funnel)) return false;
      if (status === "rascunhos" && isPublished(funnel)) return false;
      if (needle) {
        const names = (links[funnel.slug] ?? []).map(id => categoryById.get(id)?.name ?? "").join(" ");
        const hay = normalizeSearchText(`${funnel.name} ${funnel.slug} ${funnel.niche ?? ""} ${funnel.domain ?? ""} ${names}`);
        if (!hay.includes(needle)) return false;
      }
      if (wanted.size) {
        const own = links[funnel.slug] ?? [];
        const match = own.some(id => wanted.has(id)) || (wanted.has(WITHOUT_CATEGORY) && own.length === 0);
        if (!match) return false;
      }
      return true;
    });
    const byName = (a: FunnelSummary, b: FunnelSummary) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    const metric = (funnel: FunnelSummary, key: "visitas" | "leads") => stats[funnel.slug]?.[key] ?? -1;
    return list.sort((a, b) => {
      switch (sort) {
        case "antigos": return time(a.updated_at) - time(b.updated_at);
        case "nome": return byName(a, b);
        case "visitas": return metric(b, "visitas") - metric(a, "visitas") || byName(a, b);
        case "leads": return metric(b, "leads") - metric(a, "leads") || byName(a, b);
        default: return time(b.updated_at) - time(a.updated_at);
      }
    });
  }, [funnels, query, status, selectedCategories, links, categoryById, sort, stats]);

  const filterKey = `${query}|${status}|${sort}|${selectedCategories.join(",")}`;
  const [visible, setVisible] = useState({ key: filterKey, count: PAGE_SIZE });
  const visibleCount = visible.key === filterKey ? visible.count : PAGE_SIZE;
  const shown = filtered.slice(0, visibleCount);
  const focusIndex = useRef<number | null>(null);
  useEffect(() => {
    if (focusIndex.current === null) return;
    const index = focusIndex.current;
    focusIndex.current = null;
    document.querySelector<HTMLElement>(`[data-ctf-card-index="${index}"] .ctf-card-name a`)?.focus();
  }, [visibleCount]);

  const hasFilters = Boolean(query.trim()) || status !== "todos" || selectedCategories.length > 0;
  function clearFilters() {
    updateParams({ buscaFunil: "", situacao: "", categorias: "" });
    searchInput.current?.focus();
  }

  async function share(funnel: FunnelSummary) {
    const url = funnelPublicUrl(funnel);
    const draftWarning = isPublished(funnel) ? "" : " · Atenção: é um rascunho e ainda não abre para o público.";
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: funnel.name, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(`Link copiado: ${url}${draftWarning}`);
    } catch {
      notify(`Não foi possível copiar. Endereço: ${url}`, true);
    }
  }

  const sortLabel = SORTS.find(item => item.key === sort)?.label ?? "Mais recentes";
  const categoryButtonLabel = selectedCategories.length ? `Categorias (${selectedCategories.length})` : "Categorias";

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <div ref={rootRef} className="ctf-library">
        <div className="ctf-tabs-row">
          <nav className="ctf-tabs" aria-label="Situação dos funis">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} type="button" className="ctf-tab" aria-pressed={status === tab.key}
                aria-label={`${tab.label} (${statusCounts[tab.key]})`}
                onClick={() => updateParams({ situacao: tab.key === "todos" ? "" : tab.key })}>
                {tab.label}
              </button>
            ))}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button type="button" className="ctf-tab" aria-disabled="true" aria-pressed={false}
                  onClick={event => event.preventDefault()}>
                  Compartilhados comigo
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal container={portalHost ?? undefined}>
                <Tooltip.Content className="ctf-tip" side="bottom" sideOffset={6} collisionPadding={8}>
                  <strong>Indisponível</strong>
                  <span>O CTFunil tem uma conta só; ninguém compartilha funis com você.</span>
                  <Tooltip.Arrow className="ctf-tip-arrow" width={10} height={5} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </nav>
          <p className="ctf-total" role="status">{filtered.length} {filtered.length === 1 ? "funil" : "funis"}</p>
        </div>

        <div className="ctf-toolbar">
          <Popover.Root>
            <Popover.Trigger className="ctf-control" data-active={selectedCategories.length > 0 || undefined}>
              <ChevronDown size={15} aria-hidden="true" />{categoryButtonLabel}
            </Popover.Trigger>
            <Popover.Portal container={portalHost ?? undefined}>
              <Popover.Content className="ctf-popover" align="start" sideOffset={6} collisionPadding={12}>
                <div className="ctf-cat" role="group" aria-label="Filtrar por categoria">
                  <p className="ctf-cat-title">Filtrar por categoria</p>
                  <ul className="ctf-cat-list">
                    {categories.map(category => (
                      <li key={category.id} className="ctf-cat-row">
                        <label className="ctf-cat-option">
                          <WorkspaceCheckbox checked={selectedCategories.includes(category.id)}
                            onChange={() => {
                              const next = selectedCategories.includes(category.id)
                                ? selectedCategories.filter(id => id !== category.id)
                                : [...selectedCategories, category.id];
                              updateParams({ categorias: next.join(",") });
                            }} />
                          <span className="ctf-chip">{category.name}</span>
                          <span className="ctf-cat-count">{counts.get(category.id) ?? 0}<span className="sr-only"> funis</span></span>
                        </label>
                      </li>
                    ))}
                    <li className="ctf-cat-row">
                      <label className="ctf-cat-option">
                        <WorkspaceCheckbox checked={selectedCategories.includes(WITHOUT_CATEGORY)}
                          onChange={() => {
                            const next = selectedCategories.includes(WITHOUT_CATEGORY)
                              ? selectedCategories.filter(id => id !== WITHOUT_CATEGORY)
                              : [...selectedCategories, WITHOUT_CATEGORY];
                            updateParams({ categorias: next.join(",") });
                          }} />
                        <span className="ctf-cat-plain">Sem categoria</span>
                        <span className="ctf-cat-count">{funnels.filter(funnel => !(links[funnel.slug]?.length)).length}<span className="sr-only"> funis</span></span>
                      </label>
                    </li>
                  </ul>
                  {!categories.length && <p className="ctf-cat-empty">Crie categorias pelo menu ⋮ de um funil ou pela etiqueta “+ Categoria”.</p>}
                  {selectedCategories.length > 0 && (
                    <button type="button" className="ctf-cat-create" onClick={() => updateParams({ categorias: "" })}>Limpar filtro</button>
                  )}
                  <p className="ctf-cat-note">Categorias salvas só neste navegador.</p>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="ctf-toolbar-end">
            <label className="ctf-search">
              <input
                ref={searchInput}
                type="search"
                value={query}
                maxLength={160}
                placeholder="Buscar funil"
                aria-label="Buscar funil"
                onChange={event => updateParams({ buscaFunil: event.target.value })}
              />
              <Search size={16} aria-hidden="true" />
            </label>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="ctf-control" aria-label={`Ordenar: ${sortLabel}`}>
                <ArrowUpDown size={15} aria-hidden="true" /><span>{sortLabel}</span><ChevronDown size={15} aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal container={portalHost ?? undefined}>
                <DropdownMenu.Content className="ctf-menu" align="end" sideOffset={6} collisionPadding={12}>
                  <DropdownMenu.RadioGroup value={sort} onValueChange={value => updateParams({ ordem: value === "recentes" ? "" : value })}>
                    {SORTS.map(item => (
                      <DropdownMenu.RadioItem key={item.key} value={item.key} className="ctf-menu-item">
                        <span className="ctf-menu-check"><DropdownMenu.ItemIndicator><Check size={15} aria-hidden="true" /></DropdownMenu.ItemIndicator></span>
                        {item.label}
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {statsSource && <p className="ctf-source">{statsSource}</p>}

        {shown.length > 0 && (
          <div className="ctf-grid-wrap">
            <div className="ctf-grid">
              {shown.map((funnel, index) => (
                <FunnelCard
                  key={funnel.slug}
                  funnel={funnel}
                  index={index}
                  stats={stats[funnel.slug]}
                  statsMissing={statsMissing}
                  hideValues={hideValues}
                  now={now}
                  readOnly={readOnly}
                  busy={busy}
                  editorHref={editorHref(funnel.slug)}
                  reportHref={reportHref(funnel.slug)}
                  categories={categories}
                  assigned={(links[funnel.slug] ?? []).flatMap(id => categoryById.get(id) ?? [])}
                  counts={counts}
                  portalHost={portalHost}
                  onToggleCategory={id => toggle(funnel.slug, id)}
                  onCreateCategory={name => create(name, funnel.slug)}
                  onRenameCategory={rename}
                  onRemoveCategory={remove}
                  onDuplicate={() => onDuplicate(funnel.slug)}
                  onDelete={trigger => onDelete(funnel, trigger)}
                  onShare={() => { void share(funnel); }}
                />
              ))}
            </div>
          </div>
        )}

        {!filtered.length && (
          <div className="ctf-empty">
            <p>{hasFilters ? "Nenhum funil corresponde aos filtros." : "Nenhum funil disponível."}</p>
            {hasFilters && <button type="button" onClick={clearFilters}>Limpar filtros</button>}
          </div>
        )}

        {filtered.length > shown.length && (
          <div className="ctf-more">
            <button type="button" onClick={() => {
              focusIndex.current = shown.length;
              setVisible({ key: filterKey, count: visibleCount + PAGE_SIZE });
            }}>
              <Plus size={16} aria-hidden="true" />Ver mais
              <span className="sr-only"> ({Math.min(PAGE_SIZE, filtered.length - shown.length)} de {filtered.length - shown.length} restantes)</span>
            </button>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
