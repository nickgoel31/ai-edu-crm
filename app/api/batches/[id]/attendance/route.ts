import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { ClassAttendanceStatus } from "@/types";

function parseDateOnly(dateStr: string): Date {
  // Treat the date param as a calendar day, independent of server timezone.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
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
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json({ error: "date query param is required (YYYY-MM-DD)." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);

    const batch = await scopedDb.batch.findUnique({
      where: { id: params.id },
      include: {
        students: {
          where: { isArchived: false },
          select: { id: true, name: true, phone: true, program: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const dayStart = parseDateOnly(dateParam);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const records = await scopedDb.classAttendance.findMany({
      where: {
        batchId: batch.id,
        date: { gte: dayStart, lt: dayEnd },
      },
    });

    const byStudentId = new Map(records.map((r) => [r.studentId, r]));

    const roster = batch.students.map((s) => ({
      studentId: s.id,
      name: s.name,
      phone: s.phone,
      program: s.program,
      status: byStudentId.get(s.id)?.status || null,
      attendanceId: byStudentId.get(s.id)?.id || null,
    }));

    return NextResponse.json({ date: dateParam, roster });
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch attendance." },
      { status: 500 }
    );
  }
}

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
    const { date, records } = body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "date and a non-empty records array are required." },
        { status: 400 }
      );
    }

    const validStatuses = Object.values(ClassAttendanceStatus);
    for (const r of records) {
      if (!r.studentId || !validStatuses.includes(r.status)) {
        return NextResponse.json(
          { error: `Each record needs a studentId and a status of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const scopedDb = getScopedPrismaClient(session);

    const batch = await scopedDb.batch.findUnique({ where: { id: params.id } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const attendanceDate = parseDateOnly(date);

    const results = await Promise.all(
      records.map((r: { studentId: string; status: string }) =>
        scopedDb.classAttendance.upsert({
          where: {
            batchId_studentId_date: {
              batchId: batch.id,
              studentId: r.studentId,
              date: attendanceDate,
            },
          },
          create: {
            organizationId: session.user.organizationId,
            batchId: batch.id,
            studentId: r.studentId,
            date: attendanceDate,
            status: r.status,
            markedByUserId: session.user.id,
          },
          update: {
            status: r.status,
            markedByUserId: session.user.id,
          },
        })
      )
    );

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_ATTENDANCE_MARKED",
        entityType: "Batch",
        entityId: batch.id,
        changesJson: JSON.stringify({ date, count: results.length }),
      },
    });

    return NextResponse.json({ message: "Attendance saved.", count: results.length });
  } catch (error: any) {
    console.error("Error marking attendance:", error);
    const status = /forbidden/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to save attendance." },
      { status }
    );
  }
}
