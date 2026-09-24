export default function ReportsLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-[#27272a]/70 rounded-md w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-80 bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="h-6 bg-[#27272a]/70 rounded w-1/3" />
          <div className="h-56 bg-muted/40 rounded-lg" />
        </div>
        <div className="h-80 bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="h-6 bg-[#27272a]/70 rounded w-1/3" />
          <div className="h-56 bg-muted/40 rounded-lg" />
        </div>
      </div>
      <div className="h-72 bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="h-6 bg-[#27272a]/70 rounded w-1/4" />
        <div className="h-48 bg-muted/40 rounded-lg" />
      </div>
    </div>
  );
}

