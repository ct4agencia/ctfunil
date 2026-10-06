/** Skeleton do analytics — o globalAnalytics agrega todos os funis (fetch pesado). */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] px-6 py-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-6 h-7 w-48 rounded-md bg-neutral-200" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="h-3 w-24 rounded bg-neutral-200" />
              <div className="mt-3 h-6 w-16 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 rounded-xl border border-neutral-200 bg-white p-5">
            <div className="h-3 w-28 rounded bg-neutral-200" />
            <div className="mt-6 h-48 rounded bg-neutral-100" />
          </div>
          <div className="h-72 rounded-xl border border-neutral-200 bg-white p-5">
            <div className="h-3 w-28 rounded bg-neutral-200" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-neutral-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
