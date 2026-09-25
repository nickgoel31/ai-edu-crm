import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardianFromRequest } from "@/lib/guardian-auth";

// Read-only for guardians: intentionally no POST/PATCH/DELETE handlers here.
export async function GET() {
  const guardian = await getGuardianFromRequest();
  if (!guardian) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense in depth: Document has no organizationId column of its own, so
  // scope through its parent Student, which we've already verified belongs
  // to this guardian's org.
  const student = await prisma.student.findFirst({
    where: { id: guardian.studentId, organizationId: guardian.organizationId },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Linked student not found." }, { status: 404 });
  }

  const documents = await prisma.document.findMany({
    where: { studentId: guardian.studentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ documents });
}
