export function reportOrigin(value: unknown) {
  return value === "vsl" || value === "quiz" || value === "diagnostico" || value === "leads" ? value : undefined;
}

export function preserveReportOrigin(params: URLSearchParams, origin: unknown, selectedFunnel: unknown, slug?: string) {
  const source = reportOrigin(origin);
  if (!source) return;
  params.set("origem", source);
  if ((source === "quiz" || source === "diagnostico") && slug && selectedFunnel === slug) params.set("respFunil", slug);
}
