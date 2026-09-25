import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isVendorAdmin } from "@/lib/vendor-admin";
import { PLAN_CONFIGS, type PlanId } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

// Cross-tenant, platform-operator view: MRR, tenant health, churn risk.
// Deliberately uses the raw (unscoped) prisma client — this is the one
// place in the app that's supposed to see across every organization.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isVendorAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const orgs = await prisma.organization.findMany({
    include: {
      _count: { select: { users: true, leads: true, students: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let mrrPaise = 0;
  let activeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  let canceledCount = 0;
  let trialsExpiringSoon = 0;

  const tenants = await Promise.all(
    orgs.map(async (org) => {
      const planConfig = PLAN_CONFIGS[org.plan as PlanId];

      if (org.subscriptionStatus === "ACTIVE") {
        activeCount++;
        mrrPaise += (planConfig?.amountInInr || 0) * 100;
      } else if (org.subscriptionStatus === "TRIALING") {
        trialingCount++;
        if (org.trialEndsAt && org.trialEndsAt <= sevenDaysFromNow && org.trialEndsAt >= now) {
          trialsExpiringSoon++;
        }
      } else if (org.subscriptionStatus === "PAST_DUE") {
        pastDueCount++;
      } else if (org.subscriptionStatus === "CANCELED") {
        canceledCount++;
      }

      const [conversationsThisMonth, costAgg, lastActivity] = await Promise.all([
        prisma.conversation.count({
          where: { agent: { organizationId: org.id }, createdAt: { gte: startOfMonth } },
        }),
        prisma.conversation.aggregate({
          where: { agent: { organizationId: org.id }, createdAt: { gte: startOfMonth } },
          _sum: { costInPaise: true },
        }),
        prisma.activity.findFirst({
          where: { organizationId: org.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      const isStale = !lastActivity || lastActivity.createdAt < fourteenDaysAgo;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        planName: planConfig?.name || org.plan,
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt,
        createdAt: org.createdAt,
        userCount: org._count.users,
        leadCount: org._count.leads,
        studentCount: org._count.students,
        conversationsThisMonth,
        aiCostThisMonthPaise: costAgg._sum.costInPaise || 0,
        lastActivityAt: lastActivity?.createdAt || null,
        isChurnRisk: isStale && org.subscriptionStatus === "ACTIVE",
      };
    })
  );

  return NextResponse.json({
    summary: {
      totalTenants: orgs.length,
      activeCount,
      trialingCount,
      pastDueCount,
      canceledCount,
      trialsExpiringSoon,
      mrrPaise,
      mrrRupees: (mrrPaise / 100).toFixed(2),
      churnRiskCount: tenants.filter((t) => t.isChurnRisk).length,
    },
    tenants,
  });
}
