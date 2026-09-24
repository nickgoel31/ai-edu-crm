import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ADMIN only tag merge
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required to merge tags" },
        { status: 403 }
      );
    }

    const { sourceTagId, targetTagId } = await req.json();

    if (!sourceTagId || !targetTagId) {
      return NextResponse.json(
        { error: "sourceTagId and targetTagId are required" },
        { status: 400 }
      );
    }

    if (sourceTagId === targetTagId) {
      return NextResponse.json(
        { error: "Cannot merge a tag into itself" },
        { status: 400 }
      );
    }

    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    const sourceTag = await scopedPrisma.tag.findUnique({
      where: { id: sourceTagId },
    });

    const targetTag = await scopedPrisma.tag.findUnique({
      where: { id: targetTagId },
    });

    if (!sourceTag || !targetTag) {
      return NextResponse.json(
        { error: "Source or Target tag not found in your organization" },
        { status: 404 }
      );
    }

    // Transaction to safely merge EntityTag rows
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get all EntityTag rows associated with the source tag
      const sourceEntityTags = await tx.entityTag.findMany({
        where: {
          organizationId: orgId,
          tagId: sourceTagId,
        },
      });

      let remappedCount = 0;
      let deletedDuplicateCount = 0;

      for (const row of sourceEntityTags) {
        // Check if target tag is already attached to this entity
        const existingTarget = await tx.entityTag.findUnique({
          where: {
            organizationId_entityType_entityId_tagId: {
              organizationId: orgId,
              entityType: row.entityType,
              entityId: row.entityId,
              tagId: targetTagId,
            },
          },
        });

        if (existingTarget) {
          // Already tagged with target; remove the source row to avoid unique violation
          await tx.entityTag.delete({
            where: { id: row.id },
          });
          deletedDuplicateCount++;
        } else {
          // Reassign to target tag
          await tx.entityTag.update({
            where: { id: row.id },
            data: { tagId: targetTagId },
          });
          remappedCount++;
        }
      }

      // 2. Delete the source tag
      await tx.tag.delete({
        where: { id: sourceTagId },
      });

      return { remappedCount, deletedDuplicateCount };
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TAG_MERGED",
        entityType: "Tag",
        entityId: targetTagId,
        changesJson: JSON.stringify({
          sourceTagId,
          sourceTagName: sourceTag.name,
          targetTagId,
          targetTagName: targetTag.name,
          remappedEntities: result.remappedCount,
          deduplicatedEntities: result.deletedDuplicateCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully merged "${sourceTag.name}" into "${targetTag.name}"`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/tags/merge error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to merge tags" },
      { status: 500 }
    );
  }
}
