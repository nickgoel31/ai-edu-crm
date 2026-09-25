import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStage, StudentStage, PaymentStatus, AgentStatus } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Franchise roll-up: for a franchise HQ org (one that has other orgs
 * pointing at it via parentOrganizationId), computes the same per-org
 * summary as app/api/dashboard/summary/route.ts for the HQ itself and for
 * every linked branch, using the raw prisma client (getScopedPrismaClient
 * is inherently single-tenant, so it can't do this cross-tenant read).
 *
 * This is a deliberately narrow, explicitly authorized cross-tenant read:
 * we only ever query organizations whose parentOrganizationId equals the
 * REQUESTER's own organizationId (never a client-supplied org id list), so
 * a session can only ever see its own branches' data, never anyone else's.
 */

interface OrgSummary {
  activeLeadsCount: number;
  studentsTotalCount: number;
  studentsEnrolledActiveCount: number;
  agentsLiveCount: number;
  agentsTotalCount: number;
  conversationsLast7DaysCount: number;
  overduePaymentsAmount: number;
}

async function computeOrgSummary(organizationId: string): Promise<OrgSummary> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [leads, students, agents, conversationsLast7Days, outstandingPayments] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, stage: true },
    }),
    prisma.student.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, stage: true },
    }),
    prisma.agent.findMany({
      where: { organizationId },
      select: { id: true, status: true },
    }),
    prisma.conversation.count({
      where: {
        agent: { organizationId },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.payment.findMany({
      where: {
        student: { organizationId },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      },
      select: { amount: true, dueDate: true, status: true },
    }),
  ]);

  const activeLeadStages: string[] = [LeadStage.COLD, LeadStage.WARM, LeadStage.HOT, LeadStage.CONVERTING];
  const activeLeadsCount = leads.filter((l) => activeLeadStages.includes(l.stage)).length;

  const studentsEnrolledActiveCount = students.filter(
    (s) => s.stage === StudentStage.ENROLLED || s.stage === StudentStage.ACTIVE
  ).length;

  const agentsLiveCount = agents.filter((a) => a.status === AgentStatus.LIVE).length;

  let overduePaymentsAmount = 0;
  outstandingPayments.forEach((p) => {
    const isOverdue = p.status === PaymentStatus.OVERDUE || new Date(p.dueDate) < now;
    if (isOverdue) overduePaymentsAmount += p.amount;
  });

  return {
    activeLeadsCount,
    studentsTotalCount: students.length,
    studentsEnrolledActiveCount,
    agentsLiveCount,
    agentsTotalCount: agents.length,
    conversationsLast7DaysCount: conversationsLast7Days,
    overduePaymentsAmount,
  };
}

function sumSummaries(summaries: OrgSummary[]): OrgSummary {
  return summaries.reduce(
    (acc, s) => ({
      activeLeadsCount: acc.activeLeadsCount + s.activeLeadsCount,
      studentsTotalCount: acc.studentsTotalCount + s.studentsTotalCount,
      studentsEnrolledActiveCount: acc.studentsEnrolledActiveCount + s.studentsEnrolledActiveCount,
      agentsLiveCount: acc.agentsLiveCount + s.agentsLiveCount,
      agentsTotalCount: acc.agentsTotalCount + s.agentsTotalCount,
      conversationsLast7DaysCount: acc.conversationsLast7DaysCount + s.conversationsLast7DaysCount,
      overduePaymentsAmount: acc.overduePaymentsAmount + s.overduePaymentsAmount,
    }),
    {
      activeLeadsCount: 0,
      studentsTotalCount: 0,
      studentsEnrolledActiveCount: 0,
      agentsLiveCount: 0,
      agentsTotalCount: 0,
      conversationsLast7DaysCount: 0,
      overduePaymentsAmount: 0,
    }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const organizationId = session.user.organizationId;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, brandLogoUrl: true, brandPrimaryColor: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    // Only ever query orgs whose parentOrganizationId is THIS session's own
    // organizationId — never a client-supplied list of org ids.
    const branchOrgs = await prisma.organization.findMany({
      where: { parentOrganizationId: organizationId },
      select: { id: true, name: true, slug: true, brandLogoUrl: true, brandPrimaryColor: true },
      orderBy: { name: "asc" },
    });

    if (branchOrgs.length === 0) {
      return NextResponse.json({ isFranchiseHQ: false });
    }

    const hqSummary = await computeOrgSummary(org.id);
    const branchSummaries = await Promise.all(
      branchOrgs.map(async (b) => ({
        ...b,
        ...(await computeOrgSummary(b.id)),
      }))
    );

    const totals = sumSummaries([hqSummary, ...branchSummaries]);

    return NextResponse.json({
      isFranchiseHQ: true,
      hq: { id: org.id, name: org.name, slug: org.slug, ...hqSummary },
      branches: branchSummaries,
      totals,
    });
  } catch (error: any) {
    console.error("Error computing franchise overview:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to compute franchise overview." },
      { status: 500 }
    );
  }
}
