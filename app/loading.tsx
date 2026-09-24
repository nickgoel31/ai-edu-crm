export default function GlobalLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-[#27272a]/70 rounded-md w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
            <div className="h-4 bg-[#27272a]/70 rounded w-1/2" />
            <div className="h-7 bg-[#27272a]/70 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="h-96 bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="h-6 bg-[#27272a]/70 rounded w-1/3" />
        <div className="h-72 bg-muted/40 rounded-lg" />
      </div>
    </div>
  );
}

