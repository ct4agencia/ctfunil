"use client";

import SnapshotTimestamp from "./SnapshotTimestamp";

import Link from "next/link";
import { useState } from "react";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import WorkspaceDateRange, { calendarSeriesDays, type DateRange } from "@/components/ui/WorkspaceDateRange";
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

export default function SnapshotQuizView({ data, individual = false }: { data: QuizSnapshot; individual?: boolean }) {
  const [funnel, setFunnel] = useState("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const options = Array.from(new Map(data.quiz.map(row => [row.slug, row.name])).entries())
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([value, label]) => ({ value, label: `${label} (/${value})` }));
  const selectedQuestions = funnel ? data.quiz.filter(row => row.slug === funnel) : data.quiz;
  const questions = data.daily ? filterQuizByDate(selectedQuestions, data.daily, range) : selectedQuestions;
  const days = data.daily ? calendarSeriesDays(data.daily, data.captured_at, "America/Sao_Paulo") : [];
  const responses = questions.reduce((sum, row) => sum + row.total, 0);
  return <div className="space-y-4">
    <header className="ct-panel ct-section-heading flex-wrap gap-3">
      <div><h2>Respostas por alternativa</h2><p role="status">{questions.length} perguntas · {responses.toLocaleString("pt-BR")} respostas · Captura de <SnapshotTimestamp capturedAt={data.captured_at} />.</p>
        <p>A contagem inclui respostas vinculadas a uma alternativa cadastrada.</p></div>
      <div className="flex flex-wrap gap-2">
        {!individual && <WorkspaceSelect searchable label="Funil das respostas" value={funnel} onChange={setFunnel} options={[{ value: "", label: "Todos os funis" }, ...options]} />}
        {days.length > 0 && <WorkspaceDateRange days={days} value={range} onChange={setRange} label="Período das respostas" />}
      </div>
    </header>
    {questions.map(row => <details open key={`${row.slug}:${row.id}`} className="ct-panel ct-analytics-disclosure p-4">
      <summary className="cursor-pointer font-semibold [overflow-wrap:anywhere]">{row.question.replace(/&nbsp;|\u00a0/g, " ")} <span className="ml-2 text-xs font-normal text-ct-dim">{row.total.toLocaleString("pt-BR")} respostas</span></summary>
      {!individual && <Link href={`/dashboard/${encodeURIComponent(row.slug)}`} className="mt-2 inline-block text-xs text-ct-blue">{row.name}</Link>}
      <div className="mt-3"><Bars rows={row.options} /></div>
    </details>)}
    {!questions.length && <p role="status" className="text-sm text-ct-dim">A cópia não contém respostas vinculadas a alternativas para este filtro.</p>}
  </div>;
}
