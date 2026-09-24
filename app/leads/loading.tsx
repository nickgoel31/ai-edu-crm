export default function LeadsLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-[#27272a]/70 rounded-md w-48" />
        <div className="h-8 bg-[#27272a]/70 rounded-md w-36" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-card border border-border rounded-xl p-3 flex flex-col justify-between">
            <div className="h-3 bg-[#27272a]/70 rounded w-1/3" />
            <div className="h-5 bg-[#27272a]/70 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="bg-card border border-border p-3 rounded-xl min-h-[480px] space-y-3">
            <div className="h-6 bg-[#27272a]/70 rounded-md w-24" />
            <div className="h-28 bg-muted/40 border border-border/60 rounded-lg p-3 space-y-2">
              <div className="h-4 bg-[#27272a]/70 rounded w-3/4" />
              <div className="h-3 bg-[#27272a]/50 rounded w-1/2" />
            </div>
            <div className="h-28 bg-muted/40 border border-border/60 rounded-lg p-3 space-y-2">
              <div className="h-4 bg-[#27272a]/70 rounded w-3/4" />
              <div className="h-3 bg-[#27272a]/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

