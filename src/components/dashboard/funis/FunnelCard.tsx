"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { DropdownMenu, Popover, Tooltip } from "radix-ui";
import { ChartColumn, ClipboardCheck, Copy, Download, EllipsisVertical, Eye, MousePointerClick, Plus, Share, SquarePen, Tag, Trash2, Users } from "lucide-react";
import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import { funnelPublicLabel, funnelPublicUrl } from "@/lib/quiz/public-url";
import CategoryPicker from "./CategoryPicker";
import type { Category } from "./categories";
import { compactNumber, editedAgo, exactNumber, fullDateLabel, funnelInitials } from "./format";

export type FunnelStats = { visitas: number; interacoes: number; leads: number; conclusoes: number };

const METRICS = [
  { key: "visitas", label: "Visitas", detail: "Sessões que abriram o funil", icon: Eye },
  { key: "interacoes", label: "Interações", detail: "Chegaram à primeira pergunta", icon: MousePointerClick },
  { key: "leads", label: "Leads", detail: "Contatos capturados", icon: Users },
  { key: "conclusoes", label: "Conclusões", detail: "Chegaram à última etapa", icon: ClipboardCheck },
] as const;

function Hint({ content, container, children }: { content: ReactNode; container: HTMLElement | null; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal container={container ?? undefined}>
        <Tooltip.Content className="ctf-tip" side="top" sideOffset={6} collisionPadding={8}>
          {content}
          <Tooltip.Arrow className="ctf-tip-arrow" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function FunnelCard({
  funnel, index, stats, statsMissing, hideValues, now, readOnly, busy, editorHref, reportHref,
  categories, assigned, counts, portalHost, onToggleCategory, onCreateCategory, onRenameCategory, onRemoveCategory,
  onDuplicate, onDelete, onShare,
}: {
  funnel: FunnelSummary;
  index: number;
  stats?: FunnelStats;
  statsMissing: string;
  hideValues: boolean;
  now: number;
  readOnly: boolean;
  busy: boolean;
  editorHref: string;
  reportHref: string;
  categories: Category[];
  assigned: Category[];
  counts: Map<string, number>;
  portalHost: HTMLElement | null;
  onToggleCategory: (id: string) => void;
  onCreateCategory: (name: string) => Category | null;
  onRenameCategory: (id: string, name: string) => boolean;
  onRemoveCategory: (id: string) => void;
  onDuplicate: () => void;
  onDelete: (trigger: HTMLElement | null) => void;
  onShare: () => void;
}) {
  const titleId = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const categoryAnchor = useRef<HTMLElement | null>(null);
  const pendingCategories = useRef(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [fromMenu, setFromMenu] = useState(false);
  const published = funnel.status === "published" || funnel.status === "Publicado";
  const publicUrl = funnelPublicUrl(funnel);
  const assignedIds = new Set(assigned.map(category => category.id));
  const shownCategories = assigned.slice(0, 2);
  const extraCategories = assigned.length - shownCategories.length;

  function openCategories(anchor: HTMLElement | null) {
    categoryAnchor.current = anchor;
    setFromMenu(anchor === menuTrigger.current);
    setCategoriesOpen(true);
  }

  return (
    <article className="ctf-card" aria-labelledby={titleId} data-ctf-card-index={index}>
      <div className="ctf-card-top">
        <span className="ctf-avatar" aria-hidden="true">{funnelInitials(funnel.name)}</span>
        <div className="ctf-card-id">
          <h3 id={titleId} className="ctf-card-name">
            <Link href={editorHref} title={funnel.name}>{funnel.name}</Link>
          </h3>
          {published
            ? <a className="ctf-card-url" href={publicUrl} target="_blank" rel="noreferrer" title={`Abrir ${publicUrl} em outra aba`}>{publicUrl}</a>
            : <span className="ctf-card-url" title="Rascunho: ainda não está no ar">{funnelPublicLabel(funnel)}</span>}
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger ref={menuTrigger} className="ctf-icon-button" aria-label={`Ações de ${funnel.name}`}>
            <EllipsisVertical size={17} aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={portalHost ?? undefined}>
            <DropdownMenu.Content
              className="ctf-menu"
              align="end"
              sideOffset={6}
              collisionPadding={12}
              onCloseAutoFocus={event => {
                if (!pendingCategories.current) return;
                event.preventDefault();
                pendingCategories.current = false;
                openCategories(menuTrigger.current);
              }}
            >
              <DropdownMenu.Item className="ctf-menu-item" asChild>
                <Link href={editorHref}><SquarePen size={16} aria-hidden="true" />Editar</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="ctf-menu-item" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer"><Eye size={16} aria-hidden="true" />Visualizar</a>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="ctf-menu-item" asChild>
                <Link href={reportHref}><ChartColumn size={16} aria-hidden="true" />Relatório</Link>
              </DropdownMenu.Item>
              {readOnly
                ? <DropdownMenu.Item className="ctf-menu-item" disabled><Download size={16} aria-hidden="true" />Exportar leads</DropdownMenu.Item>
                : <DropdownMenu.Item className="ctf-menu-item" asChild>
                  <a href={`/api/export-leads?slug=${encodeURIComponent(funnel.slug)}`}><Download size={16} aria-hidden="true" />Exportar leads</a>
                </DropdownMenu.Item>}
              <DropdownMenu.Item className="ctf-menu-item" disabled={readOnly || busy} onSelect={onDuplicate}>
                <Copy size={16} aria-hidden="true" />Duplicar
              </DropdownMenu.Item>
              <DropdownMenu.Item className="ctf-menu-item" onSelect={() => { pendingCategories.current = true; }}>
                <Tag size={16} aria-hidden="true" />Categorias
              </DropdownMenu.Item>
              <DropdownMenu.Item className="ctf-menu-item" onSelect={onShare}>
                <Share size={16} aria-hidden="true" />Compartilhar
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="ctf-menu-separator" />
              <DropdownMenu.Item className="ctf-menu-item" data-danger="" disabled={readOnly || busy} onSelect={() => onDelete(menuTrigger.current)}>
                <Trash2 size={16} aria-hidden="true" />Excluir
              </DropdownMenu.Item>
              {readOnly && <p className="ctf-menu-note">Modo consulta: exportar, duplicar e excluir ficam desligados.</p>}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <Popover.Root open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <Popover.Anchor virtualRef={categoryAnchor as RefObject<HTMLElement>} />
        <div className="ctf-card-tags">
          {assigned.length ? (
            <button type="button" className="ctf-tag-button" aria-haspopup="dialog" aria-expanded={categoriesOpen}
              aria-label={`Categorias de ${funnel.name}: ${assigned.map(category => category.name).join(", ")}. Editar`}
              onClick={event => categoriesOpen ? setCategoriesOpen(false) : openCategories(event.currentTarget)}>
              {shownCategories.map(category => <span key={category.id} className="ctf-chip">{category.name}</span>)}
              {extraCategories > 0 && <span className="ctf-chip">+{extraCategories}</span>}
            </button>
          ) : (
            <button type="button" className="ctf-tag-add" aria-haspopup="dialog" aria-expanded={categoriesOpen}
              aria-label={`Adicionar categoria a ${funnel.name}`}
              onClick={event => categoriesOpen ? setCategoriesOpen(false) : openCategories(event.currentTarget)}>
              <Plus size={12} aria-hidden="true" />Categoria
            </button>
          )}
        </div>
        <Popover.Portal container={portalHost ?? undefined}>
          <Popover.Content
            className="ctf-popover"
            side="bottom"
            align={fromMenu ? "end" : "start"}
            sideOffset={6}
            collisionPadding={12}
            onEscapeKeyDown={event => {
              // Esc no campo de renomear cancela só a edição, sem fechar o popover.
              if (document.activeElement instanceof HTMLElement && "ctfRename" in document.activeElement.dataset) event.preventDefault();
            }}
            onInteractOutside={event => {
              if (categoryAnchor.current?.contains(event.target as Node)) event.preventDefault();
            }}
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (categoryAnchor.current?.isConnected) categoryAnchor.current.focus();
            }}
          >
            <CategoryPicker
              funnelName={funnel.name}
              assigned={assignedIds}
              categories={categories}
              counts={counts}
              portalHost={portalHost}
              onToggle={onToggleCategory}
              onCreate={onCreateCategory}
              onRename={onRenameCategory}
              onRemove={onRemoveCategory}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <p className="ctf-card-status">
        <span className="ctf-dot" data-status={published ? "published" : "draft"} aria-hidden="true" />
        <strong>{published ? "Publicado" : "Rascunho"}</strong>
        <span className="ctf-card-edited" title={fullDateLabel(funnel.updated_at)} suppressHydrationWarning>
          · Editado {editedAgo(funnel.updated_at, now)}
        </span>
      </p>

      <ul className="ctf-card-metrics" aria-label={`Métricas de ${funnel.name}`}>
        {METRICS.map(({ key, label, detail, icon: Icon }) => {
          const value = stats?.[key];
          const shown = hideValues ? "•••" : value === undefined ? "—" : compactNumber(value);
          const spoken = hideValues ? "valor oculto" : value === undefined ? "sem dado" : exactNumber(value);
          return (
            <li key={key}>
              <Hint container={portalHost} content={<>
                <strong>{label}{!hideValues && value !== undefined ? `: ${exactNumber(value)}` : ""}</strong>
                <span>{value === undefined ? statsMissing : detail}</span>
              </>}>
                <span className="ctf-metric" tabIndex={0}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="sr-only">{label}: {spoken}</span>
                  <span aria-hidden="true">{shown}</span>
                </span>
              </Hint>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
