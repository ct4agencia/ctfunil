import { hasPreviewVslDraft } from "@/lib/workspace-preview-vsl-drafts";
import { headers } from "next/headers";
import { funnelPublicLabel } from "@/lib/quiz/public-url";
import { getWorkspaceSnapshotIfAuthorized } from "@/lib/workspace-real-data";
import { isOfficialWorkspaceHost, isRealDataPreview } from "@/lib/workspace-preview";
import { globalAnalytics } from "@/lib/quiz/metrics";
import ProjectsWorkspace, { type Project } from "./ProjectsWorkspace";

const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function ProjectsPage() {
  const host = (await headers()).get("host");
  const snapshot = isRealDataPreview(host) ? await getWorkspaceSnapshotIfAuthorized() : null;
  if (!snapshot) return <ProjectsWorkspace />;

  const videoSlugs = new Set(snapshot.vsl.rows.map(row => row.slug));
  const quizSlugs = new Set(snapshot.quiz.quiz.map(row => row.slug));
  // Painel oficial: sessões ao vivo; no preview em consulta, as da captura.
  const official = isOfficialWorkspaceHost(host);
  const operation = official ? (await globalAnalytics()).operacao : snapshot.analytics.operacao;
  const totals = new Map(operation.map(row => [row.slug, row]));
  const projects = snapshot.funnels.map((funnel): Project => {
    const type = (videoSlugs.has(funnel.slug) || hasPreviewVslDraft(funnel.slug)) ? "pages" : quizSlugs.has(funnel.slug) ? "quiz" : "plus";
    const sessions = totals.get(funnel.slug)?.visitantes;
    const updated = new Date(funnel.updated_at);
    return {
      id: funnel.slug,
      name: funnel.name,
      type,
      kind: type === "pages" ? "Página VSL" : type === "quiz" ? "Quiz" : "Funil",
      product: funnel.niche?.trim() || "Sem nicho informado",
      status: funnel.status,
      updated: Number.isNaN(updated.getTime()) ? "Sem data" : date.format(updated),
      preview: official ? funnelPublicLabel(funnel) : `/${funnel.slug}`,
      metric: sessions === undefined ? "Sem total de sessões" : `${number.format(sessions)} sessões`,
      editorHref: `/builder/${encodeURIComponent(funnel.slug)}?editar=1`,
      reportHref: `/dashboard/${encodeURIComponent(funnel.slug)}`,
    };
  });

  return <ProjectsWorkspace key={snapshot.accountId} accountId={snapshot.accountId} snapshot={projects} avatarUrl={snapshot.avatarUrl} accountEmail={snapshot.accountEmail} official={official} />;
}
