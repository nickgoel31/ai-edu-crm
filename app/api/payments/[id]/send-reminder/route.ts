import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { sendFeeReminder } from "@/lib/fee-reminders";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      assertCanMutate(session);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Forbidden: Read-only accounts cannot send reminders." },
        { status: 403 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    // Payment has no organizationId of its own — scope it manually via its
    // student, which the scoped client already restricts to this org.
    const student = await scopedDb.student.findFirst({
      where: { payments: { some: { id: params.id } } },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }

    const result = await sendFeeReminder(params.id);

    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "FEE_REMINDER_SENT",
        entityType: "PAYMENT",
        entityId: params.id,
        changesJson: JSON.stringify(result),
      },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error("POST /api/payments/[id]/send-reminder error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send reminder." },
      { status: 500 }
    );
  }
}
