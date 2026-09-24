export default function LeadDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-6 bg-[#27272a]/70 rounded-md w-32" />
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="h-8 bg-[#27272a]/70 rounded-md w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-20 bg-muted/40 rounded-lg border border-border/50" />
          <div className="h-20 bg-muted/40 rounded-lg border border-border/50" />
          <div className="h-20 bg-muted/40 rounded-lg border border-border/50" />
        </div>
      </div>
    </div>
  );
}

