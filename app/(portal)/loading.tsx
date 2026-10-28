/** Shown at once while a menu opens, so the page never looks blank or stuck. */
export default function PortalLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-9 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
