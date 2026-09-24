import { prisma } from "@/lib/prisma";
import { ScoringRule, ScoringOperator, ScoreBreakdownItem } from "@/types";

export const DEFAULT_SCORING_RULE_SUGGESTIONS = [
  {
    name: "Inbound Meta Ad Lead",
    field: "source",
    operator: ScoringOperator.EQUALS,
    value: "META_ADS",
    points: 20,
    enabled: true,
    displayOrder: 1,
  },
  {
    name: "Inbound WhatsApp Lead",
    field: "source",
    operator: ScoringOperator.EQUALS,
    value: "WHATSAPP",
    points: 15,
    enabled: true,
    displayOrder: 2,
  },
  {
    name: "Lead Has Replied / Engaged",
    field: "hasReplied",
    operator: ScoringOperator.EQUALS,
    value: "true",
    points: 25,
    enabled: true,
    displayOrder: 3,
  },
  {
    name: "Active Conversation History",
    field: "hasConversations",
    operator: ScoringOperator.GREATER_THAN,
    value: "1",
    points: 15,
    enabled: true,
    displayOrder: 4,
  },
  {
    name: "Warm Stage Lead",
    field: "stage",
    operator: ScoringOperator.EQUALS,
    value: "WARM",
    points: 10,
    enabled: true,
    displayOrder: 5,
  },
  {
    name: "Hot Stage Lead",
    field: "stage",
    operator: ScoringOperator.EQUALS,
    value: "HOT",
    points: 20,
    enabled: true,
    displayOrder: 6,
  },
  {
    name: "Stalled in Stage > 7 Days",
    field: "daysInCurrentStage",
    operator: ScoringOperator.GREATER_THAN,
    value: "7",
    points: -15,
    enabled: true,
    displayOrder: 7,
  },
  {
    name: "No Activity in > 14 Days",
    field: "daysSinceLastActivity",
    operator: ScoringOperator.GREATER_THAN,
    value: "14",
    points: -20,
    enabled: true,
    displayOrder: 8,
  },
];

export interface LeadScoringContext {
  lead: any;
  activities?: any[];
  conversations?: any[];
  customFields?: Record<string, any>;
}

/**
 * Extracts evaluation values for standard and computed lead fields.
 */
export function extractLeadFieldValue(
  field: string,
  context: LeadScoringContext
): any {
  const { lead, activities = [], conversations = [], customFields = {} } = context;
  const now = Date.now();

  switch (field) {
    case "source":
      return lead.source || "";
    case "stage":
      return lead.stage || "";
    case "name":
      return lead.name || "";
    case "email":
      return lead.email || "";
    case "phone":
      return lead.phone || "";
    case "daysInCurrentStage": {
      // Find latest stage change activity or fall back to lead.updatedAt
      const stageChangeActivity = activities.find(
        (a) => a.type === "STAGE_CHANGE"
      );
      const stageDate = stageChangeActivity
        ? new Date(stageChangeActivity.createdAt).getTime()
        : new Date(lead.updatedAt || lead.createdAt).getTime();
      return Math.max(0, Math.floor((now - stageDate) / (1000 * 60 * 60 * 24)));
    }
    case "daysSinceLastActivity": {
      let lastActivityTime = new Date(lead.updatedAt || lead.createdAt).getTime();
      if (activities.length > 0) {
        const latestActivityTime = new Date(activities[0].createdAt).getTime();
        if (latestActivityTime > lastActivityTime) {
          lastActivityTime = latestActivityTime;
        }
      }
      return Math.max(0, Math.floor((now - lastActivityTime) / (1000 * 60 * 60 * 24)));
    }
    case "hasReplied": {
      // Check if any conversation has outcome other than NO_RESPONSE or has inbound messages
      const replied = conversations.some(
        (c) => c.outcome && c.outcome !== "NO_RESPONSE"
      );
      return replied ? "true" : "false";
    }
    case "hasConversations": {
      return conversations.length;
    }
    default: {
      // Custom field lookup
      if (customFields[field] !== undefined) {
        return customFields[field];
      }
      return lead[field] !== undefined ? lead[field] : null;
    }
  }
}

/**
 * Evaluates whether a rule matches the lead's context.
 */
export function evaluateRule(
  rule: { field: string; operator: string; value: string },
  context: LeadScoringContext
): boolean {
  const actualValue = extractLeadFieldValue(rule.field, context);
  if (actualValue === null || actualValue === undefined) {
    return false;
  }

  const targetValue = rule.value;

  switch (rule.operator) {
    case ScoringOperator.EQUALS:
      return (
        String(actualValue).trim().toLowerCase() ===
        String(targetValue).trim().toLowerCase()
      );

    case ScoringOperator.NOT_EQUALS:
      return (
        String(actualValue).trim().toLowerCase() !==
        String(targetValue).trim().toLowerCase()
      );

    case ScoringOperator.CONTAINS:
      return String(actualValue)
        .toLowerCase()
        .includes(String(targetValue).toLowerCase());

    case ScoringOperator.GREATER_THAN: {
      const numActual = Number(actualValue);
      const numTarget = Number(targetValue);
      if (isNaN(numActual) || isNaN(numTarget)) return false;
      return numActual > numTarget;
    }

    case ScoringOperator.LESS_THAN: {
      const numActual = Number(actualValue);
      const numTarget = Number(targetValue);
      if (isNaN(numActual) || isNaN(numTarget)) return false;
      return numActual < numTarget;
    }

    default:
      return false;
  }
}

/**
 * Computes the total score and list of contributing rules for a single lead.
 */
export function calculateLeadScore(
  rules: ScoringRule[],
  context: LeadScoringContext,
  baseScore: number = 50
): { totalScore: number; breakdown: ScoreBreakdownItem[] } {
  const breakdown: ScoreBreakdownItem[] = [];
  let calculatedScore = baseScore;

  const activeRules = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const rule of activeRules) {
    if (evaluateRule(rule, context)) {
      calculatedScore += rule.points;
      const matchedValue = extractLeadFieldValue(rule.field, context);
      breakdown.push({
        ruleId: rule.id,
        ruleName: rule.name,
        field: rule.field,
        points: rule.points,
        matchedValue,
      });
    }
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, Math.round(calculatedScore)));

  return {
    totalScore: finalScore,
    breakdown,
  };
}

/**
 * Recalculates and updates the score and breakdown for a single lead in the database.
 */
export async function recalculateLeadScore(
  leadId: string,
  organizationId: string,
  client: any = prisma
) {
  const [lead, rules, activities, conversations, customFieldValues] =
    await Promise.all([
      client.lead.findUnique({
        where: { id: leadId },
      }),
      client.scoringRule.findMany({
        where: { organizationId, enabled: true },
        orderBy: { displayOrder: "asc" },
      }),
      client.activity.findMany({
        where: { organizationId, entityType: "LEAD", entityId: leadId },
        orderBy: { createdAt: "desc" },
      }),
      client.conversation.findMany({
        where: { leadId },
      }),
      client.customFieldValue.findMany({
        where: { organizationId, entityType: "LEAD", entityId: leadId },
        include: { fieldDefinition: true },
      }),
    ]);

  if (!lead) return null;

  const customFields: Record<string, any> = {};
  customFieldValues.forEach((cf: any) => {
    if (cf.fieldDefinition?.fieldKey) {
      customFields[cf.fieldDefinition.fieldKey] = cf.value;
    }
  });

  const { totalScore, breakdown } = calculateLeadScore(rules, {
    lead,
    activities,
    conversations,
    customFields,
  });

  const updatedLead = await client.lead.update({
    where: { id: leadId },
    data: {
      score: totalScore,
      scoreBreakdown: JSON.stringify(breakdown),
    },
  });

  return { lead: updatedLead, score: totalScore, breakdown };
}

/**
 * Batch recalculates all active leads for an organization.
 */
export async function recalculateAllLeadsForOrg(
  organizationId: string,
  client: any = prisma
) {
  const [leads, rules, activities, conversations, customFieldValues] =
    await Promise.all([
      client.lead.findMany({
        where: { organizationId, isArchived: false },
      }),
      client.scoringRule.findMany({
        where: { organizationId, enabled: true },
        orderBy: { displayOrder: "asc" },
      }),
      client.activity.findMany({
        where: { organizationId, entityType: "LEAD" },
        orderBy: { createdAt: "desc" },
      }),
      client.conversation.findMany({
        where: {
          lead: {
            organizationId,
          },
        },
      }),
      client.customFieldValue.findMany({
        where: { organizationId, entityType: "LEAD" },
        include: { fieldDefinition: true },
      }),
    ]);

  // Group relations by leadId
  const activitiesByLead = new Map<string, any[]>();
  activities.forEach((a: any) => {
    if (!activitiesByLead.has(a.entityId)) {
      activitiesByLead.set(a.entityId, []);
    }
    activitiesByLead.get(a.entityId)!.push(a);
  });

  const conversationsByLead = new Map<string, any[]>();
  conversations.forEach((c: any) => {
    if (c.leadId) {
      if (!conversationsByLead.has(c.leadId)) {
        conversationsByLead.set(c.leadId, []);
      }
      conversationsByLead.get(c.leadId)!.push(c);
    }
  });

  const customFieldsByLead = new Map<string, Record<string, any>>();
  customFieldValues.forEach((cf: any) => {
    if (!customFieldsByLead.has(cf.entityId)) {
      customFieldsByLead.set(cf.entityId, {});
    }
    if (cf.fieldDefinition?.fieldKey) {
      customFieldsByLead.get(cf.entityId)![cf.fieldDefinition.fieldKey] = cf.value;
    }
  });

  let totalScoreSum = 0;

  for (const lead of leads) {
    const leadActivities = activitiesByLead.get(lead.id) || [];
    const leadConversations = conversationsByLead.get(lead.id) || [];
    const leadCustomFields = customFieldsByLead.get(lead.id) || {};

    const { totalScore, breakdown } = calculateLeadScore(rules, {
      lead,
      activities: leadActivities,
      conversations: leadConversations,
      customFields: leadCustomFields,
    });

    totalScoreSum += totalScore;

    await client.lead.update({
      where: { id: lead.id },
      data: {
        score: totalScore,
        scoreBreakdown: JSON.stringify(breakdown),
      },
    });
  }

  const averageScore =
    leads.length > 0 ? Math.round(totalScoreSum / leads.length) : 50;

  return {
    updatedCount: leads.length,
    averageScore,
  };
}

/**
 * Calculates how many current leads match each scoring rule for live preview in settings.
 */
export async function previewScoringRulesImpact(
  organizationId: string,
  client: any = prisma
): Promise<Record<string, number>> {
  const [leads, rules, activities, conversations, customFieldValues] =
    await Promise.all([
      client.lead.findMany({
        where: { organizationId, isArchived: false },
      }),
      client.scoringRule.findMany({
        where: { organizationId },
        orderBy: { displayOrder: "asc" },
      }),
      client.activity.findMany({
        where: { organizationId, entityType: "LEAD" },
        orderBy: { createdAt: "desc" },
      }),
      client.conversation.findMany({
        where: {
          lead: {
            organizationId,
          },
        },
      }),
      client.customFieldValue.findMany({
        where: { organizationId, entityType: "LEAD" },
        include: { fieldDefinition: true },
      }),
    ]);

  const activitiesByLead = new Map<string, any[]>();
  activities.forEach((a: any) => {
    if (!activitiesByLead.has(a.entityId)) {
      activitiesByLead.set(a.entityId, []);
    }
    activitiesByLead.get(a.entityId)!.push(a);
  });

  const conversationsByLead = new Map<string, any[]>();
  conversations.forEach((c: any) => {
    if (c.leadId) {
      if (!conversationsByLead.has(c.leadId)) {
        conversationsByLead.set(c.leadId, []);
      }
      conversationsByLead.get(c.leadId)!.push(c);
    }
  });

  const customFieldsByLead = new Map<string, Record<string, any>>();
  customFieldValues.forEach((cf: any) => {
    if (!customFieldsByLead.has(cf.entityId)) {
      customFieldsByLead.set(cf.entityId, {});
    }
    if (cf.fieldDefinition?.fieldKey) {
      customFieldsByLead.get(cf.entityId)![cf.fieldDefinition.fieldKey] = cf.value;
    }
  });

  const impactCounts: Record<string, number> = {};
  rules.forEach((r: any) => {
    impactCounts[r.id] = 0;
  });

  for (const lead of leads) {
    const context: LeadScoringContext = {
      lead,
      activities: activitiesByLead.get(lead.id) || [],
      conversations: conversationsByLead.get(lead.id) || [],
      customFields: customFieldsByLead.get(lead.id) || {},
    };

    for (const rule of rules) {
      if (evaluateRule(rule, context)) {
        impactCounts[rule.id] = (impactCounts[rule.id] || 0) + 1;
      }
    }
  }

  return impactCounts;
}
