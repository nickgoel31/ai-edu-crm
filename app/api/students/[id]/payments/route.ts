import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { PaymentStatus } from "@/types";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

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
    const { id: studentId } = params;
    const body = await req.json();
    const { paymentId, status, amount, dueDate } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify student belongs to this organization
    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    // Verify payment belongs to this student
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        studentId: student.id,
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment installment not found for this student." },
        { status: 404 }
      );
    }

    const updates: any = {};
    const changes: any = {};

    if (status && Object.values(PaymentStatus).includes(status)) {
      updates.status = status;
      changes.status = { from: existingPayment.status, to: status };
    }

    if (amount !== undefined && typeof amount === "number") {
      updates.amount = amount;
      changes.amount = { from: existingPayment.amount, to: amount };
    }

    if (dueDate) {
      updates.dueDate = new Date(dueDate);
      changes.dueDate = { from: existingPayment.dueDate, to: updates.dueDate };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updates,
    });

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "PAYMENT_STATUS_UPDATED",
        entityType: "Student",
        entityId: student.id,
        changesJson: {
          paymentId,
          installmentNumber: updatedPayment.installmentNumber,
          amount: updatedPayment.amount,
          ...changes,
        },
      },
    });

    if (changes.status) {
      await logActivity({
        organizationId: session.user.organizationId,
        entityType: "STUDENT",
        entityId: student.id,
        type: "PAYMENT_UPDATE",
        metadata: {
          installmentNumber: updatedPayment.installmentNumber,
          amount: updatedPayment.amount,
          oldStatus: changes.status.from,
          newStatus: changes.status.to,
        },
      });
    }

    return NextResponse.json({ payment: updatedPayment });
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update payment status." },
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
    const { id: studentId } = params;
    const body = await req.json();
    const { amount, dueDate, installmentNumber, status } = body;

    if (amount === undefined || !dueDate) {
      return NextResponse.json(
        { error: "amount and dueDate are required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify student belongs to this organization
    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
      include: {
        payments: {
          orderBy: { installmentNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    const nextInstNumber =
      installmentNumber ||
      (student.payments.length > 0 ? student.payments[0].installmentNumber + 1 : 1);

    const newPayment = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: Number(amount),
        dueDate: new Date(dueDate),
        installmentNumber: nextInstNumber,
        status: status && Object.values(PaymentStatus).includes(status) ? status : PaymentStatus.PENDING,
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "PAYMENT_INSTALLMENT_ADDED",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          paymentId: newPayment.id,
          installmentNumber: newPayment.installmentNumber,
          amount: newPayment.amount,
          dueDate: newPayment.dueDate,
        }),
      },
    });

    return NextResponse.json({ payment: newPayment }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating payment installment:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create payment installment." },
      { status: 500 }
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
    const { id: studentId } = params;
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId query param is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, studentId: student.id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found for this student." },
        { status: 404 }
      );
    }

    await prisma.document.delete({
      where: { id: paymentId },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "PAYMENT_INSTALLMENT_REMOVED",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          installmentNumber: payment.installmentNumber,
          amount: payment.amount,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing payment:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove payment." },
      { status: 500 }
    );
  }
}
