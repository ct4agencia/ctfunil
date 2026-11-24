"use client";

import SnapshotRangeCoverage from "./SnapshotRangeCoverage";
import { useSnapshotDateRange } from "./useSnapshotDateRange";
import SnapshotTimestamp from "./SnapshotTimestamp";

import WorkspaceCheckbox from "@/components/ui/WorkspaceCheckbox";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import WorkspaceDateRange, { calendarSeriesDays, type DateRange } from "@/components/ui/WorkspaceDateRange";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type VslRow = {
  slug: string;
  name: string;
  tracked: number;
  avg_watch: number;
  at_least_25: number;
  at_least_50: number;
  at_least_75: number;
  at_least_95: number;
};

type DailyVslRow = Omit<VslRow, "name" | "avg_watch"> & { day: string; watched_sum: number };

export type VslSnapshot = { rows: VslRow[]; captured_at: string; timeZone: string; daily: DailyVslRow[] };

function rowsInPeriod(data: VslSnapshot, range: DateRange) {
  if (!range.from && !range.to) return data.rows;

  const totals = new Map<string, Omit<VslRow, "name" | "avg_watch"> & { watched_sum: number }>();
  for (const row of data.daily) {
    if ((range.from && row.day < range.from) || (range.to && row.day > range.to)) continue;
    const entry = totals.get(row.slug);
    if (entry) {
      entry.tracked += row.tracked;
      entry.watched_sum += row.watched_sum;
      entry.at_least_25 += row.at_least_25;
      entry.at_least_50 += row.at_least_50;
      entry.at_least_75 += row.at_least_75;
      entry.at_least_95 += row.at_least_95;
    } else {
      const { day: _day, ...metrics } = row;
      totals.set(row.slug, metrics);
    }
  }
  return data.rows.flatMap(({ name, slug }) => {
    const metrics = totals.get(slug);
    if (!metrics) return [];
    const { watched_sum, ...values } = metrics;
    return [{ ...values, name, avg_watch: Math.round(watched_sum / values.tracked * 10) / 10 }];
  });
}

const columns = [
  ["tracked", "Sessões com progresso"],
  ["avg_watch", "Progresso médio"],
  ["at_least_25", "25% ou mais"],
  ["at_least_50", "50% ou mais"],
  ["at_least_75", "75% ou mais"],
  ["at_least_95", "95% ou mais"],
] as const;
type Metric = (typeof columns)[number][0];
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
function formatMetric(row: VslRow, metric: Metric) {
  return number.format(row[metric]) + (metric === "avg_watch" ? "%" : "");
}

function searchKey(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

export default function SnapshotVslView({ data, individual = false, reportRange }: { data: VslSnapshot; individual?: boolean; reportRange?: DateRange }) {
  const heading = useId();
  const comparison = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ metric: Metric; ascending: boolean } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const days = calendarSeriesDays(data.daily, data.captured_at, data.timeZone);
  const { range: analyticsRange, changeRange, outsideCapture, partialCapture } = useSnapshotDateRange(days, "vsl");
  const range = reportRange ?? (individual ? { from: "", to: "" } : analyticsRange);
  const reportQuery = new URLSearchParams(range.from ? { origem: "vsl", ...range } : { origem: "vsl" });
  const periodRows = rowsInPeriod(data, range);
  const individualRow = periodRows[0];
  const term = searchKey(query);
  const rows = periodRows.filter(row => searchKey(`${row.name} ${row.slug}`).includes(term));
  if (sort) {
    rows.sort((a, b) => (sort.ascending ? a[sort.metric] - b[sort.metric] : b[sort.metric] - a[sort.metric])
      || a.name.localeCompare(b.name, "pt-BR"));
  }
  const compared = periodRows.filter(row => selected.includes(row.slug));
  const visibleSlugs = new Set(rows.map(row => row.slug));
  const selectedVisible = selected.filter(slug => visibleSlugs.has(slug)).length;
  const allVisibleSelected = selectedVisible > 0 && selectedVisible === visibleSlugs.size;
  const partiallySelected = selectedVisible > 0 && !allVisibleSelected;

  return <section className="ct-panel" aria-labelledby={heading}>
    <header className="ct-section-heading flex-wrap gap-3">
      <div>
        <h2 id={heading}>{individual ? "Progresso de vídeo" : "Progresso de vídeo por funil"}</h2>
        <p>Eventos registrados pelo CTFunil até <SnapshotTimestamp capturedAt={data.captured_at} />. Cada coluna conta as sessões que atingiram aquele marco.</p>
      </div>
      {!individual && days.length > 0 && <WorkspaceDateRange allowEarlierDates days={days} value={range} label="Data de início das sessões"
        onChange={value => { changeRange(value); setSelected([]); }} />}
      {!individual && data.rows.length > 0 && <label className="ct-search">
        <input ref={searchInput} type="search" aria-label="Buscar funil em VSL" placeholder="Buscar funil"
          value={query} onChange={event => setQuery(event.target.value)} />
      </label>}
    </header>
    {!individual && <SnapshotRangeCoverage outsideCapture={outsideCapture} partialCapture={partialCapture}
        onReset={() => changeRange({ from: "", to: "" })} />}
    {(!outsideCapture || individual) && (individual ? individualRow ? (
      <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map(([key, label]) => (
          <div key={key} className="rounded-xl border border-ct-line bg-ct-raised p-4">
            <dt className="text-sm text-ct-dim">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{formatMetric(individualRow, key)}</dd>
          </div>
        ))}
      </dl>
    ) : <p role="status" className="px-4 pb-4 text-sm text-ct-dim">Nenhuma sessão com progresso neste período.</p> : data.rows.length ? <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs text-ct-dim">
        <p role="status">{rows.length} {rows.length === 1 ? "funil listado" : "funis listados"} · {compared.length} {compared.length === 1 ? "selecionado" : "selecionados"}</p>
        {compared.length > 0 && <button type="button" className="text-ct-blue underline" onClick={() => {
          setSelected([]);
          searchInput.current?.focus({ preventScroll: true });
          searchInput.current?.scrollIntoView({ block: "center", inline: "nearest" });
        }}>Limpar seleção de VSL</button>}
      </div>
      {compared.length >= 2 && <section className="mx-4 mb-4 rounded-xl border border-ct-line bg-ct-raised p-3" aria-labelledby={comparison}>
        <h3 id={comparison} className="mb-2 text-sm font-semibold">Comparação de VSLs</h3>
        <div role="region" aria-labelledby={comparison} tabIndex={0} className="ct-comparison-scroll overflow-x-auto">
          <table className="ct-comparison-table w-full text-sm">
            <thead><tr className="border-b border-ct-line">
              <th scope="col" className="px-2 py-2 text-left">Métrica</th>
              {compared.map(row => <th scope="col" key={row.slug} className="min-w-36 px-3 py-2 text-right">{row.name}</th>)}
            </tr></thead>
            <tbody>{columns.map(([key, label]) => <tr key={key} className="border-b border-ct-line">
              <th scope="row" className="px-2 py-2 text-left font-medium">{label}</th>
              {compared.map(row => <td key={row.slug} className="whitespace-nowrap px-3 py-2 text-right">{formatMetric(row, key)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
      {rows.length ? <div role="region" aria-labelledby={heading} tabIndex={0} className="ct-comparison-scroll overflow-x-auto px-4 pb-4">
        <table className="w-full text-sm">
          <thead className="border-b border-ct-line text-left text-ct-dim"><tr>
            <th scope="col" className="px-2 py-2">
              <WorkspaceCheckbox aria-label="Selecionar VSLs listadas"
                checked={allVisibleSelected}
                mixed={partiallySelected}
                onChange={event => {
                  const checked = event.target.checked;
                  setSelected(current => checked ? Array.from(new Set([...current, ...visibleSlugs]))
                    : current.filter(slug => !visibleSlugs.has(slug)));
                }} />
            </th>
            <th scope="col" className="py-2">Funil</th>
            {columns.map(([key, label]) => {
              const direction = sort?.metric === key ? (sort.ascending ? "ascending" : "descending") : undefined;
              const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
              return <th scope="col" aria-sort={direction} key={key} className="whitespace-nowrap px-3 py-2 text-right">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => setSort({
                  metric: key, ascending: sort?.metric === key && !sort.ascending,
                })}>{label}<Icon size={13} aria-hidden="true" /></button>
              </th>;
            })}
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.slug} className="border-b border-ct-line">
            <td className="px-2 py-2">
              <WorkspaceCheckbox aria-label={`Comparar ${row.name}`}
                checked={selected.includes(row.slug)} onChange={event => {
                  const checked = event.target.checked;
                  setSelected(current => checked ? [...current, row.slug] : current.filter(slug => slug !== row.slug));
                }} />
            </td>
            <th scope="row" className="min-w-36 py-2 text-left font-medium"><Link className="text-ct-blue" href={`/dashboard/${encodeURIComponent(row.slug)}?${reportQuery}`}>{row.name}</Link></th>
            {columns.map(([key]) => <td key={key} className="whitespace-nowrap px-3 py-2 text-right">{formatMetric(row, key)}</td>)}
          </tr>)}</tbody>
        </table>
      </div> : <p className="px-4 pb-4 text-sm text-ct-dim">{periodRows.length ? "Nenhum funil encontrado." : "Nenhuma sessão com progresso neste período."}</p>}
    </> : <p className="px-4 pb-4 text-sm text-ct-dim">A cópia ainda não contém eventos de progresso de vídeo.</p>)}
  </section>;
}
