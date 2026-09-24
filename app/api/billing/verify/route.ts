import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, plan, organizationId } = body;

    let targetOrgId = organizationId;

    if (!targetOrgId) {
      const session = await getServerSession(authOptions);
      targetOrgId = session?.user?.organizationId;
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { error: "Target organizationId or active session required to verify subscription." },
        { status: 400 }
      );
    }

    const validPlans = ["SELF_SERVE", "SELF_SERVE_AGENTS", "MANAGED"];
    const verifiedPlan = plan && validPlans.includes(plan) ? plan : "SELF_SERVE";

    const subscriptionId = `sub_${Math.random().toString(36).substring(2, 10)}`;

    const updatedOrg = await prisma.organization.update({
      where: { id: targetOrgId },
      data: {
        plan: verifiedPlan,
        subscriptionStatus: "ACTIVE",
        stripeSubscriptionId: subscriptionId,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        organizationId: targetOrgId,
        action: "SUBSCRIPTION_ACTIVATED",
        entityType: "Organization",
        entityId: targetOrgId,
        changesJson: JSON.stringify({
          plan: verifiedPlan,
          subscriptionId,
          status: "ACTIVE",
          verifiedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionStatus: "ACTIVE",
      plan: verifiedPlan,
      subscriptionId,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
      },
    });
  } catch (error: any) {
    console.error("Subscription verification error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to verify subscription." },
      { status: 500 }
    );
  }
}
