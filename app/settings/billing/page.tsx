"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, CheckCircle2, AlertTriangle, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Plan {
  id: string;
  name: string;
  amountInInr: number;
  seatLimit: number | null;
  description: string;
  features: string[];
}

interface BillingStatus {
  plan: string;
  subscriptionStatus: string;
  status: string;
  isBlocked: boolean;
  daysLeftInTrial: number | null;
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, statusRes] = await Promise.all([
        fetch("/api/billing/plans"),
        fetch("/api/billing/verify"),
      ]);
      const plansData = await plansRes.json();
      const statusData = await statusRes.json();
      setPlans(plansData.plans || []);
      setBilling(statusData);
    } catch {
      setError("Failed to load billing information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const checkoutStatus = searchParams.get("checkout");

  const handleSubscribe = async (planId: string) => {
    setError(null);
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout.");
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message);
      setBusyPlan(null);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal.");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setPortalBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="text-xs text-muted-foreground mt-1">Manage your plan and subscription.</p>
      </div>

      {checkoutStatus === "success" && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">
            Payment received — your subscription is activating. This can take a few seconds to reflect below.
          </AlertDescription>
        </Alert>
      )}
      {checkoutStatus === "cancelled" && (
        <Alert>
          <AlertDescription>Checkout was cancelled — no charge was made.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Current status</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Plan: {billing?.plan}</p>
                </div>
                {billing?.status === "trialing" && (
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25">
                    {billing.daysLeftInTrial} day{billing.daysLeftInTrial === 1 ? "" : "s"} left in trial
                  </Badge>
                )}
                {billing?.status === "active" && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25">Active</Badge>
                )}
                {billing?.status === "past_due" && (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">Payment past due</Badge>
                )}
                {(billing?.status === "trial_expired" || billing?.status === "canceled") && (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/25">
                    {billing.status === "trial_expired" ? "Trial expired" : "Cancelled"}
                  </Badge>
                )}
              </div>

              {billing?.isBlocked && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    AI agent usage is paused until you subscribe — the rest of your CRM data stays fully
                    accessible.
                  </AlertDescription>
                </Alert>
              )}

              {(billing?.status === "active" || billing?.status === "past_due") && (
                <Button variant="outline" onClick={handleManageBilling} isDisabled={portalBusy}>
                  {portalBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>Manage subscription, invoices & payment method</span>
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = billing?.plan === plan.id && billing?.status === "active";
              return (
                <Card key={plan.id} className={isCurrent ? "ring-2 ring-primary" : ""}>
                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      ₹{plan.amountInInr.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Badge className="w-full justify-center bg-primary/15 text-primary border-primary/25">
                        Current plan
                      </Badge>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(plan.id)}
                        isDisabled={busyPlan === plan.id}
                      >
                        {busyPlan === plan.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{billing?.status === "active" ? "Switch to this plan" : "Subscribe"}</span>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
