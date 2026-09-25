import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { prisma } from "@/lib/prisma";
import { LeadStage, StudentStage, PaymentStatus, AgentStatus } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

    // 1. Leads (non-archived) — used for stage breakdown + 7-day trend
    const leads = await scopedDb.lead.findMany({
      where: { isArchived: false },
      select: { id: true, stage: true, createdAt: true },
    });

    // 2. Students (non-archived) — used for stage breakdown
    const students = await scopedDb.student.findMany({
      where: { isArchived: false },
      select: { id: true, stage: true },
    });

    // 3. Agents — used for live fleet count
    const agents = await scopedDb.agent.findMany({
      select: { id: true, status: true },
    });

    // 4. Conversations for the last 7 days (org-scoped via agent relation —
    //    the Conversation model has no direct organizationId column).
    const recentConversations = await prisma.conversation.findMany({
      where: {
        agent: { organizationId: orgId },
        createdAt: { gte: sevenDaysAgo },
      },
      select: { id: true, createdAt: true },
    });

    // 5. Payments (org-scoped via student relation) — pending/overdue only.
    const outstandingPayments = await prisma.payment.findMany({
      where: {
        student: { organizationId: orgId },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      },
      select: { id: true, amount: true, dueDate: true, status: true },
    });

    // ── Lead stage breakdown ──────────────────────────────────────────
    const leadStageBreakdown = {
      COLD: 0,
      WARM: 0,
      HOT: 0,
      CONVERTING: 0,
    } as Record<string, number>;

    let activeLeadsCount = 0;
    leads.forEach((l) => {
      if (l.stage in leadStageBreakdown) {
        leadStageBreakdown[l.stage] += 1;
        activeLeadsCount += 1;
      }
    });

    // ── Student stage breakdown ───────────────────────────────────────
    const studentStageBreakdown = {
      ENQUIRY: 0,
      ENROLLED: 0,
      ACTIVE: 0,
      ALUMNI: 0,
    } as Record<string, number>;

    students.forEach((s) => {
      if (s.stage in studentStageBreakdown) {
        studentStageBreakdown[s.stage] += 1;
      }
    });

    const enrolledActiveStudentsCount =
      studentStageBreakdown[StudentStage.ENROLLED] + studentStageBreakdown[StudentStage.ACTIVE];

    // ── 7-day lead creation trend ─────────────────────────────────────
    const leadTrend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = leads.filter((l) => {
        const created = new Date(l.createdAt);
        return created >= dayStart && created < dayEnd;
      }).length;
      leadTrend.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }
    const leadsLast7Days = leadTrend.reduce((sum, d) => sum + d.count, 0);

    // ── Payments ───────────────────────────────────────────────────────
    let overdueAmount = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    outstandingPayments.forEach((p) => {
      const isOverdue = p.status === PaymentStatus.OVERDUE || new Date(p.dueDate) < now;
      if (isOverdue) {
        overdueAmount += p.amount;
        overdueCount += 1;
      } else {
        pendingCount += 1;
      }
    });

    // ── Agents & conversations ──────────────────────────────────────────
    const liveAgentsCount = agents.filter((a) => a.status === AgentStatus.LIVE).length;
    const totalAgentsCount = agents.length;

    const conversationsToday = recentConversations.filter(
      (c) => new Date(c.createdAt) >= startOfToday
    ).length;
    const conversationsLast7Days = recentConversations.length;

    return NextResponse.json({
      generatedAt: now.toISOString(),
      leads: {
        activeCount: activeLeadsCount,
        stageBreakdown: leadStageBreakdown,
        last7DaysCount: leadsLast7Days,
        trend: leadTrend,
      },
      students: {
        totalCount: students.length,
        enrolledActiveCount: enrolledActiveStudentsCount,
        stageBreakdown: studentStageBreakdown,
      },
      payments: {
        pendingCount,
        overdueCount,
        overdueAmount,
      },
      agents: {
        liveCount: liveAgentsCount,
        totalCount: totalAgentsCount,
        conversationsToday,
        conversationsLast7Days,
      },
    });
  } catch (error: any) {
    console.error("Error generating dashboard summary:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate dashboard summary." },
      { status: 500 }
    );
  }
}
