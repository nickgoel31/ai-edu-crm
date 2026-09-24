import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { prisma } from "@/lib/prisma";
import { DuplicateMatchStatus } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const matchId = params.id;
    const body = await req.json();
    const { winningFields = {}, winningCustomFields = {}, winningTags } = body;

    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    const match = await scopedPrisma.duplicateMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Duplicate match record not found." },
        { status: 404 }
      );
    }

    if (match.status === DuplicateMatchStatus.MERGED) {
      return NextResponse.json(
        { error: "This duplicate match has already been merged." },
        { status: 400 }
      );
    }

    const { entityType, primaryEntityId, duplicateEntityId } = match;

    // Execute atomic merge transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Primary Record with chosen winning fields
      const cleanWinningFields: Record<string, any> = { ...winningFields };
      // Remove metadata / ID / system fields from update payload
      delete cleanWinningFields.id;
      delete cleanWinningFields.organizationId;
      delete cleanWinningFields.createdAt;
      delete cleanWinningFields.updatedAt;
      delete cleanWinningFields.isArchived;
      delete cleanWinningFields.archivedAt;
      delete cleanWinningFields.assignedTo;
      delete cleanWinningFields.documents;
      delete cleanWinningFields.payments;
      delete cleanWinningFields.conversations;
      delete cleanWinningFields.students;
      delete cleanWinningFields.lead;

      let updatedPrimary: any = null;
      if (entityType === "LEAD") {
        updatedPrimary = await tx.lead.update({
          where: { id: primaryEntityId },
          data: cleanWinningFields,
        });
      } else if (entityType === "STUDENT") {
        updatedPrimary = await tx.student.update({
          where: { id: primaryEntityId },
          data: cleanWinningFields,
        });
      }

      // 2. Apply Winning Custom Fields to Primary
      if (winningCustomFields && typeof winningCustomFields === "object") {
        const definitions = await tx.customFieldDefinition.findMany({
          where: { organizationId: orgId, entityType },
        });
        const defByKey = new Map(definitions.map((d) => [d.fieldKey, d]));

        for (const [key, val] of Object.entries(winningCustomFields)) {
          const def = defByKey.get(key);
          if (def) {
            await tx.customFieldValue.upsert({
              where: {
                fieldDefinitionId_entityId: {
                  fieldDefinitionId: def.id,
                  entityId: primaryEntityId,
                },
              },
              update: {
                value: val !== null && val !== undefined ? String(val) : null,
              },
              create: {
                organizationId: orgId,
                entityType,
                entityId: primaryEntityId,
                fieldDefinitionId: def.id,
                value: val !== null && val !== undefined ? String(val) : null,
              },
            });
          }
        }
      }

      // 3. Reassign Activities from duplicate -> primary
      const activitiesMoved = await tx.activity.updateMany({
        where: {
          organizationId: orgId,
          entityType,
          entityId: duplicateEntityId,
        },
        data: {
          entityId: primaryEntityId,
        },
      });

      // 4. Reassign Conversations from duplicate -> primary
      let conversationsMoved = 0;
      if (entityType === "LEAD") {
        const res = await tx.conversation.updateMany({
          where: {
            leadId: duplicateEntityId,
          },
          data: {
            leadId: primaryEntityId,
          },
        });
        conversationsMoved = res.count;
      } else if (entityType === "STUDENT") {
        const res = await tx.conversation.updateMany({
          where: {
            studentId: duplicateEntityId,
          },
          data: {
            studentId: primaryEntityId,
          },
        });
        conversationsMoved = res.count;
      }

      // 5. If Student: Reassign Documents and Payments
      let documentsMoved = 0;
      let paymentsMoved = 0;
      if (entityType === "STUDENT") {
        const docRes = await tx.document.updateMany({
          where: { studentId: duplicateEntityId },
          data: { studentId: primaryEntityId },
        });
        documentsMoved = docRes.count;

        const payRes = await tx.payment.updateMany({
          where: { studentId: duplicateEntityId },
          data: { studentId: primaryEntityId },
        });
        paymentsMoved = payRes.count;
      }

      // 6. Merge EntityTags
      const duplicateEntityTags = await tx.entityTag.findMany({
        where: {
          organizationId: orgId,
          entityType,
          entityId: duplicateEntityId,
        },
      });

      let tagsMerged = 0;
      for (const et of duplicateEntityTags) {
        const existingPrimaryTag = await tx.entityTag.findUnique({
          where: {
            organizationId_entityType_entityId_tagId: {
              organizationId: orgId,
              entityType,
              entityId: primaryEntityId,
              tagId: et.tagId,
            },
          },
        });

        if (existingPrimaryTag) {
          // Already on primary; delete from duplicate to avoid uniqueness conflict
          await tx.entityTag.delete({ where: { id: et.id } });
        } else {
          // Reassign to primary
          await tx.entityTag.update({
            where: { id: et.id },
            data: { entityId: primaryEntityId },
          });
          tagsMerged++;
        }
      }

      // 7. Soft-Delete / Archive Duplicate Record
      if (entityType === "LEAD") {
        await tx.lead.update({
          where: { id: duplicateEntityId },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            stage: "ARCHIVED",
          },
        });
      } else if (entityType === "STUDENT") {
        await tx.student.update({
          where: { id: duplicateEntityId },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            stage: "ARCHIVED",
          },
        });
      }

      // 8. Update DuplicateMatch status
      const updatedMatch = await tx.duplicateMatch.update({
        where: { id: matchId },
        data: {
          status: DuplicateMatchStatus.MERGED,
        },
      });

      // 9. Write AuditLog
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.user.id,
          action: `${entityType}_DUPLICATE_MERGED`,
          entityType,
          entityId: primaryEntityId,
          changesJson: JSON.stringify({
            duplicateEntityId,
            primaryEntityId,
            winningFields: cleanWinningFields,
            winningCustomFields,
            activitiesMoved: activitiesMoved.count,
            conversationsMoved,
            documentsMoved,
            paymentsMoved,
            tagsMerged,
            mergedBy: session.user.name || session.user.email,
          }),
        },
      });

      return {
        updatedPrimary,
        updatedMatch,
        stats: {
          activitiesMoved: activitiesMoved.count,
          conversationsMoved,
          documentsMoved,
          paymentsMoved,
          tagsMerged,
        },
      };
    });

    return NextResponse.json({
      success: true,
      message: `Duplicate ${entityType.toLowerCase()} merged successfully into primary record.`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/duplicates/[id]/merge error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to merge duplicate records." },
      { status: 500 }
    );
  }
}
