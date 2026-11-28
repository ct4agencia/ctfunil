"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { DropdownMenu } from "radix-ui";
import { Ellipsis, Pencil, Plus, Search, Trash2 } from "lucide-react";
import WorkspaceCheckbox from "@/components/ui/WorkspaceCheckbox";
import { matchesCategory, sameCategoryName, type Category } from "./categories";

/**
 * Popover "Buscar ou criar categoria" do cartão (menu ⋮ › Categorias ou a
 * etiqueta "+ Categoria"). Caixas de seleção, contagem de funis por categoria
 * e menu "…" com Renomear e Excluir, como na Inlead.
 */
export default function CategoryPicker({ funnelName, assigned, categories, counts, portalHost, onToggle, onCreate, onRename, onRemove }: {
  funnelName: string;
  assigned: Set<string>;
  categories: Category[];
  counts: Map<string, number>;
  portalHost: HTMLElement | null;
  onToggle: (id: string) => void;
  onCreate: (name: string) => Category | null;
  onRename: (id: string, name: string) => boolean;
  onRemove: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Ação escolhida no menu "…": roda depois que o menu fecha, para o foco não
  // voltar ao botão "…" (que tiraria o foco do campo de renomear).
  const pendingAction = useRef<{ kind: "rename" | "remove"; category: Category } | null>(null);
  const trimmed = query.trim();
  const visible = categories.filter(category => matchesCategory(category.name, trimmed));
  const exact = categories.find(category => sameCategoryName(category.name, trimmed));
  const canCreate = Boolean(trimmed) && !exact;

  function create() {
    const category = onCreate(trimmed);
    if (!category) return;
    setQuery("");
    setMessage(`Categoria ${category.name} criada e marcada neste funil.`);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canCreate) create();
    else if (exact) {
      onToggle(exact.id);
      setMessage(`${exact.name} ${assigned.has(exact.id) ? "desmarcada" : "marcada"}.`);
    }
  }

  function finishRename(save: boolean) {
    if (!renaming) return;
    if (save && renaming.name.trim()) {
      const ok = onRename(renaming.id, renaming.name);
      if (!ok) {
        setMessage("Já existe uma categoria com esse nome.");
        return;
      }
      setMessage(`Categoria renomeada para ${renaming.name.trim()}.`);
    }
    setRenaming(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <div className="ctf-cat" aria-label={`Categorias de ${funnelName}`} role="group">
      <label className="ctf-cat-search">
        <Search size={15} aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          maxLength={40}
          placeholder="Buscar ou criar categoria"
          aria-label="Buscar ou criar categoria"
          aria-describedby={`${id}-note`}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
        />
      </label>
      {visible.length > 0 && (
        <ul className="ctf-cat-list">
          {visible.map(category => (
            <li key={category.id} className="ctf-cat-row">
              {renaming?.id === category.id ? (
                <input
                  className="ctf-cat-rename"
                  data-ctf-rename=""
                  autoFocus
                  value={renaming.name}
                  maxLength={40}
                  aria-label={`Novo nome da categoria ${category.name}`}
                  onChange={event => setRenaming({ id: category.id, name: event.target.value })}
                  onBlur={() => finishRename(true)}
                  onKeyDown={event => {
                    if (event.key === "Enter") { event.preventDefault(); finishRename(true); }
                    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishRename(false); }
                  }}
                />
              ) : (
                <label className="ctf-cat-option">
                  <WorkspaceCheckbox checked={assigned.has(category.id)} onChange={() => onToggle(category.id)} />
                  <span className="ctf-chip">{category.name}</span>
                  <span className="ctf-cat-count">{counts.get(category.id) ?? 0}<span className="sr-only"> {(counts.get(category.id) ?? 0) === 1 ? "funil" : "funis"}</span></span>
                </label>
              )}
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger className="ctf-cat-more" aria-label={`Opções da categoria ${category.name}`}>
                  <Ellipsis size={15} aria-hidden="true" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal container={portalHost ?? undefined}>
                  <DropdownMenu.Content className="ctf-menu ctf-menu-small" side="right" align="start" sideOffset={6} collisionPadding={12}
                    onCloseAutoFocus={event => {
                      const action = pendingAction.current;
                      if (!action) return;
                      event.preventDefault();
                      pendingAction.current = null;
                      if (action.kind === "rename") setRenaming({ id: action.category.id, name: action.category.name });
                      else {
                        onRemove(action.category.id);
                        setMessage(`Categoria ${action.category.name} excluída.`);
                        searchRef.current?.focus();
                      }
                    }}>
                    <DropdownMenu.Item className="ctf-menu-item" onSelect={() => { pendingAction.current = { kind: "rename", category }; }}>
                      <Pencil size={15} aria-hidden="true" />Renomear
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="ctf-menu-item" data-danger="" onSelect={() => { pendingAction.current = { kind: "remove", category }; }}>
                      <Trash2 size={15} aria-hidden="true" />Excluir categoria
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </li>
          ))}
        </ul>
      )}
      {canCreate && (
        <button type="button" className="ctf-cat-create" onClick={create}>
          <Plus size={15} aria-hidden="true" />Criar categoria <span className="ctf-chip">{trimmed}</span>
        </button>
      )}
      {!categories.length && !trimmed && <p className="ctf-cat-empty">Nenhuma categoria ainda. Digite um nome para criar.</p>}
      {categories.length > 0 && !visible.length && !canCreate && <p className="ctf-cat-empty">Nenhuma categoria encontrada.</p>}
      <p id={`${id}-note`} className="ctf-cat-note">Categorias salvas só neste navegador.</p>
      <p role="status" className="sr-only">{message}</p>
    </div>
  );
}
