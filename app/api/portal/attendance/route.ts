import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardianFromRequest } from "@/lib/guardian-auth";

export async function GET() {
  const guardian = await getGuardianFromRequest();
  if (!guardian) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const records = await prisma.classAttendance.findMany({
    where: {
      organizationId: guardian.organizationId,
      studentId: guardian.studentId,
      date: { gte: since },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      status: true,
      batchId: true,
    },
  });

  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const totalCount = records.length;
  // Treat LATE as counting toward attendance for the percentage, same as
  // most coaching-center attendance policies (present-or-late vs absent).
  const attendancePercentage =
    totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 1000) / 10 : null;

  return NextResponse.json({
    records,
    summary: {
      totalCount,
      presentCount,
      lateCount,
      absentCount: totalCount - presentCount - lateCount,
      attendancePercentage,
    },
  });
}
