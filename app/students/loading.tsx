export default function StudentsLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-[#27272a]/70 rounded-md w-48" />
        <div className="h-8 bg-[#27272a]/70 rounded-md w-28" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card border border-border rounded-xl p-3 flex flex-col justify-between">
            <div className="h-3 bg-[#27272a]/70 rounded w-1/3" />
            <div className="h-5 bg-[#27272a]/70 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="h-10 bg-muted/40 rounded-lg w-full" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 bg-muted/40/60 rounded-lg border border-border/40" />
        ))}
      </div>
    </div>
  );
}

