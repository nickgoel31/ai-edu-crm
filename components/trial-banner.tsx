"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle, Clock } from "lucide-react";

interface BillingStatus {
  status: string;
  daysLeftInTrial: number | null;
}

// Compact, session-only-dismissible banner so a trialing/expired admin
// always has a visible path to Settings -> Billing, without gating any
// page load on billing state.
export function TrialBanner() {
  const { data: session } = useSession();
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") return;
    fetch("/api/billing/verify")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBilling)
      .catch(() => {});
  }, [session?.user?.role]);

  if (!billing || session?.user?.role !== "ADMIN") return null;
  if (billing.status !== "trialing" && billing.status !== "trial_expired") return null;
  if (billing.status === "trialing" && (billing.daysLeftInTrial ?? 99) > 3) return null;

  const expired = billing.status === "trial_expired";

  return (
    <Link
      href="/settings/billing"
      className={`flex items-center justify-center gap-2 px-4 py-1.5 text-2xs font-medium transition-colors ${
        expired
          ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
      }`}
    >
      {expired ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      <span>
        {expired
          ? "Your trial has ended — AI agents are paused. Add a payment method to resume."
          : `${billing.daysLeftInTrial} day${billing.daysLeftInTrial === 1 ? "" : "s"} left in your trial.`}
      </span>
      <span className="underline underline-offset-2">Manage billing →</span>
    </Link>
  );
}
