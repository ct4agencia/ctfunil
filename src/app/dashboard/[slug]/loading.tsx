/** Skeleton da performance por funil (5 cards + funil + tráfego). */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] px-6 py-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-neutral-200" />
          <div className="h-6 w-64 rounded-md bg-neutral-200" />
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="h-3 w-24 rounded bg-neutral-200" />
              <div className="mt-3 h-6 w-14 rounded bg-neutral-200" />
              <div className="mt-3 h-3 w-20 rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-96 rounded-xl border border-neutral-200 bg-white p-5">
              <div className="h-3 w-28 rounded bg-neutral-200" />
              <div className="mt-6 h-64 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
