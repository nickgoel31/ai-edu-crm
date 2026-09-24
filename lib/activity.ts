import { prisma } from "@/lib/prisma";
import { ActivityEntityType, ActivityType } from "@/types";
import { recordLeadFirstContact } from "@/lib/sla";

/**
 * Writes a human-readable Activity feed entry. Used both for system-generated
 * events (stage/assignment/document/payment changes, agent conversations) and
 * for manually logged notes/calls/emails. Complements AuditLog, which remains
 * the technical/compliance record.
 */
export async function logActivity(params: {
  organizationId: string;
  entityType: ActivityEntityType | string;
  entityId: string;
  type: ActivityType | string;
  content?: string | null;
  metadata?: any;
  createdByUserId?: string | null;
}) {
  const {
    organizationId,
    entityType,
    entityId,
    type,
    content = null,
    metadata = null,
    createdByUserId = null,
  } = params;

  const activity = await prisma.activity.create({
    data: {
      organizationId,
      entityType,
      entityId,
      type,
      content,
      metadata: metadata ? (typeof metadata === "string" ? metadata : JSON.stringify(metadata)) : null,
      createdByUserId,
    },
  });

  if (entityType === "LEAD" || entityType === ActivityEntityType.LEAD) {
    try {
      await recordLeadFirstContact({
        leadId: entityId,
        organizationId,
      });
    } catch (err) {
      console.error("Error updating lead SLA on activity logging:", err);
    }
  }

  return activity;
}

