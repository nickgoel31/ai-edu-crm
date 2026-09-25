import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";

export async function PATCH(
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
        { error: err?.message || "Forbidden: Read-only accounts cannot update referral payouts." },
        { status: 403 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;
    const body = await req.json();
    const { status, upiVpa } = body || {};

    const existing = await scopedDb.referralPayout.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Referral payout not found." },
        { status: 404 }
      );
    }

    const data: Record<string, any> = {};
    if (status) {
      if (!["PENDING", "PAID", "CANCELLED"].includes(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      data.status = status;
      if (status === "PAID") {
        data.paidAt = new Date();
      }
    }
    if (typeof upiVpa === "string") {
      data.upiVpa = upiVpa || null;
    }

    const payout = await scopedDb.referralPayout.update({
      where: { id: params.id },
      data,
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "REFERRAL_PAYOUT_UPDATED",
        entityType: "REFERRAL_PAYOUT",
        entityId: payout.id,
        changesJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ payout });
  } catch (error: any) {
    console.error("PATCH /api/referrals/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update referral payout." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      assertAdmin(session);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Forbidden: Admin privileges required." },
        { status: 403 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    const existing = await scopedDb.referralPayout.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Referral payout not found." },
        { status: 404 }
      );
    }

    await scopedDb.referralPayout.delete({ where: { id: params.id } });

    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "REFERRAL_PAYOUT_DELETED",
        entityType: "REFERRAL_PAYOUT",
        entityId: params.id,
        changesJson: JSON.stringify({ referrerName: existing.referrerName, amount: existing.amount }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/referrals/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete referral payout." },
      { status: 500 }
    );
  }
}
