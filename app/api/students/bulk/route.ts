import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { StudentStage } from "@/types";
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
      { error: "Forbidden: Read-only accounts cannot modify students." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { action, studentIds, targetStage, tagId, tagName, tagColor } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one student." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // 1. Bulk Stage Change (ENQUIRY, ENROLLED, ACTIVE, ALUMNI)
    if (action === "stage") {
      if (!targetStage || !Object.values(StudentStage).includes(targetStage)) {
        return NextResponse.json(
          { error: "Valid target stage is required." },
          { status: 400 }
        );
      }

      const studentsToUpdate = await scopedDb.student.findMany({
        where: { id: { in: studentIds }, isArchived: false },
      });

      const result = await scopedDb.student.updateMany({
        where: {
          id: { in: studentIds },
          isArchived: false,
        },
        data: {
          stage: targetStage,
        },
      });

      for (const student of studentsToUpdate) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "STUDENT_STAGE_UPDATED",
            entityType: "Student",
            entityId: student.id,
            changesJson: JSON.stringify({
              oldStage: student.stage,
              newStage: targetStage,
              performedBy: session.user.name || session.user.email,
              bulk: true,
            }),
          },
        });

        await logActivity({
          organizationId: session.user.organizationId,
          entityType: "STUDENT",
          entityId: student.id,
          type: "STAGE_CHANGE",
          metadata: {
            oldStage: student.stage,
            newStage: targetStage,
            bulk: true,
          },
        });
      }

      return NextResponse.json({
        message: `Successfully moved ${result.count} students to ${targetStage}.`,
        count: result.count,
      });
    }

    // 2. Bulk Tag - Add
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
      for (const studentId of studentIds) {
        const existing = await scopedDb.entityTag.findFirst({
          where: {
            entityType: "STUDENT",
            entityId: studentId,
            tagId: resolvedTagId,
          },
        });

        if (!existing) {
          await scopedDb.entityTag.create({
            data: {
              organizationId: session.user.organizationId,
              entityType: "STUDENT",
              entityId: studentId,
              tagId: resolvedTagId,
            },
          });
          attachedCount++;

          await scopedDb.auditLog.create({
            data: {
              organizationId: session.user.organizationId,
              userId: session.user.id,
              action: "TAG_ATTACHED",
              entityType: "Student",
              entityId: studentId,
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
        message: `Tag "${tagRecord.name}" applied across ${attachedCount} students.`,
        count: attachedCount,
        tag: tagRecord,
      });
    }

    // 3. Bulk Tag - Remove
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
          entityType: "STUDENT",
          entityId: { in: studentIds },
          tagId,
        },
      });

      await scopedDb.entityTag.deleteMany({
        where: {
          entityType: "STUDENT",
          entityId: { in: studentIds },
          tagId,
        },
      });

      for (const et of existingEntityTags) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "TAG_DETACHED",
            entityType: "Student",
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
        message: `Tag "${tagRecord?.name || ""}" removed from ${existingEntityTags.length} students.`,
        count: existingEntityTags.length,
      });
    }

    // 4. Bulk Delete (ADMIN Only - Soft Delete)
    if (action === "delete") {
      assertAdmin(session);

      const studentsToDelete = await scopedDb.student.findMany({
        where: { id: { in: studentIds }, isArchived: false },
      });

      const now = new Date();
      const result = await scopedDb.student.updateMany({
        where: {
          id: { in: studentIds },
          isArchived: false,
        },
        data: {
          isArchived: true,
          archivedAt: now,
        },
      });

      for (const student of studentsToDelete) {
        await scopedDb.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "STUDENT_DELETED",
            entityType: "Student",
            entityId: student.id,
            changesJson: JSON.stringify({
              deletedStudentName: student.name,
              deletedStudentEmail: student.email,
              deletedStudentPhone: student.phone,
              deletedStudentStage: student.stage,
              program: student.program,
              cohort: student.cohort,
              performedBy: session.user.name || session.user.email,
              softDelete: true,
              bulk: true,
            }),
          },
        });
      }

      return NextResponse.json({
        message: `Successfully deleted ${result.count} students.`,
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: "Invalid bulk action specified." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error executing bulk student action:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute bulk action." },
      { status: 500 }
    );
  }
}
