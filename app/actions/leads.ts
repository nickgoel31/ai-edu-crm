"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { LeadStage } from "@/types";
import { revalidatePath } from "next/cache";
import { recalculateLeadScore } from "@/lib/lead-scoring";

export async function updateLeadStageAction(
  leadId: string,
  newStageOrStageId: string,
  lostReason?: string | null
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized: Active session required.");
  }

  assertCanMutate(session);

  const scopedDb = getScopedPrismaClient(session);

  const existingLead = await scopedDb.lead.findUnique({
    where: { id: leadId },
    include: {
      pipelineStage: true,
    },
  });

  if (!existingLead) {
    throw new Error("Lead not found in this organization.");
  }

  // Determine if newStageOrStageId is a PipelineStage ID or a legacy LeadStage enum
  let targetPipelineStage = await scopedDb.pipelineStage.findFirst({
    where: { id: newStageOrStageId },
  });

  let targetStageEnum: LeadStage;
  let targetStageId: string | null = null;

  if (targetPipelineStage) {
    targetStageId = targetPipelineStage.id;
    targetStageEnum = targetPipelineStage.mapsToBucket as LeadStage;
  } else {
    // Treat as legacy LeadStage enum
    targetStageEnum = newStageOrStageId as LeadStage;
    // Find matching stage in the lead's pipeline
    const pipeline = await scopedDb.pipelineTemplate.findFirst({
      where: existingLead.program
        ? { program: existingLead.program }
        : { isDefault: true },
      include: { stages: true },
    });
    const matched = pipeline?.stages.find((s: any) => s.mapsToBucket === targetStageEnum);
    if (matched) {
      targetPipelineStage = matched;
      targetStageId = matched.id;
    }
  }

  // Check if target is Lost or requires reason
  const requiresReason = targetPipelineStage?.requiresReasonOnExit || targetStageEnum === LeadStage.LOST;
  if (requiresReason && !lostReason?.trim()) {
    throw new Error("A reason is required when transitioning to this stage.");
  }

  if (
    existingLead.stage === targetStageEnum &&
    existingLead.pipelineStageId === targetStageId &&
    (!lostReason || existingLead.lostReason === lostReason)
  ) {
    return { success: true, lead: existingLead };
  }

  const updatedLead = await scopedDb.lead.update({
    where: { id: leadId },
    data: {
      stage: targetStageEnum,
      pipelineStageId: targetStageId,
      lostReason: requiresReason ? lostReason?.trim() : null,
    },
    include: {
      pipelineStage: true,
      assignedTo: true,
    },
  });

  // Write AuditLog entry
  await scopedDb.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "LEAD_STAGE_UPDATED",
      entityType: "Lead",
      entityId: leadId,
      changesJson: JSON.stringify({
        oldStage: existingLead.stage,
        oldPipelineStageId: existingLead.pipelineStageId,
        newStage: targetStageEnum,
        newPipelineStageId: targetStageId,
        newPipelineStageName: targetPipelineStage?.name || null,
        lostReason: updatedLead.lostReason,
        performedBy: session.user.name || session.user.email,
      }),
    },
  });

  // Recalculate lead score based on stage transition rules
  await recalculateLeadScore(leadId, session.user.organizationId, scopedDb);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);

  return { success: true, lead: updatedLead };
}

export async function assignLeadCounselorAction(
  leadId: string,
  counselorId: string | null
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized: Active session required.");
  }

  assertCanMutate(session);

  const scopedDb = getScopedPrismaClient(session);

  const existingLead = await scopedDb.lead.findUnique({
    where: { id: leadId },
  });

  if (!existingLead) {
    throw new Error("Lead not found in this organization.");
  }

  const newAssignedId = counselorId === "unassigned" || !counselorId ? null : counselorId;

  const updatedLead = await scopedDb.lead.update({
    where: { id: leadId },
    data: {
      assignedToUserId: newAssignedId,
    },
  });

  // Write AuditLog entry
  await scopedDb.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "LEAD_ASSIGNED",
      entityType: "Lead",
      entityId: leadId,
      changesJson: JSON.stringify({
        previousCounselorId: existingLead.assignedToUserId,
        newCounselorId: newAssignedId,
        performedBy: session.user.name || session.user.email,
      }),
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);

  return { success: true, lead: updatedLead };
}
