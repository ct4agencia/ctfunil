"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Lead } from "@/lib/types";

const EXPORT_COLS: (keyof Lead)[] = [
  "created_at",
  "name",
  "phone",
  "email",
  "code",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "src",
  "xcod",
  "fbclid",
  "ctwa_clid",
  "source_id",
  "fbp",
  "fbc",
  "platform",
  "viewport",
  "screen",
  "user_agent",
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function LeadsToolbar({
  leads,
  from,
  to,
}: {
  leads: Lead[];
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function applyFilter() {
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }
  function clearFilter() {
    setF("");
    setT("");
    router.push(pathname);
  }

  function exportCsv() {
    const header = EXPORT_COLS.join(",");
    const rows = leads.map((l) =>
      EXPORT_COLS.map((c) => csvCell(l[c])).join(","),
    );
    const csv = "﻿" + header + "\n" + rows.join("\n"); // BOM p/ acento no Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads${from ? "-" + from : ""}${to ? "-" + to : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">De</span>
        <input type="date" className={inputCls} value={f} onChange={(e) => setF(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Até</span>
        <input type="date" className={inputCls} value={t} onChange={(e) => setT(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={applyFilter}
        className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
      >
        Filtrar
      </button>
      {(from || to) && (
        <button
          type="button"
          onClick={clearFilter}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Limpar
        </button>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={exportCsv}
        disabled={leads.length === 0}
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
      >
        ⬇ Exportar CSV ({leads.length})
      </button>
    </div>
  );
}
