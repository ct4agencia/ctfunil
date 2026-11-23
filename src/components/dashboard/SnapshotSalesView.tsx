"use client";

import SnapshotTimestamp from "./SnapshotTimestamp";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import WorkspaceDateRange, { calendarSeriesDays, type DateRange } from "@/components/ui/WorkspaceDateRange";

type OrderCounts = { orders: number; approved: number; reversals: number; gross_cents: number; priced: number };

export type SalesSnapshot = {
  capturedAt: string;
  timeZone: string;
  codes: { code: string; configuredFunnels: number }[];
  daily: (OrderCounts & { day: string; code: string })[];
};

const number = new Intl.NumberFormat("pt-BR");
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type SalesRow = OrderCounts & { code: string; configuredFunnels: number };
const metricColumns = [
  ["orders", "Pedidos registrados"],
  ["approved", "Pedidos aprovados"],
  ["reversals", "Reembolsos e chargebacks"],
  ["gross_cents", "Valor bruto aprovado"],
  ["average", "Ticket médio aprovado"],
] as const;
const columns = [["code", "Código do checkout"], ["configuredFunnels", "Funis com o código"], ...metricColumns] as const;
type Column = (typeof columns)[number][0];

function sortValue(row: SalesRow, key: Column): number | string | null {
  if (key === "average") return row.priced ? row.gross_cents / row.priced : null;
  if (key === "gross_cents" && !row.priced) return null;
  return row[key];
}

function salesValues(counts: OrderCounts) {
  return [
    number.format(counts.orders),
    number.format(counts.approved),
    number.format(counts.reversals),
    counts.priced ? brl.format(counts.gross_cents / 100) : "—",
    counts.priced ? brl.format(counts.gross_cents / 100 / counts.priced) : "—",
  ];
}

const labels = metricColumns.map(([, label]) => label);
const emptyCounts: OrderCounts = { orders: 0, approved: 0, reversals: 0, gross_cents: 0, priced: 0 };
const keys = Object.keys(emptyCounts) as (keyof OrderCounts)[];

export default function SnapshotSalesView({ data }: { data: SalesSnapshot }) {
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: Column; descending: boolean }>({ key: "orders", descending: true });
  const days = calendarSeriesDays(data.daily, data.capturedAt, data.timeZone);
  const tallies = new Map(data.codes.map(code => [code.code, {
    ...code, ...emptyCounts,
  }]));
  const totals = { ...emptyCounts };

  for (const day of data.daily) {
    if ((range.from && day.day < range.from) || (range.to && day.day > range.to)) continue;
    const tally = tallies.get(day.code);
    if (!tally) continue;
    for (const metric of keys) {
      tally[metric] += day[metric];
      totals[metric] += day[metric];
    }
  }

  const search = query.trim().toLocaleLowerCase("pt-BR");
  const rows = [...tallies.values()].filter(row => row.code.includes(search)).sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    const tie = a.code.localeCompare(b.code, "pt-BR");
    if (x === null || y === null) return Number(x === null) - Number(y === null) || tie;
    const difference = typeof x === "number" && typeof y === "number" ? x - y : tie;
    return (sort.descending ? -difference : difference) || tie;
  });

  return <section className="ct-panel" aria-labelledby="snapshot-sales">
    <header className="ct-section-heading flex-wrap gap-3">
      <div>
        <h2 id="snapshot-sales">Pedidos Hotmart por código de checkout</h2>
        <p>Captura do CTAnalytics em <SnapshotTimestamp capturedAt={data.capturedAt} timeZone={data.timeZone} />. O mesmo código pode aparecer em mais de um funil.</p>
      </div>
      {days.length > 0 && <WorkspaceDateRange days={days} value={range} onChange={setRange} label="Data dos pedidos" />}
      <label className="ct-search">
        <input type="search" aria-label="Buscar código de checkout" placeholder="Buscar código"
          value={query} onChange={event => setQuery(event.target.value)} />
      </label>
    </header>
    <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-3 xl:grid-cols-5">
      {salesValues(totals).map((value, index) => <div key={labels[index]} className="rounded-xl border border-ct-line bg-ct-raised p-3">
        <dt className="text-xs text-ct-dim">{labels[index]}</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      </div>)}
    </dl>
    <p className="px-4 pb-3 text-xs text-ct-dim">O valor bruto e o ticket médio usam {number.format(totals.priced)} pedidos aprovados com valor original em reais, antes de taxas.</p>
    {totals.orders === 0 && <p role="status" className="px-4 pb-3 text-sm text-ct-dim">Nenhum pedido neste período.</p>}
    <p role="status" className="px-4 pb-2 text-xs text-ct-dim">{rows.length} de {data.codes.length} códigos exibidos</p>
    {rows.length ? <div role="region" aria-labelledby="snapshot-sales" tabIndex={0} className="ct-comparison-scroll overflow-x-auto px-4 pb-4">
      <table className="ct-comparison-table w-full text-sm">
        <thead className="border-b border-ct-line text-left text-ct-dim"><tr>
          {columns.map(([key, label]) => {
            const active = sort.key === key;
            const direction = active ? (sort.descending ? "descending" : "ascending") : undefined;
            const Icon = direction === "descending" ? ArrowDown : direction === "ascending" ? ArrowUp : ArrowUpDown;
            return <th key={key} scope="col" aria-sort={direction} className="px-2 py-2">
              <button type="button" className="inline-flex items-center gap-1 text-left"
                onClick={() => setSort({ key, descending: active ? !sort.descending : key !== "code" })}>
                {label}<Icon size={13} className="shrink-0" aria-hidden="true" />
              </button>
            </th>;
          })}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.code} className="border-b border-ct-line">
          <th scope="row" className="px-2 py-2 text-left font-medium">{row.code}</th>
          <td className="px-3 py-2 text-right">{row.configuredFunnels}</td>
          {salesValues(row).map((value, index) => <td key={labels[index]} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{value}</td>)}
        </tr>)}</tbody>
      </table>
    </div> : <p className="px-4 pb-4 text-sm text-ct-dim">Nenhum código encontrado.</p>}
  </section>;
}
