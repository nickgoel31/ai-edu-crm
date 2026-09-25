"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  GraduationCap,
  Bot,
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Flame,
  Sparkles,
  CircleDollarSign,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface DashboardSummary {
  generatedAt: string;
  leads: {
    activeCount: number;
    stageBreakdown: Record<string, number>;
    last7DaysCount: number;
    trend: { date: string; count: number }[];
  };
  students: {
    totalCount: number;
    enrolledActiveCount: number;
    stageBreakdown: Record<string, number>;
  };
  payments: {
    pendingCount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  agents: {
    liveCount: number;
    totalCount: number;
    conversationsToday: number;
    conversationsLast7Days: number;
  };
}

const LEAD_STAGE_META: Record<string, { label: string; color: string }> = {
  COLD: { label: "Cold", color: "bg-sky-500" },
  WARM: { label: "Warm", color: "bg-amber-500" },
  HOT: { label: "Hot", color: "bg-orange-500" },
  CONVERTING: { label: "Converting", color: "bg-emerald-500" },
};

const STUDENT_STAGE_META: Record<string, { label: string; color: string }> = {
  ENQUIRY: { label: "Enquiry", color: "bg-sky-500" },
  ENROLLED: { label: "Enrolled", color: "bg-violet-500" },
  ACTIVE: { label: "Active", color: "bg-emerald-500" },
  ALUMNI: { label: "Alumni", color: "bg-zinc-500" },
};

function AccessBanner() {
  const searchParams = useSearchParams();
  const accessDenied = searchParams.get("access_denied");

  if (accessDenied !== "admin_required") {
    return null;
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-300">
      <AlertCircle className="text-amber-400" />
      <AlertTitle className="text-amber-200">Access Restricted</AlertTitle>
      <AlertDescription className="text-amber-300">
        Organization settings and user management require an{" "}
        <span className="font-semibold text-amber-200">ADMIN</span> role. Counselor
        and Read-Only roles are restricted from accessing settings.
      </AlertDescription>
    </Alert>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={`p-1.5 rounded-lg border ${colorClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {sublabel && <span className="text-[11px] text-muted-foreground">{sublabel}</span>}
      </div>
    </Card>
  );
}

function StageBreakdownCard({
  title,
  breakdown,
  meta,
  total,
}: {
  title: string;
  breakdown: Record<string, number>;
  meta: Record<string, { label: string; color: string }>;
  total: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="space-y-2.5">
          {Object.entries(breakdown).map(([stage, count]) => {
            const info = meta[stage] || { label: stage, color: "bg-zinc-500" };
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={stage} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full ${info.color}`} />
                    {info.label}
                  </span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${info.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[220px] w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/summary");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load dashboard summary.");
        if (!cancelled) setSummary(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load dashboard summary.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!summary) return null;

  const isBrandNew =
    summary.leads.activeCount === 0 &&
    summary.students.totalCount === 0 &&
    summary.agents.totalCount === 0;

  if (isBrandNew) {
    return (
      <EmptyState
        icon={Sparkles}
        badge="Getting Started"
        title="Your workspace is ready"
        description="Once leads start flowing in and agents are deployed, this dashboard will fill up with live pipeline metrics, conversations, and payment insights."
        primaryAction={{ label: "Go to Leads", href: "/leads" }}
        secondaryAction={{ label: "Deploy an Agent", href: "/agents" }}
      />
    );
  }

  const leadStudentTotal =
    Object.values(summary.leads.stageBreakdown).reduce((a, b) => a + b, 0) || 0;
  const studentTotal =
    Object.values(summary.students.stageBreakdown).reduce((a, b) => a + b, 0) || 0;

  return (
    <div className="space-y-6">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Active Leads"
          value={summary.leads.activeCount}
          sublabel={`+${summary.leads.last7DaysCount} this week`}
          icon={Flame}
          colorClass="bg-orange-500/15 text-orange-500 border-orange-500/25"
        />
        <KpiCard
          label="Enrolled / Active Students"
          value={summary.students.enrolledActiveCount}
          sublabel={`${summary.students.totalCount} total`}
          icon={GraduationCap}
          colorClass="bg-violet-500/15 text-violet-500 border-violet-500/25"
        />
        <KpiCard
          label="Live AI Agents"
          value={summary.agents.liveCount}
          sublabel={`/ ${summary.agents.totalCount} agents`}
          icon={Bot}
          colorClass="bg-rose-500/15 text-rose-500 border-rose-500/25"
        />
        <KpiCard
          label="Conversations Today"
          value={summary.agents.conversationsToday}
          sublabel={`${summary.agents.conversationsLast7Days} this week`}
          icon={MessageSquare}
          colorClass="bg-blue-500/15 text-blue-500 border-blue-500/25"
        />
      </div>

      {/* Payments Alert Strip (only when there's something to flag) */}
      {(summary.payments.overdueCount > 0 || summary.payments.pendingCount > 0) && (
        <Card className="flex-row items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <CircleDollarSign className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {summary.payments.overdueCount > 0
                  ? `${summary.payments.overdueCount} overdue payment${summary.payments.overdueCount === 1 ? "" : "s"}`
                  : `${summary.payments.pendingCount} pending payment${summary.payments.pendingCount === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.payments.overdueCount > 0
                  ? `₹${summary.payments.overdueAmount.toLocaleString("en-IN")} overdue across fee installments.`
                  : "Awaiting collection this cycle."}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
            Review <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </Card>
      )}

      {/* Trend Chart + Stage Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Lead Creation — Last 7 Days
              </h3>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.leads.trend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val: any) =>
                      new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(val: any) => new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    formatter={(value: any) => [`${value} leads`, "Created"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#leadTrendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <StageBreakdownCard
          title="Lead Pipeline"
          breakdown={summary.leads.stageBreakdown}
          meta={LEAD_STAGE_META}
          total={leadStudentTotal}
        />
      </div>

      <StageBreakdownCard
        title="Student Lifecycle"
        breakdown={summary.students.stageBreakdown}
        meta={STUDENT_STAGE_META}
        total={studentTotal}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Access Denied Warning if redirected from settings */}
      <Suspense fallback={null}>
        <AccessBanner />
      </Suspense>

      {/* Welcome header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          CRM Workspace Overview
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Live admissions pipeline, student lifecycle, and AI agent activity for your organization.
        </p>
      </div>

      {/* First-Run Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Live Analytics Dashboard */}
      <DashboardOverview />
    </div>
  );
}
