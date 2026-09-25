import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const FALLBACK_INCENTIVE_AMOUNT = 2000;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedDb = getScopedPrismaClient(session);

    const payouts = await scopedDb.referralPayout.findMany({
      where: {},
      include: {
        referrerStudent: { select: { id: true, name: true, phone: true } },
        referredLead: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ payouts });
  } catch (error: any) {
    console.error("GET /api/referrals error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load referral payouts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      assertCanMutate(session);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Forbidden: Read-only accounts cannot create referral payouts." },
        { status: 403 }
      );
    }

    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);
    const body = await req.json();
    const {
      referrerStudentId,
      referrerName,
      referrerPhone,
      referredLeadId,
      amount,
      upiVpa,
    } = body || {};

    if (!referrerName || !referrerPhone) {
      return NextResponse.json(
        { error: "referrerName and referrerPhone are required." },
        { status: 400 }
      );
    }

    let payoutAmount = typeof amount === "number" && amount > 0 ? amount : null;

    if (payoutAmount === null) {
      try {
        const agent = await prisma.agent.findFirst({
          where: { organizationId: orgId, role: "ALUMNI_REFERRAL" },
        });
        if (agent?.config) {
          const config = JSON.parse(agent.config);
          if (typeof config?.referralIncentiveAmount === "number") {
            payoutAmount = config.referralIncentiveAmount;
          }
        }
      } catch {
        // fall through to flat fallback below
      }
    }

    if (payoutAmount === null) {
      payoutAmount = FALLBACK_INCENTIVE_AMOUNT;
    }

    const payout = await scopedDb.referralPayout.create({
      data: {
        organizationId: orgId,
        referrerStudentId: referrerStudentId || null,
        referrerName,
        referrerPhone,
        referredLeadId: referredLeadId || null,
        amount: payoutAmount,
        upiVpa: upiVpa || null,
        status: "PENDING",
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "REFERRAL_PAYOUT_CREATED",
        entityType: "REFERRAL_PAYOUT",
        entityId: payout.id,
        changesJson: JSON.stringify({ referrerName, referrerPhone, amount: payoutAmount }),
      },
    });

    return NextResponse.json({ payout }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/referrals error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create referral payout." },
      { status: 500 }
    );
  }
}
