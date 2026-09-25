export interface OrgBillingSubset {
  subscriptionStatus: string;
  trialEndsAt: Date | string | null;
}

export interface BillingGate {
  status: "trialing" | "active" | "past_due" | "canceled" | "trial_expired";
  isBlocked: boolean; // true once AI/agent usage (real cost) should be refused
  daysLeftInTrial: number | null;
}

/**
 * Single source of truth for "is this org allowed to keep incurring AI
 * usage cost". A trial that has run out with no active subscription
 * behind it blocks paid-cost actions (LLM calls) but does NOT lock the
 * org out of the CRM itself — leads/students/reports keep working so a
 * lapsed trial doesn't strand the customer's data.
 */
export function getBillingGate(org: OrgBillingSubset): BillingGate {
  const status = org.subscriptionStatus;

  if (status === "ACTIVE") {
    return { status: "active", isBlocked: false, daysLeftInTrial: null };
  }
  if (status === "PAST_DUE") {
    // Grace period: still allowed, surfaced as a warning elsewhere.
    return { status: "past_due", isBlocked: false, daysLeftInTrial: null };
  }
  if (status === "CANCELED") {
    return { status: "canceled", isBlocked: true, daysLeftInTrial: null };
  }

  // TRIALING (or any other/legacy status) falls through to trial math.
  const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  if (!trialEndsAt) {
    // No trial end date recorded (legacy org) — treat as active rather
    // than retroactively locking out an existing paying-by-convention org.
    return { status: "active", isBlocked: false, daysLeftInTrial: null };
  }

  const msLeft = trialEndsAt.getTime() - Date.now();
  if (msLeft <= 0) {
    return { status: "trial_expired", isBlocked: true, daysLeftInTrial: 0 };
  }

  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { status: "trialing", isBlocked: false, daysLeftInTrial: daysLeft };
}
