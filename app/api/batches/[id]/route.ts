import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { WEEKDAYS } from "@/types";

function safeParseDays(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    const scopedDb = getScopedPrismaClient(session);

    const batch = await scopedDb.batch.findUnique({
      where: { id: params.id },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        students: {
          where: { isArchived: false },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            program: true,
            stage: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Attendance % per student over the batch's lifetime.
    const attendanceRows = await scopedDb.classAttendance.findMany({
      where: { batchId: batch.id },
      select: { studentId: true, status: true, date: true },
    });

    const attendanceByStudent: Record<string, { total: number; present: number }> = {};
    for (const row of attendanceRows) {
      if (!attendanceByStudent[row.studentId]) {
        attendanceByStudent[row.studentId] = { total: 0, present: 0 };
      }
      attendanceByStudent[row.studentId].total += 1;
      if (row.status === "PRESENT" || row.status === "LATE") {
        attendanceByStudent[row.studentId].present += 1;
      }
    }

    const studentsWithAttendance = batch.students.map((s) => {
      const stats = attendanceByStudent[s.id];
      const attendancePercent =
        stats && stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : null;
      return {
        ...s,
        attendance: {
          totalSessions: stats?.total || 0,
          presentCount: stats?.present || 0,
          attendancePercent,
        },
      };
    });

    // Recent attendance history: last 5 distinct session dates x student status.
    const dateKeySet = new Set<string>();
    const byDateKey = new Map<string, Map<string, string>>();
    for (const row of attendanceRows) {
      const key = row.date.toISOString().slice(0, 10);
      dateKeySet.add(key);
      if (!byDateKey.has(key)) byDateKey.set(key, new Map());
      byDateKey.get(key)!.set(row.studentId, row.status);
    }
    const recentDates = Array.from(dateKeySet).sort().slice(-5).reverse();
    const recentAttendance = recentDates.map((dateKey) => ({
      date: dateKey,
      statuses: batch.students.map((s) => ({
        studentId: s.id,
        status: byDateKey.get(dateKey)?.get(s.id) || null,
      })),
    }));

    return NextResponse.json({
      batch: {
        ...batch,
        scheduleDays: safeParseDays(batch.scheduleDays),
        students: studentsWithAttendance,
        recentAttendance,
      },
    });
  } catch (error: any) {
    console.error("Error fetching batch:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch batch." },
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

  try {
    assertCanMutate(session);

    const body = await req.json();
    const {
      name,
      program,
      facultyUserId,
      startDate,
      endDate,
      scheduleDays,
      scheduleTime,
      capacity,
      isActive,
    } = body;

    if (
      scheduleDays !== undefined &&
      scheduleDays !== null &&
      (!Array.isArray(scheduleDays) ||
        scheduleDays.some((d: string) => !WEEKDAYS.includes(d as any)))
    ) {
      return NextResponse.json(
        { error: `scheduleDays must be an array of: ${WEEKDAYS.join(", ")}` },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.batch.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (program !== undefined) data.program = program.trim();
    if (facultyUserId !== undefined) data.facultyUserId = facultyUserId || null;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (scheduleDays !== undefined) data.scheduleDays = JSON.stringify(scheduleDays);
    if (scheduleTime !== undefined) data.scheduleTime = scheduleTime?.trim() || null;
    if (capacity !== undefined) {
      data.capacity = capacity !== null && capacity !== "" ? Number(capacity) : null;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const batch = await scopedDb.batch.update({
      where: { id: params.id },
      data,
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        _count: { select: { students: true } },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_UPDATED",
        entityType: "Batch",
        entityId: batch.id,
        changesJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({
      batch: { ...batch, scheduleDays: safeParseDays(batch.scheduleDays) },
    });
  } catch (error: any) {
    console.error("Error updating batch:", error);
    const status = /forbidden/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to update batch." },
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
    assertAdmin(session);

    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.batch.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Unassign any students from this batch before deleting it.
    await scopedDb.student.updateMany({
      where: { batchId: params.id },
      data: { batchId: null },
    });

    await scopedDb.batch.delete({ where: { id: params.id } });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_DELETED",
        entityType: "Batch",
        entityId: params.id,
        changesJson: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ message: "Batch deleted." });
  } catch (error: any) {
    console.error("Error deleting batch:", error);
    const status = /forbidden|admin privileges/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to delete batch." },
      { status }
    );
  }
}
