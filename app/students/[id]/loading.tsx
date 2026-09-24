export default function StudentDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-6 bg-[#27272a]/70 rounded-md w-24" />
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="h-8 bg-[#27272a]/70 rounded-md w-1/3" />
        <div className="h-10 bg-muted/40 rounded-md w-1/2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-card p-6 rounded-xl border border-border h-96 space-y-4">
          <div className="h-6 bg-[#27272a]/70 rounded w-1/4" />
          <div className="h-64 bg-muted/40 rounded-lg" />
        </div>
        <div className="bg-card p-6 rounded-xl border border-border h-96 space-y-4">
          <div className="h-6 bg-[#27272a]/70 rounded w-1/3" />
          <div className="h-64 bg-muted/40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

