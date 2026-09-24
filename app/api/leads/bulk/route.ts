import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { LeadStage } from "@/types";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  // Enforce RBAC: READONLY accounts cannot execute bulk edit actions
  try {
    assertCanMutate(session);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Read-only accounts cannot modify leads." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { action, leadIds, targetCounselorId, targetStage, lostReason, tagId, tagName, tagColor } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one lead." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // 1. Bulk Reassign
    if (action === "reassign") {
      const assignedId = targetCounselorId === "unassigned" || !targetCounselorId ? null : targetCounselorId;

      const leadsToReassign = await scopedDb.lead.findMany({
        where: { id: { in: leadIds }, isArchived: false },
      });

      const result = await scopedDb.lead.updateMany({
        where: {
          id: { in: leadIds },
          isArchived: false,
        },
        data: {
          assignedToUserId: assignedId,
        },
      });

      for (const lead of leadsToReassign) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "LEAD_ASSIGNED",
            entityType: "Lead",
            entityId: lead.id,
            changesJson: JSON.stringify({
              previousCounselorId: lead.assignedToUserId,
              newCounselorId: assignedId,
              performedBy: session.user.name || session.user.email,
              bulk: true,
            }),
          },
        });

        await logActivity({
          organizationId: session.user.organizationId,
          entityType: "LEAD",
          entityId: lead.id,
          type: "ASSIGNMENT_CHANGE",
          metadata: {
            oldAssigneeId: lead.assignedToUserId,
            newAssigneeId: assignedId,
            bulk: true,
          },
        });
      }

      return NextResponse.json({
        message: `Successfully reassigned ${result.count} leads.`,
        count: result.count,
      });
    }

    // 2. Bulk Stage Change (with Lost Reason enforcement)
    if (action === "stage") {
      if (!targetStage || !Object.values(LeadStage).includes(targetStage)) {
        return NextResponse.json(
          { error: "Valid target stage is required." },
          { status: 400 }
        );
      }

      if (targetStage === LeadStage.LOST && (!lostReason || !lostReason.trim())) {
        return NextResponse.json(
          { error: "A lost reason is required when moving leads to Lost." },
          { status: 400 }
        );
      }

      const cleanLostReason = targetStage === LeadStage.LOST ? lostReason.trim() : null;

      const leadsToUpdate = await scopedDb.lead.findMany({
        where: { id: { in: leadIds }, isArchived: false },
      });

      const result = await scopedDb.lead.updateMany({
        where: {
          id: { in: leadIds },
          isArchived: false,
        },
        data: {
          stage: targetStage,
          lostReason: cleanLostReason,
        },
      });

      for (const lead of leadsToUpdate) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "LEAD_STAGE_UPDATED",
            entityType: "Lead",
            entityId: lead.id,
            changesJson: JSON.stringify({
              oldStage: lead.stage,
              newStage: targetStage,
              lostReason: cleanLostReason,
              performedBy: session.user.name || session.user.email,
              bulk: true,
            }),
          },
        });

        await logActivity({
          organizationId: session.user.organizationId,
          entityType: "LEAD",
          entityId: lead.id,
          type: "STAGE_CHANGE",
          metadata: {
            oldStage: lead.stage,
            newStage: targetStage,
            lostReason: cleanLostReason,
            bulk: true,
          },
        });

        // Recalculate scoring rules for stage update
        await recalculateLeadScore(lead.id, session.user.organizationId, scopedDb);
      }

      return NextResponse.json({
        message: `Successfully moved ${result.count} leads to ${targetStage}.`,
        count: result.count,
      });
    }

    // 3. Bulk Tag - Add
    if (action === "tag-add" || action === "tag") {
      let resolvedTagId = tagId;

      if (!resolvedTagId && tagName && tagName.trim()) {
        const trimmed = tagName.trim();
        let tagRecord = await scopedDb.tag.findFirst({
          where: { name: trimmed },
        });

        if (!tagRecord) {
          tagRecord = await scopedDb.tag.create({
            data: {
              organizationId: session.user.organizationId,
              name: trimmed,
              color: (tagColor || "#3b82f6").trim(),
            },
          });
        }
        resolvedTagId = tagRecord.id;
      }

      if (!resolvedTagId) {
        return NextResponse.json(
          { error: "Tag ID or tag name is required." },
          { status: 400 }
        );
      }

      const tagRecord = await scopedDb.tag.findUnique({
        where: { id: resolvedTagId },
      });

      if (!tagRecord) {
        return NextResponse.json({ error: "Tag not found." }, { status: 404 });
      }

      let attachedCount = 0;
      for (const leadId of leadIds) {
        const existing = await scopedDb.entityTag.findFirst({
          where: {
            entityType: "LEAD",
            entityId: leadId,
            tagId: resolvedTagId,
          },
        });

        if (!existing) {
          await scopedDb.entityTag.create({
            data: {
              organizationId: session.user.organizationId,
              entityType: "LEAD",
              entityId: leadId,
              tagId: resolvedTagId,
            },
          });
          attachedCount++;

          await scopedDb.auditLog.create({
            data: {
              organizationId: session.user.organizationId,
              userId: session.user.id,
              action: "TAG_ATTACHED",
              entityType: "Lead",
              entityId: leadId,
              changesJson: JSON.stringify({
                tagId: resolvedTagId,
                tagName: tagRecord.name,
                bulk: true,
              }),
            },
          });
        }
      }

      return NextResponse.json({
        message: `Tag "${tagRecord.name}" applied across ${attachedCount} leads.`,
        count: attachedCount,
        tag: tagRecord,
      });
    }

    // 4. Bulk Tag - Remove
    if (action === "tag-remove") {
      if (!tagId) {
        return NextResponse.json(
          { error: "Tag ID is required to remove tag." },
          { status: 400 }
        );
      }

      const tagRecord = await scopedDb.tag.findUnique({
        where: { id: tagId },
      });

      const existingEntityTags = await scopedDb.entityTag.findMany({
        where: {
          entityType: "LEAD",
          entityId: { in: leadIds },
          tagId,
        },
      });

      await scopedDb.entityTag.deleteMany({
        where: {
          entityType: "LEAD",
          entityId: { in: leadIds },
          tagId,
        },
      });

      for (const et of existingEntityTags) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "TAG_DETACHED",
            entityType: "Lead",
            entityId: et.entityId,
            changesJson: JSON.stringify({
              tagId,
              tagName: tagRecord?.name || "Unknown Tag",
              bulk: true,
            }),
          },
        });
      }

      return NextResponse.json({
        message: `Tag "${tagRecord?.name || ""}" removed from ${existingEntityTags.length} leads.`,
        count: existingEntityTags.length,
      });
    }

    // 5. Bulk Delete (ADMIN Only - Soft Delete)
    if (action === "delete") {
      assertAdmin(session);

      const leadsToDelete = await scopedDb.lead.findMany({
        where: { id: { in: leadIds }, isArchived: false },
      });

      const now = new Date();
      const result = await scopedDb.lead.updateMany({
        where: {
          id: { in: leadIds },
          isArchived: false,
        },
        data: {
          isArchived: true,
          archivedAt: now,
        },
      });

      for (const lead of leadsToDelete) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "LEAD_DELETED",
            entityType: "Lead",
            entityId: lead.id,
            changesJson: JSON.stringify({
              deletedLeadName: lead.name,
              deletedLeadEmail: lead.email,
              deletedLeadPhone: lead.phone,
              deletedLeadStage: lead.stage,
              performedBy: session.user.name || session.user.email,
              softDelete: true,
              bulk: true,
            }),
          },
        });
      }

      return NextResponse.json({
        message: `Successfully deleted ${result.count} leads.`,
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: "Invalid bulk action specified." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error executing bulk lead action:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute bulk action." },
      { status: 500 }
    );
  }
}
