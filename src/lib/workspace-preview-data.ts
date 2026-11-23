import type { FunnelSummary } from "@/lib/quiz/funnels-db";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";

export const previewFunnels: FunnelSummary[] = [{
  slug: "sorteio-da-sonia",
  name: "Sorteio da Sônia",
  niche: "Quizzes",
  palette_id: "default",
  status: "draft",
  updated_at: "2026-11-17T12:00:00Z",
  engine: "layers",
}];

export const previewAnalytics: GlobalAnalytics = {
  overview: {
    totalFunis: previewFunnels.length, totalSessoes: 0, totalRespostas: 0,
    totalLeads: 0, totalConclusoes: 0, taxaConclusao: 0, daily: [], porFunil: [],
  },
  quiz: [],
  traffic: { sources: [], campaigns: [], total: 0 },
  operacao: [],
  creatives: [],
  leads: { total: 0, recent: [] },
};
