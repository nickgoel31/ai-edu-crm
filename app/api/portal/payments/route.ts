import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardianFromRequest } from "@/lib/guardian-auth";

export async function GET() {
  const guardian = await getGuardianFromRequest();
  if (!guardian) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense in depth: Payment has no organizationId column of its own, so
  // scope through its parent Student, which we've already verified belongs
  // to this guardian's org.
  const student = await prisma.student.findFirst({
    where: { id: guardian.studentId, organizationId: guardian.organizationId },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Linked student not found." }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { studentId: guardian.studentId },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      status: true,
      installmentNumber: true,
    },
  });

  const pendingTotal = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amount, 0);
  const overdueTotal = payments
    .filter((p) => p.status === "OVERDUE")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidTotal = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({
    payments,
    summary: {
      pendingTotal,
      overdueTotal,
      paidTotal,
      dueTotal: pendingTotal + overdueTotal,
    },
  });
}
