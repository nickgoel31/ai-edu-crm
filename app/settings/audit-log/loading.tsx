export default function AuditLogLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-[#27272a]/70 rounded-md w-48" />
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="h-10 bg-muted/40 rounded-lg w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted/40/60 rounded-lg border border-border/40" />
        ))}
      </div>
    </div>
  );
}

