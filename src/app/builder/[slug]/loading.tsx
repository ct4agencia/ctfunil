/** Skeleton do builder — o resolveFunnel baixa o funil inteiro (steps JSONB). */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f9]">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl animate-pulse items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-20 rounded-md bg-neutral-200" />
            <div className="h-5 w-56 rounded-md bg-neutral-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-md bg-neutral-200" />
            <div className="h-8 w-24 rounded-md bg-neutral-200" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl flex-1 animate-pulse gap-4 p-4 lg:grid-cols-[240px_1fr_300px]">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white" />
          ))}
        </div>
        <div className="rounded-xl bg-white" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
