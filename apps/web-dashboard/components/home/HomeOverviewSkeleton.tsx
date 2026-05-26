/** Suspense fallback while home overview data loads (streaming RSC). */
export function HomeOverviewSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-busy aria-label="Loading dashboard">
      <div className="rounded-lg border border-app-border bg-shell-header px-3 py-5 shadow-sm">
        <div className="h-3 w-28 rounded bg-app-fill" />
        <div className="mt-3 h-7 w-full max-w-xl rounded bg-app-fill" />
        <div className="mt-2 h-6 w-4/5 max-w-md rounded bg-app-fill/90" />
      </div>

      <div className="rounded-lg border border-app-border border-l-[3px] border-l-shell-edge-ops bg-shell-ops px-2 py-3 shadow-sm">
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[2.75rem] min-w-0 flex-1 basis-0 items-center justify-between rounded-lg border border-app-border/70 bg-app-surface/40 px-1.5 py-1.5"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2 w-16 rounded bg-app-fill/80" />
                <div className="h-3 w-20 rounded bg-app-fill" />
              </div>
              {(i < 2 || i === 5) && (
                <div className="ml-1 h-7 w-11 shrink-0 rounded bg-app-fill/60" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-app-border border-t-[3px] border-t-shell-edge-agents bg-shell-agents px-2 py-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
          <div className="h-28 rounded-xl border border-app-border bg-app-surface/50" />
          <div className="h-28 rounded-xl border border-app-border bg-app-surface/50" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-app-border bg-app-surface/40" />
          ))}
        </div>
        <div className="mt-4 h-10 rounded-lg border border-app-border bg-app-surface/50" />
      </div>

      <div className="rounded-lg border border-app-border border-l-[3px] border-l-shell-edge-work bg-shell-work p-3 shadow-md">
        <div className="h-3 w-32 rounded bg-app-fill" />
        <div className="mt-2 h-8 w-full rounded-md bg-app-fill" />
        <div className="mt-2 h-32 rounded-md bg-app-fill/80" />
      </div>
    </div>
  );
}
