"use client";

import { useEffect, useState } from "react";
import { Loader2, Building2, TrendingUp, AlertTriangle, Users, MessageSquare, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Tenant {
  id: string;
  name: string;
  plan: string;
  planName: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  userCount: number;
  leadCount: number;
  studentCount: number;
  conversationsThisMonth: number;
  aiCostThisMonthPaise: number;
  lastActivityAt: string | null;
  isChurnRisk: boolean;
}

interface Overview {
  summary: {
    totalTenants: number;
    activeCount: number;
    trialingCount: number;
    pastDueCount: number;
    canceledCount: number;
    trialsExpiringSoon: number;
    mrrRupees: string;
    churnRiskCount: number;
  };
  tenants: Tenant[];
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  TRIALING: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  PAST_DUE: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  CANCELED: "bg-destructive/15 text-destructive border-destructive/25",
};

export default function VendorDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendor/overview")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load.");
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground m-8" />;

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendor Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-1">Cross-tenant health, MRR, and churn risk.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-2xs"><IndianRupee className="w-3.5 h-3.5" /> MRR</div>
            <div className="text-xl font-bold text-foreground">₹{Number(data.summary.mrrRupees).toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-2xs"><Building2 className="w-3.5 h-3.5" /> Tenants</div>
            <div className="text-xl font-bold text-foreground">{data.summary.totalTenants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-2xs"><TrendingUp className="w-3.5 h-3.5" /> Active</div>
            <div className="text-xl font-bold text-emerald-500">{data.summary.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-2xs">Trials ending &lt;7d</div>
            <div className="text-xl font-bold text-amber-500">{data.summary.trialsExpiringSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-2xs"><AlertTriangle className="w-3.5 h-3.5" /> Churn risk</div>
            <div className="text-xl font-bold text-destructive">{data.summary.churnRiskCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-2xs uppercase">
                <th className="text-left font-medium px-4 py-2.5">Organization</th>
                <th className="text-left font-medium px-4 py-2.5">Plan</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Seats</th>
                <th className="text-right font-medium px-4 py-2.5">Leads</th>
                <th className="text-right font-medium px-4 py-2.5">Convos (mo)</th>
                <th className="text-right font-medium px-4 py-2.5">AI cost (mo)</th>
                <th className="text-left font-medium px-4 py-2.5">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr key={t.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {t.name}
                    {t.isChurnRisk && (
                      <Badge className="ml-2 bg-destructive/15 text-destructive border-destructive/25">
                        churn risk
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.planName}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={STATUS_BADGE[t.subscriptionStatus] || ""}>{t.subscriptionStatus}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{t.userCount}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{t.leadCount}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{t.conversationsThisMonth}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    ₹{(t.aiCostThisMonthPaise / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
