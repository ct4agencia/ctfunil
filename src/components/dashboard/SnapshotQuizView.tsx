"use client";

import SnapshotTimestamp from "./SnapshotTimestamp";

import Link from "next/link";
import type { DateRange } from "@/components/ui/WorkspaceDateRange";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";
import Bars from "./Bars";

export type QuizSnapshot = {
  captured_at: string;
  quiz: (GlobalAnalytics["quiz"][number] & { slug: string; name: string; id: string })[];
  daily?: { slug: string; id: string; option: number; day: string; responses: number }[];
};

function filterQuizByDate(questions: QuizSnapshot["quiz"], daily: NonNullable<QuizSnapshot["daily"]>, { from, to }: DateRange) {
  if (!from && !to) return questions;
  const counts = new Map<string, number>();
  for (const row of daily) {
    if ((from && row.day < from) || (to && row.day > to)) continue;
    const key = `${row.slug}:${row.id}:${row.option}`;
    counts.set(key, (counts.get(key) ?? 0) + row.responses);
  }
  return questions.flatMap(question => {
    const options = question.options.map((option, index) => ({
      ...option, value: counts.get(`${question.slug}:${question.id}:${index}`) ?? 0,
    }));
    const total = options.reduce((sum, option) => sum + option.value, 0);
    return total ? [{ ...question, total, options: options.map(option => ({
      ...option, pct: Math.round(option.value * 1000 / total) / 10,
    })) }] : [];
  });
}

export default function SnapshotQuizView({ data, individual = false, reportRange, funnel = "" }: { data: QuizSnapshot; individual?: boolean; reportRange?: DateRange; funnel?: string }) {
  const range = reportRange ?? { from: "", to: "" };
  const reportParams = new URLSearchParams({ origem: "quiz" });
  if (funnel) reportParams.set("respFunil", funnel);
  if (range.from && range.to) {
    reportParams.set("from", range.from);
    reportParams.set("to", range.to);
  }
  const selectedQuestions = funnel ? data.quiz.filter(row => row.slug === funnel) : data.quiz;
  const questions = data.daily ? filterQuizByDate(selectedQuestions, data.daily, range) : selectedQuestions;
  const responses = questions.reduce((sum, row) => sum + row.total, 0);
  return <div className="space-y-4">
    <header className="ct-panel ct-section-heading flex-wrap gap-3">
      <div><h2>Respostas por alternativa</h2><p role="status">{questions.length} perguntas · {responses.toLocaleString("pt-BR")} respostas · Captura de <SnapshotTimestamp capturedAt={data.captured_at} />.</p>
        <p>A contagem inclui respostas vinculadas a uma alternativa cadastrada.</p></div>
      
    </header>
    {questions.map(row => <details open key={`${row.slug}:${row.id}`} className="ct-panel ct-analytics-disclosure p-4">
      <summary className="cursor-pointer font-semibold [overflow-wrap:anywhere]">{row.question.replace(/&nbsp;|\u00a0/g, " ")} <span className="ml-2 text-xs font-normal text-ct-dim">{row.total.toLocaleString("pt-BR")} respostas</span></summary>
      {!individual && <Link href={`/dashboard/${encodeURIComponent(row.slug)}?${reportParams}`} className="mt-2 inline-block text-xs text-ct-blue">{row.name}</Link>}
      <div className="mt-3"><Bars rows={row.options} /></div>
    </details>)}
    {!questions.length && <p role="status" className="text-sm text-ct-dim">A cópia não contém respostas vinculadas a alternativas para este filtro.</p>}
  </div>;
}
