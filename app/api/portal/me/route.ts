import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardianFromRequest } from "@/lib/guardian-auth";

export async function GET() {
  const guardian = await getGuardianFromRequest();
  if (!guardian) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findFirst({
    where: { id: guardian.studentId, organizationId: guardian.organizationId },
    select: {
      id: true,
      name: true,
      program: true,
      cohort: true,
      branch: true,
      stage: true,
      batchId: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Linked student not found." }, { status: 404 });
  }

  let batch: { id: string; name: string; scheduleDays: string; scheduleTime: string | null } | null = null;
  if (student.batchId) {
    batch = await prisma.batch.findFirst({
      where: { id: student.batchId, organizationId: guardian.organizationId },
      select: { id: true, name: true, scheduleDays: true, scheduleTime: true },
    });
  }

  return NextResponse.json({
    guardian: {
      id: guardian.id,
      name: guardian.name,
      email: guardian.email,
    },
    student: {
      ...student,
      batch: batch
        ? {
            id: batch.id,
            name: batch.name,
            scheduleDays: (() => {
              try {
                return JSON.parse(batch.scheduleDays);
              } catch {
                return [];
              }
            })(),
            scheduleTime: batch.scheduleTime,
          }
        : null,
    },
  });
}
