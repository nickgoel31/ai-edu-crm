import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";

export async function POST(
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
    assertCanMutate(session);

    const body = await req.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "studentIds must be a non-empty array." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const batch = await scopedDb.batch.findUnique({
      where: { id: params.id },
      include: { _count: { select: { students: true } } },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    if (batch.capacity !== null && batch.capacity !== undefined) {
      // Only count students being added that aren't already in this batch.
      const alreadyInBatch = await scopedDb.student.count({
        where: { id: { in: studentIds }, batchId: batch.id },
      });
      const newAdditions = studentIds.length - alreadyInBatch;
      const slotsLeft = batch.capacity - batch._count.students;

      if (newAdditions > slotsLeft) {
        return NextResponse.json(
          {
            error: `Adding ${newAdditions} student(s) would exceed batch capacity. Only ${Math.max(
              slotsLeft,
              0
            )} slot(s) left.`,
            slotsLeft: Math.max(slotsLeft, 0),
          },
          { status: 400 }
        );
      }
    }

    const result = await scopedDb.student.updateMany({
      where: { id: { in: studentIds } },
      data: { batchId: batch.id },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_STUDENTS_ASSIGNED",
        entityType: "Batch",
        entityId: batch.id,
        changesJson: JSON.stringify({ studentIds, count: result.count }),
      },
    });

    return NextResponse.json({ message: "Students assigned.", count: result.count });
  } catch (error: any) {
    console.error("Error assigning students to batch:", error);
    const status = /forbidden/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to assign students." },
      { status }
    );
  }
}

export async function DELETE(
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
    assertCanMutate(session);

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.batchId !== params.id) {
      return NextResponse.json(
        { error: "Student is not enrolled in this batch." },
        { status: 404 }
      );
    }

    await scopedDb.student.update({
      where: { id: studentId },
      data: { batchId: null },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_STUDENT_REMOVED",
        entityType: "Batch",
        entityId: params.id,
        changesJson: JSON.stringify({ studentId }),
      },
    });

    return NextResponse.json({ message: "Student removed from batch." });
  } catch (error: any) {
    console.error("Error removing student from batch:", error);
    const status = /forbidden/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to remove student." },
      { status }
    );
  }
}
