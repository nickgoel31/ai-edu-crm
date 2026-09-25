"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Loader2,
  Network,
  Users,
  GraduationCap,
  Bot,
  MessageSquare,
  IndianRupee,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BranchSummary {
  id: string;
  name: string;
  slug: string;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  activeLeadsCount: number;
  studentsTotalCount: number;
  studentsEnrolledActiveCount: number;
  agentsLiveCount: number;
  agentsTotalCount: number;
  conversationsLast7DaysCount: number;
  overduePaymentsAmount: number;
}

interface HqSummary extends Omit<BranchSummary, "brandLogoUrl" | "brandPrimaryColor"> {}

interface OverviewResponse {
  isFranchiseHQ: boolean;
  hq?: HqSummary;
  branches?: BranchSummary[];
  totals?: Omit<BranchSummary, "id" | "name" | "slug" | "brandLogoUrl" | "brandPrimaryColor">;
}

function BranchCard({ branch }: { branch: BranchSummary }) {
  return (
    <Card
      className="overflow-hidden"
      style={
        branch.brandPrimaryColor
          ? { borderTop: `3px solid ${branch.brandPrimaryColor}` }
          : undefined
      }
    >
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          {branch.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branch.brandLogoUrl}
              alt={`${branch.name} logo`}
              className="w-9 h-9 rounded-lg object-cover border border-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center border border-border">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{branch.name}</h3>
            <p className="text-2xs text-muted-foreground font-mono">{branch.slug}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-muted-foreground block">Active Leads</span>
            <span className="font-bold text-foreground">{branch.activeLeadsCount}</span>
          </div>
          <div className="p-2 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-muted-foreground block">Students</span>
            <span className="font-bold text-foreground">
              {branch.studentsEnrolledActiveCount}/{branch.studentsTotalCount}
            </span>
          </div>
          <div className="p-2 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-muted-foreground block">Live Agents</span>
            <span className="font-bold text-foreground">
              {branch.agentsLiveCount}/{branch.agentsTotalCount}
            </span>
          </div>
          <div className="p-2 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-muted-foreground block">Overdue Fees</span>
            <span className="font-bold text-amber-500">
              ₹{branch.overduePaymentsAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-2xs text-muted-foreground italic border-t border-border/60 pt-2">
          Branch admins log into their own organization's dashboard to manage this branch directly.
        </p>
      </CardContent>
    </Card>
  );
}

export default function FranchisePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/franchise/overview");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load franchise overview.");
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm font-medium">Loading franchise overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data?.isFranchiseHQ) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <Network className="w-10 h-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold text-foreground">This isn't a franchise HQ</h2>
        <p className="text-sm text-muted-foreground">
          A franchise roll-up shows aggregated metrics — leads, students, agents, conversations —
          across every branch of a multi-location coaching business. Your organization becomes a
          franchise HQ automatically once one or more other organizations are linked to it as
          branches.
        </p>
        <Link
          href="/settings/organization"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Settings className="w-4 h-4" />
          <span>Link a Branch in Organization Settings</span>
        </Link>
      </div>
    );
  }

  const { hq, branches = [], totals } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Network className="w-6 h-6 text-primary" />
          <span>Franchise Roll-Up</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Aggregated metrics across your headquarters and {branches.length} branch
          {branches.length === 1 ? "" : "es"}.
        </p>
      </div>

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 space-y-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-2xs text-muted-foreground block">Active Leads</span>
              <span className="text-lg font-bold text-foreground">{totals.activeLeadsCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <GraduationCap className="w-4 h-4 text-emerald-500" />
              <span className="text-2xs text-muted-foreground block">Enrolled/Active</span>
              <span className="text-lg font-bold text-foreground">
                {totals.studentsEnrolledActiveCount}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xs text-muted-foreground block">Total Students</span>
              <span className="text-lg font-bold text-foreground">{totals.studentsTotalCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <Bot className="w-4 h-4 text-purple-500" />
              <span className="text-2xs text-muted-foreground block">Live Agents</span>
              <span className="text-lg font-bold text-foreground">
                {totals.agentsLiveCount}/{totals.agentsTotalCount}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <MessageSquare className="w-4 h-4 text-cyan-500" />
              <span className="text-2xs text-muted-foreground block">Conversations (7d)</span>
              <span className="text-lg font-bold text-foreground">
                {totals.conversationsLast7DaysCount}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <IndianRupee className="w-4 h-4 text-amber-500" />
              <span className="text-2xs text-muted-foreground block">Overdue Fees</span>
              <span className="text-lg font-bold text-amber-500">
                ₹{totals.overduePaymentsAmount.toLocaleString()}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {hq && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Headquarters
          </h2>
          <BranchCard
            branch={{
              ...hq,
              brandLogoUrl: null,
              brandPrimaryColor: null,
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Branches ({branches.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <BranchCard key={b.id} branch={b} />
          ))}
        </div>
      </div>
    </div>
  );
}
