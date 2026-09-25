import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/job-queue";
import {
  AgentTriggerEvent,
  ActivityType,
  LeadStage,
  StudentStage,
  DocumentStatus,
  PaymentStatus,
  ConversationOutcome,
} from "@/types";

// Minimum time between two fires of the same trigger on the same entity.
// Prevents an hourly cron from spamming a lead/student every run while a
// condition (e.g. "stale for 14+ days") stays true.
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

type MatchedEntity = {
  entityType: "LEAD" | "STUDENT" | "CONVERSATION";
  entityId: string;
  name: string;
  phone?: string | null;
};

function parseConditions(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function findMatchesForTrigger(
  organizationId: string,
  triggerEvent: string,
  conditions: Record<string, any>
): Promise<MatchedEntity[]> {
  const now = Date.now();

  switch (triggerEvent) {
    case AgentTriggerEvent.LEAD_CREATED: {
      const since = new Date(now - 24 * 60 * 60 * 1000);
      const leads = await prisma.lead.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { id: true, name: true, phone: true },
        take: 100,
      });
      return leads.map((l) => ({ entityType: "LEAD", entityId: l.id, name: l.name, phone: l.phone }));
    }

    case AgentTriggerEvent.LEAD_STALE_NO_FOLLOWUP: {
      const daysThreshold = Number(conditions.daysThreshold) || 14;
      const staleBefore = new Date(now - daysThreshold * 24 * 60 * 60 * 1000);
      const leads = await prisma.lead.findMany({
        where: {
          organizationId,
          stage: { notIn: [LeadStage.CONVERTING, LeadStage.LOST] },
          updatedAt: { lte: staleBefore },
        },
        select: { id: true, name: true, phone: true },
        take: 100,
      });
      return leads.map((l) => ({ entityType: "LEAD", entityId: l.id, name: l.name, phone: l.phone }));
    }

    case AgentTriggerEvent.LEAD_MARKED_LOST: {
      const leads = await prisma.lead.findMany({
        where: { organizationId, stage: LeadStage.LOST },
        select: { id: true, name: true, phone: true },
        take: 100,
      });
      return leads.map((l) => ({ entityType: "LEAD", entityId: l.id, name: l.name, phone: l.phone }));
    }

    case AgentTriggerEvent.PAYMENT_DUE_SOON: {
      const daysThreshold = Number(conditions.daysThreshold) || 3;
      const windowEnd = new Date(now + daysThreshold * 24 * 60 * 60 * 1000);
      const payments = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          dueDate: { gte: new Date(now), lte: windowEnd },
          student: { organizationId },
        },
        select: { id: true, student: { select: { id: true, name: true, phone: true } } },
        take: 100,
      });
      return payments
        .filter((p) => p.student)
        .map((p) => ({ entityType: "STUDENT", entityId: p.student!.id, name: p.student!.name, phone: p.student!.phone }));
    }

    case AgentTriggerEvent.PAYMENT_OVERDUE: {
      const payments = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.OVERDUE,
          student: { organizationId },
        },
        select: { id: true, student: { select: { id: true, name: true, phone: true } } },
        take: 100,
      });
      return payments
        .filter((p) => p.student)
        .map((p) => ({ entityType: "STUDENT", entityId: p.student!.id, name: p.student!.name, phone: p.student!.phone }));
    }

    case AgentTriggerEvent.DOCUMENT_PENDING_STALE: {
      const daysThreshold = Number(conditions.daysThreshold) || 5;
      const staleBefore = new Date(now - daysThreshold * 24 * 60 * 60 * 1000);
      const documents = await prisma.document.findMany({
        where: {
          status: DocumentStatus.PENDING,
          updatedAt: { lte: staleBefore },
          student: { organizationId },
        },
        select: { id: true, student: { select: { id: true, name: true, phone: true } } },
        take: 100,
      });
      return documents
        .filter((d) => d.student)
        .map((d) => ({ entityType: "STUDENT", entityId: d.student!.id, name: d.student!.name, phone: d.student!.phone }));
    }

    case AgentTriggerEvent.STUDENT_ENROLLED: {
      const students = await prisma.student.findMany({
        where: { organizationId, stage: StudentStage.ENROLLED },
        select: { id: true, name: true, phone: true },
        take: 100,
      });
      return students.map((s) => ({ entityType: "STUDENT", entityId: s.id, name: s.name, phone: s.phone }));
    }

    case AgentTriggerEvent.STUDENT_REACHED_ALUMNI: {
      const students = await prisma.student.findMany({
        where: { organizationId, stage: StudentStage.ALUMNI },
        select: { id: true, name: true, phone: true },
        take: 100,
      });
      return students.map((s) => ({ entityType: "STUDENT", entityId: s.id, name: s.name, phone: s.phone }));
    }

    case AgentTriggerEvent.CONVERSATION_ESCALATED_UNCLAIMED: {
      const minutesThreshold = Number(conditions.minutesThreshold) || 30;
      const staleBefore = new Date(now - minutesThreshold * 60 * 1000);
      const conversations = await prisma.conversation.findMany({
        where: {
          outcome: ConversationOutcome.ESCALATED,
          claimedByUserId: null,
          createdAt: { lte: staleBefore },
          agent: { organizationId },
        },
        select: {
          id: true,
          lead: { select: { id: true, name: true, phone: true } },
          student: { select: { id: true, name: true, phone: true } },
        },
        take: 100,
      });
      return conversations.map((c) => {
        if (c.student) return { entityType: "STUDENT" as const, entityId: c.student.id, name: c.student.name, phone: c.student.phone };
        if (c.lead) return { entityType: "LEAD" as const, entityId: c.lead.id, name: c.lead.name, phone: c.lead.phone };
        return { entityType: "CONVERSATION" as const, entityId: c.id, name: "Unattributed caller", phone: null };
      });
    }

    default:
      return [];
  }
}

export async function callAgentWebhook(
  webhookUrl: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook responded with status ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Webhook call failed" };
  }
}

export interface TriggerEvaluationReport {
  triggersEvaluated: number;
  matchesFound: number;
  fired: number;
  skippedCooldown: number;
  skippedNoWebhook: number;
  failed: number;
  dryRun: boolean;
}

/**
 * Evaluates every enabled AgentTrigger (optionally scoped to one organization),
 * finds matching CRM records, and — respecting the per-entity cooldown window —
 * calls the agent's outbound webhook and logs an Activity entry on the matched
 * lead/student. This does not implement the actual Retell/Dograh call logic;
 * it only decides *when* to call out and records the result.
 */
export async function evaluateAgentTriggers(params: {
  organizationId?: string;
  dryRun?: boolean;
}): Promise<TriggerEvaluationReport> {
  const { organizationId, dryRun = false } = params;

  const report: TriggerEvaluationReport = {
    triggersEvaluated: 0,
    matchesFound: 0,
    fired: 0,
    skippedCooldown: 0,
    skippedNoWebhook: 0,
    failed: 0,
    dryRun,
  };

  const triggers = await prisma.agentTrigger.findMany({
    where: {
      enabled: true,
      ...(organizationId ? { organizationId } : {}),
    },
    include: { agent: true },
  });

  for (const trigger of triggers) {
    report.triggersEvaluated++;

    if (trigger.agent.status !== "LIVE") continue;

    const conditions = parseConditions(trigger.conditions);
    const matches = await findMatchesForTrigger(trigger.organizationId, trigger.triggerEvent, conditions);
    report.matchesFound += matches.length;

    for (const match of matches) {
      const existingFire = await prisma.agentTriggerFire.findUnique({
        where: {
          agentTriggerId_entityType_entityId: {
            agentTriggerId: trigger.id,
            entityType: match.entityType,
            entityId: match.entityId,
          },
        },
      });

      if (existingFire && Date.now() - new Date(existingFire.lastTriggeredAt).getTime() < COOLDOWN_MS) {
        report.skippedCooldown++;
        continue;
      }

      if (dryRun) {
        report.fired++;
        continue;
      }

      let status: "SUCCESS" | "FAILED" | "SKIPPED" = "SUCCESS";
      let errorMessage: string | null = null;

      if (!trigger.agent.outboundWebhookUrl) {
        status = "SKIPPED";
        errorMessage = "Agent has no outboundWebhookUrl configured.";
        report.skippedNoWebhook++;
      } else {
        const result = await callAgentWebhook(trigger.agent.outboundWebhookUrl, {
          agentId: trigger.agent.id,
          agentName: trigger.agent.name,
          agentRole: trigger.agent.role,
          triggerEvent: trigger.triggerEvent,
          entityType: match.entityType,
          entityId: match.entityId,
          contactName: match.name,
          phone: match.phone,
          conditions,
        });
        if (result.ok) {
          report.fired++;
        } else {
          status = "FAILED";
          errorMessage = result.error || "Unknown webhook error";
          report.failed++;

          // Don't let a transient failure (agent's endpoint down, network
          // blip) silently drop this fire — queue it for background retry
          // with backoff instead of only recording FAILED and moving on.
          await enqueueJob("AGENT_TRIGGER_RETRY", {
            agentTriggerId: trigger.id,
            entityType: match.entityType,
            entityId: match.entityId,
            webhookUrl: trigger.agent.outboundWebhookUrl,
            webhookPayload: {
              agentId: trigger.agent.id,
              agentName: trigger.agent.name,
              agentRole: trigger.agent.role,
              triggerEvent: trigger.triggerEvent,
              entityType: match.entityType,
              entityId: match.entityId,
              contactName: match.name,
              phone: match.phone,
              conditions,
            },
          });
        }
      }

      await prisma.agentTriggerFire.upsert({
        where: {
          agentTriggerId_entityType_entityId: {
            agentTriggerId: trigger.id,
            entityType: match.entityType,
            entityId: match.entityId,
          },
        },
        create: {
          organizationId: trigger.organizationId,
          agentTriggerId: trigger.id,
          agentId: trigger.agent.id,
          entityType: match.entityType,
          entityId: match.entityId,
          status,
          errorMessage,
          lastTriggeredAt: new Date(),
        },
        update: {
          status,
          errorMessage,
          lastTriggeredAt: new Date(),
        },
      });

      if (match.entityType === "LEAD" || match.entityType === "STUDENT") {
        await logActivity({
          organizationId: trigger.organizationId,
          entityType: match.entityType,
          entityId: match.entityId,
          type: ActivityType.AGENT_TRIGGERED,
          content: `${trigger.agent.name} triggered by ${trigger.triggerEvent}${
            status !== "SUCCESS" ? ` (${status.toLowerCase()}: ${errorMessage})` : ""
          }`,
          metadata: {
            agentId: trigger.agent.id,
            agentName: trigger.agent.name,
            triggerId: trigger.id,
            triggerEvent: trigger.triggerEvent,
            status,
          },
        });
      }
    }
  }

  return report;
}
