/** Skeleton do dashboard — feedback instantâneo enquanto as métricas computam. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] px-6 py-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-7 w-40 rounded-md bg-neutral-200" />
          <div className="h-9 w-32 rounded-lg bg-neutral-200" />
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="h-3 w-24 rounded bg-neutral-200" />
              <div className="mt-3 h-6 w-16 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        <div className="mb-4 h-5 w-32 rounded bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="h-4 w-3/4 rounded bg-neutral-200" />
              <div className="mt-2 h-3 w-24 rounded bg-neutral-200" />
              <div className="mt-4 h-5 w-20 rounded-full bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
