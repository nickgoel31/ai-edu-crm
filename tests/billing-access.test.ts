import { describe, it, expect } from "vitest";
import { getBillingGate } from "@/lib/billing/access";

describe("getBillingGate", () => {
  it("allows an ACTIVE subscription", () => {
    const gate = getBillingGate({ subscriptionStatus: "ACTIVE", trialEndsAt: null });
    expect(gate.status).toBe("active");
    expect(gate.isBlocked).toBe(false);
  });

  it("allows PAST_DUE as a grace period, not a hard block", () => {
    const gate = getBillingGate({ subscriptionStatus: "PAST_DUE", trialEndsAt: null });
    expect(gate.isBlocked).toBe(false);
  });

  it("blocks a CANCELED subscription", () => {
    const gate = getBillingGate({ subscriptionStatus: "CANCELED", trialEndsAt: null });
    expect(gate.isBlocked).toBe(true);
  });

  it("allows TRIALING with time left and reports days remaining", () => {
    const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const gate = getBillingGate({ subscriptionStatus: "TRIALING", trialEndsAt });
    expect(gate.status).toBe("trialing");
    expect(gate.isBlocked).toBe(false);
    expect(gate.daysLeftInTrial).toBeGreaterThanOrEqual(4);
    expect(gate.daysLeftInTrial).toBeLessThanOrEqual(5);
  });

  it("blocks TRIALING once trialEndsAt has passed", () => {
    const trialEndsAt = new Date(Date.now() - 60 * 1000);
    const gate = getBillingGate({ subscriptionStatus: "TRIALING", trialEndsAt });
    expect(gate.status).toBe("trial_expired");
    expect(gate.isBlocked).toBe(true);
    expect(gate.daysLeftInTrial).toBe(0);
  });

  it("treats a TRIALING org with no trialEndsAt as active (legacy safety net)", () => {
    const gate = getBillingGate({ subscriptionStatus: "TRIALING", trialEndsAt: null });
    expect(gate.isBlocked).toBe(false);
  });
});
