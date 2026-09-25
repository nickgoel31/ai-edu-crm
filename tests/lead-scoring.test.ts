import { describe, it, expect } from "vitest";
import { evaluateRule, calculateLeadScore, extractLeadFieldValue } from "@/lib/lead-scoring";
import { ScoringOperator } from "@/types";

const baseLead = {
  id: "lead_1",
  source: "META_ADS",
  stage: "WARM",
  name: "Test Lead",
  email: "test@example.com",
  phone: "9820123456",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("extractLeadFieldValue", () => {
  it("reads a direct lead field", () => {
    expect(extractLeadFieldValue("source", { lead: baseLead })).toBe("META_ADS");
  });

  it("computes daysSinceLastActivity from the lead's updatedAt when there are no activities", () => {
    const lead = { ...baseLead, updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() };
    const days = extractLeadFieldValue("daysSinceLastActivity", { lead });
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it("falls back to a custom field when the key isn't a known standard field", () => {
    const value = extractLeadFieldValue("budget_range", {
      lead: baseLead,
      customFields: { budget_range: "50k-100k" },
    });
    expect(value).toBe("50k-100k");
  });
});

describe("evaluateRule", () => {
  it("matches EQUALS case-insensitively", () => {
    const rule = { field: "source", operator: ScoringOperator.EQUALS, value: "meta_ads" };
    expect(evaluateRule(rule, { lead: baseLead })).toBe(true);
  });

  it("does not match a wrong EQUALS value", () => {
    const rule = { field: "source", operator: ScoringOperator.EQUALS, value: "WHATSAPP" };
    expect(evaluateRule(rule, { lead: baseLead })).toBe(false);
  });

  it("evaluates GREATER_THAN numerically, not lexically", () => {
    const rule = { field: "hasConversations", operator: ScoringOperator.GREATER_THAN, value: "9" };
    expect(evaluateRule(rule, { lead: baseLead, conversations: Array(10).fill({}) })).toBe(true);
    expect(evaluateRule(rule, { lead: baseLead, conversations: Array(2).fill({}) })).toBe(false);
  });

  it("returns false for a non-numeric comparison on GREATER_THAN", () => {
    const rule = { field: "name", operator: ScoringOperator.GREATER_THAN, value: "5" };
    expect(evaluateRule(rule, { lead: baseLead })).toBe(false);
  });
});

describe("calculateLeadScore", () => {
  const rules = [
    { id: "r1", name: "Meta lead", field: "source", operator: ScoringOperator.EQUALS, value: "META_ADS", points: 20, enabled: true, displayOrder: 1 },
    { id: "r2", name: "Warm stage", field: "stage", operator: ScoringOperator.EQUALS, value: "WARM", points: 10, enabled: true, displayOrder: 2 },
    { id: "r3", name: "Disabled rule", field: "source", operator: ScoringOperator.EQUALS, value: "META_ADS", points: 999, enabled: false, displayOrder: 3 },
  ] as any;

  it("sums points from matching enabled rules onto the base score", () => {
    const { totalScore, breakdown } = calculateLeadScore(rules, { lead: baseLead }, 50);
    expect(totalScore).toBe(80); // 50 + 20 + 10
    expect(breakdown).toHaveLength(2);
  });

  it("ignores disabled rules even if they would match", () => {
    const { breakdown } = calculateLeadScore(rules, { lead: baseLead }, 50);
    expect(breakdown.find((b) => b.ruleId === "r3")).toBeUndefined();
  });

  it("clamps the final score to [0, 100]", () => {
    const bigRules = [{ id: "r1", name: "huge", field: "source", operator: ScoringOperator.EQUALS, value: "META_ADS", points: 500, enabled: true, displayOrder: 1 }] as any;
    expect(calculateLeadScore(bigRules, { lead: baseLead }, 50).totalScore).toBe(100);

    const negRules = [{ id: "r1", name: "huge neg", field: "source", operator: ScoringOperator.EQUALS, value: "META_ADS", points: -500, enabled: true, displayOrder: 1 }] as any;
    expect(calculateLeadScore(negRules, { lead: baseLead }, 50).totalScore).toBe(0);
  });
});
