"use client";

import SnapshotTimestamp from "./SnapshotTimestamp";

import { useId } from "react";
import Link from "next/link";
import type { DateRange } from "@/components/ui/WorkspaceDateRange";

type Option = { label: string; sessions: number; leads: number };
export type DiagnosisSnapshot = {
  captured_at: string;
  daily?: { slug: string; id: string; option: number; day: string; sessions: number; leads: number }[];
  questions: {
    slug: string;
    name: string;
    id: string;
    question: string;
    sessions: number;
    leads: number;
    options: Option[];
  }[];
};

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("pt-BR");

function filterDiagnosisByDate(questions: DiagnosisSnapshot["questions"], daily: NonNullable<DiagnosisSnapshot["daily"]>, { from, to }: DateRange) {
  if (!from && !to) return questions;
  const counts = new Map<string, { sessions: number; leads: number }>();
  for (const row of daily) {
    if ((from && row.day < from) || (to && row.day > to)) continue;
    const key = `${row.slug}:${row.id}:${row.option}`;
    const current = counts.get(key) ?? { sessions: 0, leads: 0 };
    counts.set(key, { sessions: current.sessions + row.sessions, leads: current.leads + row.leads });
  }
  return questions.flatMap(question => {
    const options = question.options.flatMap((option, index) => {
      const count = counts.get(`${question.slug}:${question.id}:${index}`);
      return count ? [{ label: option.label, ...count }] : [];
    });
    if (!options.length) return [];
    const sessions = options.reduce((sum, option) => sum + option.sessions, 0);
    const leads = options.reduce((sum, option) => sum + option.leads, 0);
    return [{ ...question, options, sessions, leads }];
  });
}

export default function SnapshotDiagnosisView({ data, individual = false, reportRange, funnel = "" }: { data: DiagnosisSnapshot; individual?: boolean; reportRange?: DateRange; funnel?: string }) {
  const id = useId();
  const range = reportRange ?? { from: "", to: "" };
  const reportParams = new URLSearchParams({ origem: "diagnostico" });
  if (funnel) reportParams.set("respFunil", funnel);
  if (range.from && range.to) {
    reportParams.set("from", range.from);
    reportParams.set("to", range.to);
  }
  const selected = funnel ? data.questions.filter(row => row.slug === funnel) : data.questions;
  const visible = data.daily ? filterDiagnosisByDate(selected, data.daily, range) : selected;
  const sessions = visible.reduce((sum, row) => sum + row.sessions, 0);
  const leads = visible.reduce((sum, row) => sum + row.leads, 0);

  return <div className="space-y-4">
    <section className="ct-panel">
      <header className="ct-section-heading flex-wrap gap-3">
        <div><h2>Capturas por alternativa</h2><p>Dados de <SnapshotTimestamp capturedAt={data.captured_at} />. A taxa considera capturas registradas no mesmo funil até a data da cópia.</p>
          <p role="status">{visible.length} perguntas · {number.format(sessions)} sessões por pergunta · {number.format(leads)} com captura</p></div>
        
      </header>
      <p className="px-4 pb-4 text-xs text-ct-dim">Cada pergunta usa a última alternativa reconhecida por sessão. Uma sessão pode aparecer em mais de uma pergunta.</p>
    </section>
    {visible.map((row, index) => <details className="ct-panel ct-analytics-disclosure p-4" key={`${row.slug}:${row.id}`}>
      <summary id={`${id}-question-${index}`} className="cursor-pointer font-semibold [overflow-wrap:anywhere]">{row.question.replace(/&nbsp;|\u00a0/g, " ")} <span className="ml-2 text-xs font-normal text-ct-dim">{row.sessions} sessões</span></summary>
      {!individual && <Link href={`/dashboard/${encodeURIComponent(row.slug)}?${reportParams}`} className="mt-2 inline-block text-xs text-ct-blue">{row.name}</Link>}
      <div role="region" aria-labelledby={`${id}-question-${index}`} tabIndex={0} className="ct-comparison-scroll mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead className="border-b border-ct-line text-left text-ct-dim"><tr>
          <th scope="col" className="py-2">Alternativa</th>
          <th scope="col" className="whitespace-nowrap px-2 text-right">Sessões</th>
          <th scope="col" className="whitespace-nowrap px-2 text-right">Com captura</th>
          <th scope="col" className="whitespace-nowrap px-2 text-right">Taxa</th>
        </tr></thead>
        <tbody>{row.options.map(option => <tr key={option.label} className="border-b border-ct-line">
          <th scope="row" className="py-2 text-left font-medium">{option.label}</th>
          <td className="px-2 text-right">{option.sessions}</td>
          <td className="px-2 text-right">{option.leads}</td>
          <td className="px-2 text-right">{percent.format(option.leads / option.sessions)}</td>
        </tr>)}</tbody>
        <tfoot><tr className="font-semibold"><th scope="row" className="py-2 text-left">Total</th>
          <td className="px-2 text-right">{row.sessions}</td><td className="px-2 text-right">{row.leads}</td>
          <td className="px-2 text-right">{percent.format(row.leads / row.sessions)}</td>
        </tr></tfoot>
      </table></div>
    </details>)}
    {!visible.length && <p role="status" className="text-sm text-ct-dim">Sem respostas vinculadas a alternativas para este filtro.</p>}
  </div>;
}
