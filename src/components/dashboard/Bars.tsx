export default function Bars({ rows, color = "#3b82f6" }: { rows: { label: string; value: number; pct: number }[]; color?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ct-dim">Sem dados ainda.</p>;
  return (
    <div className="space-y-2.5">
      {/* key com índice: funis podem ter o MESMO nome (ex. duplicatas) */}
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span className="min-w-0 truncate font-medium text-ct-ink" title={r.label}>{r.label}</span><span className="shrink-0 text-ct-dim">{r.value} · {r.pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-ct-raised"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}
