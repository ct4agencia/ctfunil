"use client";

import Link from "next/link";
import { useState } from "react";
import WorkspaceDateRange, { calendarSeriesDays, type DateRange } from "@/components/ui/WorkspaceDateRange";
import SnapshotTimestamp from "./SnapshotTimestamp";

type LeadTotal = { slug: string; name: string; leads: number };
export type LeadsDaily = {
  capturedAt: string;
  timeZone: string;
  rows: { day: string; slug: string; leads: number }[];
};

const number = new Intl.NumberFormat("pt-BR");

function searchKey(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

export default function SnapshotLeadsView({ rows, total, daily }: { rows: LeadTotal[]; total: number; daily?: LeadsDaily }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const search = searchKey(query);
  const dateFiltered = daily && (range.from || range.to);
  const byFunnel = new Map<string, number>();
  if (dateFiltered) {
    for (const { day, slug, leads } of daily.rows) {
      if ((range.from && day < range.from) || (range.to && day > range.to)) continue;
      byFunnel.set(slug, (byFunnel.get(slug) ?? 0) + leads);
    }
  }
  const periodRows = dateFiltered ? rows.map(row => ({ ...row, leads: byFunnel.get(row.slug) ?? 0 })) : rows;
  const periodTotal = dateFiltered ? periodRows.reduce((sum, row) => sum + row.leads, 0) : total;
  const days = daily ? calendarSeriesDays(daily.rows, daily.capturedAt, daily.timeZone) : [];
  const results = periodRows
    .filter(row => row.leads > 0 && searchKey(`${row.name} ${row.slug}`).includes(search))
    .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name, "pt-BR"));
  const subtotal = results.reduce((sum, row) => sum + row.leads, 0);

  return (
    <section className="ct-panel" aria-labelledby="snapshot-leads-title">
      <header className="ct-section-heading flex-wrap gap-3">
        <div>
          <h2 id="snapshot-leads-title">Leads por funil</h2>
          <p>{number.format(periodTotal)} leads {dateFiltered ? "no período selecionado" : "na cópia"}. A consulta exibe os totais por funil.</p>
          {daily && <p>Dados capturados em <SnapshotTimestamp capturedAt={daily.capturedAt} />.</p>}
        </div>
        <label className="ct-search">
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            aria-label="Buscar funil nos leads" placeholder="Buscar funil" />
        </label>
      </header>
      {days.length > 0 && <div className="px-4 pb-3">
        <WorkspaceDateRange days={days} value={range} onChange={setRange} label="Período dos leads" />
      </div>}
      <p role="status" className="px-4 pb-3 text-xs text-ct-dim">
        {number.format(subtotal)} leads em {results.length} {results.length === 1 ? "funil" : "funis"} na lista
      </p>
      {results.length ? (
        <div role="region" aria-labelledby="snapshot-leads-title" tabIndex={0} className="ct-comparison-scroll overflow-x-auto px-4 pb-4">
          <table className="w-full text-sm" aria-labelledby="snapshot-leads-title">
            <thead className="border-b border-ct-line text-left text-ct-dim">
              <tr><th scope="col" className="py-2">Funil</th><th scope="col" className="px-3 py-2 text-right">Leads</th></tr>
            </thead>
            <tbody>{results.map(row => (
              <tr key={row.slug} className="border-b border-ct-line">
                <th scope="row" className="py-2 text-left font-medium">
                  <Link className="text-ct-blue" href={`/dashboard/${encodeURIComponent(row.slug)}`}>{row.name}</Link>
                  <span className="block text-xs text-ct-dim">/{row.slug}</span>
                </th>
                <td className="px-3 py-2 text-right">{number.format(row.leads)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 pb-4 text-sm text-ct-dim">
          <p>{search ? "Nenhum funil com leads corresponde à busca." : "Nenhum funil com leads no período."}</p>
          {search && <button type="button" className="mt-2 text-ct-blue underline" onClick={() => setQuery("")}>Limpar busca</button>}
        </div>
      )}
    </section>
  );
}
