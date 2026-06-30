import { cn } from "@/lib/utils";

export function PageLoading({
  statCards = 4,
  rowCount = 5,
}: {
  statCards?: number;
  rowCount?: number;
}) {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-full bg-muted" />
          <div className="h-9 w-56 rounded-xl bg-muted" />
          <div className="h-4 w-80 max-w-full rounded-full bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-xl bg-muted" />
          <div className="h-10 w-28 rounded-xl bg-muted" />
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          statCards <= 4 ? "xl:grid-cols-4" : "xl:grid-cols-5",
        )}
      >
        {Array.from({ length: statCards }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="h-4 w-24 rounded-full bg-muted" />
                <div className="h-8 w-28 rounded-xl bg-muted" />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded-xl bg-muted" />
            <div className="h-4 w-72 max-w-full rounded-full bg-muted" />
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: rowCount }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-4 w-44 rounded-full bg-muted" />
                    <div className="h-3 w-56 max-w-full rounded-full bg-muted" />
                  </div>
                  <div className="h-4 w-14 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <div className="h-6 w-32 rounded-xl bg-muted" />
            <div className="h-4 w-56 max-w-full rounded-full bg-muted" />
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
