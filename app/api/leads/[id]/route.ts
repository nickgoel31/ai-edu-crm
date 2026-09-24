import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { LeadStage } from "@/types";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const lead = await scopedDb.lead.findUnique({
      where: { id },
      include: {
        pipelineStage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        conversations: {
          orderBy: { createdAt: "desc" },
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                channel: true,
                role: true,
              },
            },
          },
        },
        students: {
          select: {
            id: true,
            name: true,
            stage: true,
            program: true,
            cohort: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found in this organization." },
        { status: 404 }
      );
    }

    // Fetch audit logs for this specific lead
    const auditLogs = await scopedDb.auditLog.findMany({
      where: {
        entityType: "Lead",
        entityId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get all available counselors in the organization
    const [counselors, customFieldDefinitions, customFieldValues, entityTags, allTags] = await Promise.all([
      scopedDb.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: "asc" },
      }),
      scopedDb.customFieldDefinition.findMany({
        where: {
          entityType: "LEAD",
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      scopedDb.customFieldValue.findMany({
        where: {
          entityType: "LEAD",
          entityId: id,
        },
        include: {
          fieldDefinition: true,
        },
      }),
      scopedDb.entityTag.findMany({
        where: {
          entityType: "LEAD",
          entityId: id,
        },
        include: {
          tag: true,
        },
      }),
      scopedDb.tag.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    const valuesByFieldKey: Record<string, any> = {};
    customFieldValues.forEach((v: any) => {
      let castValue: any = v.value;
      if (v.fieldDefinition?.fieldType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (v.fieldDefinition?.fieldType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        valuesByFieldKey[v.fieldDefinition.fieldKey] = castValue;
      }
    });

    const parsedDefinitions = customFieldDefinitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    const tags = entityTags.map((et: any) => et.tag).filter(Boolean);

    return NextResponse.json({
      lead: {
        ...lead,
        customFields: valuesByFieldKey,
        tags,
      },
      tags,
      allTags,
      customFieldDefinitions: parsedDefinitions,
      customFieldValues: valuesByFieldKey,
      auditLogs,
      counselors,
    });
  } catch (error: any) {
    console.error("Error fetching lead detail:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch lead." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  // Enforce RBAC: READONLY role cannot modify leads
  try {
    assertCanMutate(session);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Read-only accounts cannot modify leads." },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const body = await req.json();
    const { stage, lostReason, assignedToUserId, name, phone, email, score, customFields } = body;

    const scopedDb = getScopedPrismaClient(session);

    // Verify lead exists within tenant
    const existingLead = await scopedDb.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return NextResponse.json(
        { error: "Lead not found in this organization." },
        { status: 404 }
      );
    }

    // Validation: "Lost" stage requires a lostReason
    if (stage === LeadStage.LOST && !lostReason?.trim()) {
      return NextResponse.json(
        { error: "A lost reason is required when moving a lead to Lost." },
        { status: 400 }
      );
    }

    // Save custom fields if provided
    if (customFields && typeof customFields === "object") {
      const definitions = await scopedDb.customFieldDefinition.findMany({
        where: { entityType: "LEAD" },
      });

      const defByKey = new Map<string, any>();
      const defById = new Map<string, any>();
      definitions.forEach((d) => {
        defByKey.set(d.fieldKey, d);
        defById.set(d.id, d);
      });

      for (const [key, val] of Object.entries(customFields)) {
        const def = defById.get(key) || defByKey.get(key);
        if (def) {
          const stringVal = val === null || val === undefined || val === "" ? null : String(val);
          const existingVal = await scopedDb.customFieldValue.findUnique({
            where: {
              fieldDefinitionId_entityId: {
                fieldDefinitionId: def.id,
                entityId: id,
              },
            },
          });

          if (existingVal) {
            await scopedDb.customFieldValue.update({
              where: { id: existingVal.id },
              data: { value: stringVal },
            });
          } else if (stringVal !== null) {
            await scopedDb.customFieldValue.create({
              data: {
                organizationId: session.user.organizationId,
                entityType: "LEAD",
                entityId: id,
                fieldDefinitionId: def.id,
                value: stringVal,
              },
            });
          }
        }
      }
    }

    const updateData: any = {};
    const auditEntries: any[] = [];

    if (stage !== undefined && stage !== existingLead.stage) {
      updateData.stage = stage;
      updateData.lostReason = stage === LeadStage.LOST ? lostReason?.trim() : null;

      auditEntries.push({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "LEAD_STAGE_UPDATED",
        entityType: "Lead",
        entityId: id,
        changesJson: JSON.stringify({
          oldStage: existingLead.stage,
          newStage: stage,
          lostReason: updateData.lostReason,
        }),
      });
    }

    if (assignedToUserId !== undefined && assignedToUserId !== existingLead.assignedToUserId) {
      updateData.assignedToUserId = assignedToUserId === "" ? null : assignedToUserId;

      auditEntries.push({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "LEAD_ASSIGNED",
        entityType: "Lead",
        entityId: id,
        changesJson: JSON.stringify({
          previousCounselorId: existingLead.assignedToUserId,
          newCounselorId: updateData.assignedToUserId,
        }),
      });
    }

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (score !== undefined) updateData.score = score;

    // Apply update and write audit logs
    const updatedLead = await scopedDb.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    for (const audit of auditEntries) {
      await scopedDb.auditLog.create({
        data: audit,
      });
    }

    if (updateData.stage !== undefined) {
      await logActivity({
        organizationId: session.user.organizationId,
        entityType: "LEAD",
        entityId: id,
        type: "STAGE_CHANGE",
        metadata: {
          oldStage: existingLead.stage,
          newStage: updateData.stage,
          lostReason: updateData.lostReason ?? null,
        },
      });
    }

    if (updateData.assignedToUserId !== undefined) {
      const [previousAssignee, newAssignee] = await Promise.all([
        existingLead.assignedToUserId
          ? scopedDb.user.findUnique({ where: { id: existingLead.assignedToUserId } })
          : null,
        updateData.assignedToUserId
          ? scopedDb.user.findUnique({ where: { id: updateData.assignedToUserId } })
          : null,
      ]);

      await logActivity({
        organizationId: session.user.organizationId,
        entityType: "LEAD",
        entityId: id,
        type: "ASSIGNMENT_CHANGE",
        metadata: {
          oldAssigneeId: existingLead.assignedToUserId,
          oldAssigneeName: previousAssignee?.name || previousAssignee?.email || null,
          newAssigneeId: updateData.assignedToUserId,
          newAssigneeName: newAssignee?.name || newAssignee?.email || null,
        },
      });
    }

    return NextResponse.json({
      message: "Lead updated successfully.",
      lead: updatedLead,
    });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update lead." },
      { status: 500 }
    );
  }
}
