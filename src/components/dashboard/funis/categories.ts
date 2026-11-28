"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Categorias dos funis, guardadas SÓ NESTE NAVEGADOR (escolha do Luca em 28/11:
 * "Só no navegador agora"). O banco não tem tabela de categorias; levá-las ao
 * Supabase exige migration com o OK dele. Cada navegador tem as suas.
 *
 * A ligação é pelo slug: renomear o slug de um funil solta as categorias dele.
 */

export type Category = { id: string; name: string };
type CategoryState = { categories: Category[]; links: Record<string, string[]> };

const KEY = "ctfunil:funis:categorias:v1";
const EMPTY: CategoryState = { categories: [], links: {} };
const listeners = new Set<() => void>();
let cache: CategoryState | null = null;

function parse(raw: string | null): CategoryState {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<CategoryState>;
    const categories = Array.isArray(value.categories)
      ? value.categories.filter((item): item is Category => typeof item?.id === "string" && typeof item?.name === "string")
      : [];
    const ids = new Set(categories.map(item => item.id));
    const links: Record<string, string[]> = {};
    if (value.links && typeof value.links === "object") {
      for (const [slug, list] of Object.entries(value.links)) {
        if (Array.isArray(list)) {
          const valid = list.filter(id => typeof id === "string" && ids.has(id));
          if (valid.length) links[slug] = valid;
        }
      }
    }
    return { categories, links };
  } catch {
    return EMPTY;
  }
}

function read(): CategoryState {
  if (cache) return cache;
  try {
    cache = parse(window.localStorage.getItem(KEY));
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: CategoryState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Navegador sem armazenamento (janela anônima bloqueada): vale só nesta aba.
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => EMPTY;

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

export function sameCategoryName(a: string, b: string) {
  return normalize(a) === normalize(b);
}

export function matchesCategory(name: string, query: string) {
  return normalize(name).includes(normalize(query));
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function useFunnelCategories() {
  const state = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const create = useCallback((rawName: string, slug?: string): Category | null => {
    const name = rawName.trim().slice(0, 40);
    if (!name) return null;
    const current = read();
    const existing = current.categories.find(item => sameCategoryName(item.name, name));
    const category = existing ?? { id: newId(), name };
    const categories = existing ? current.categories : [...current.categories, category];
    const links = { ...current.links };
    if (slug && !(links[slug] ?? []).includes(category.id)) links[slug] = [...(links[slug] ?? []), category.id];
    write({ categories, links });
    return category;
  }, []);

  const toggle = useCallback((slug: string, id: string) => {
    const current = read();
    const list = current.links[slug] ?? [];
    const nextList = list.includes(id) ? list.filter(item => item !== id) : [...list, id];
    const links = { ...current.links };
    if (nextList.length) links[slug] = nextList;
    else delete links[slug];
    write({ ...current, links });
  }, []);

  const rename = useCallback((id: string, rawName: string) => {
    const name = rawName.trim().slice(0, 40);
    if (!name) return false;
    const current = read();
    if (current.categories.some(item => item.id !== id && sameCategoryName(item.name, name))) return false;
    write({ ...current, categories: current.categories.map(item => item.id === id ? { ...item, name } : item) });
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    const current = read();
    const links: Record<string, string[]> = {};
    for (const [slug, list] of Object.entries(current.links)) {
      const nextList = list.filter(item => item !== id);
      if (nextList.length) links[slug] = nextList;
    }
    write({ categories: current.categories.filter(item => item.id !== id), links });
  }, []);

  return { categories: state.categories, links: state.links, create, toggle, rename, remove };
}
