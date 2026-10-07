import { cn } from "@/lib/cn";

/** Placeholder shape shown while real content loads. Matches the final layout so nothing jumps. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--color-cream)_0%,#efebe2_45%,var(--color-cream)_90%)]",
        className,
      )}
    />
  );
}

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3.5 w-1/2" />
      <div className="mt-1 flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function BookGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading books" className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/3" : "w-1/6")} />
          ))}
        </div>
      ))}
    </div>
  );
}
