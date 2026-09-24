import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function CardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-skeleton"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        className
      )}
      {...props}
    >
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

function KanbanSkeleton({
  columns = 5,
  cardsPerCol = 3,
  className,
}: {
  columns?: number
  cardsPerCol?: number
  className?: string
}) {
  return (
    <div
      data-slot="kanban-skeleton"
      className={cn(
        "grid gap-4 overflow-x-auto pb-6",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(240px, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-3 bg-[#171717] rounded-2xl border border-[#262626] p-3 min-h-[560px]">
          {/* Column Header */}
          <div className="flex items-center justify-between px-1 py-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <Skeleton className="size-4 rounded" />
          </div>
          {/* Plus action */}
          <Skeleton className="h-10 w-full rounded-xl bg-[#202020]" />
          {/* Cards */}
          {Array.from({ length: cardsPerCol }).map((_, cardIdx) => (
            <div key={cardIdx} className="flex flex-col gap-2 rounded-xl border border-[#2e2e2e] bg-[#202020] p-4">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <div className="flex items-center justify-between pt-3 mt-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-5 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div
      data-slot="table-skeleton"
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        className
      )}
    >
      <div className="flex gap-4 border-b border-border bg-muted/40 p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border p-3 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export { Skeleton, CardSkeleton, KanbanSkeleton, TableSkeleton }
