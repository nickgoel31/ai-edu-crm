export default function AgentDetailLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-[#27272a]/70 rounded-md w-56" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
            <div className="h-4 bg-[#27272a]/70 rounded w-1/3" />
            <div className="h-6 bg-[#27272a]/70 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="h-6 bg-[#27272a]/70 rounded w-1/2" />
            <div className="h-4 bg-[#27272a]/50 rounded w-3/4" />
            <div className="h-20 bg-muted/40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

