import { parseCivilRange } from "./periodo";

export type LibraryContextQuery = {
  biblioteca?: string;
  buscaFunil?: string;
  buscaPagina?: string;
  pasta?: string;
  atualDe?: string;
  atualAte?: string;
};

export function libraryContext(query: LibraryContextQuery) {
  const params = new URLSearchParams();
  if (query.biblioteca === "quizzes" || query.biblioteca === "pages") params.set("biblioteca", query.biblioteca);
  for (const key of ["buscaFunil", "buscaPagina", "pasta"] as const) {
    const value = query[key];
    if (typeof value === "string" && value.trim()) params.set(key, value.slice(0, 160));
  }
  const updates = parseCivilRange(query.atualDe, query.atualAte);
  if (updates) {
    params.set("atualDe", updates.from);
    params.set("atualAte", updates.to);
  }
  return params;
}

export function libraryHref(context: URLSearchParams, defaultTab?: "pages") {
  const params = new URLSearchParams(context);
  const tab = params.get("biblioteca") ?? (params.has("atualDe") ? undefined : defaultTab);
  params.delete("biblioteca");
  if (tab === "pages") params.set("tab", tab);
  return params.size ? `/dashboard?${params}` : "/dashboard";
}
