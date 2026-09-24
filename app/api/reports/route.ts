import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { prisma } from "@/lib/prisma";
import {
  LeadSource,
  LeadStage,
  ConversationOutcome,
  Role,
} from "@/types";
import { getSlaComplianceStats } from "@/lib/sla";

// Estimated benchmark Cost Per Lead (CPL) in INR for non-agent paid channels
const ESTIMATED_CPL: Record<string, number> = {
  META_ADS: 220,
  GOOGLE_ADS: 380,
  WHATSAPP: 45,
  CALL_TRACKING: 60,
  WEBSITE_FORM: 30,
  GOOGLE_SHEETS: 15,
  CSV_IMPORT: 10,
  REFERRAL: 0,
  MANUAL: 0,
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const orgId = session.user.organizationId;
    const userRole = session.user.role;
    const isAdmin = userRole === Role.ADMIN;
    const scopedDb = getScopedPrismaClient(session);

    const { searchParams } = new URL(req.url);
    const dateRangeParam = searchParams.get("dateRange") || "all";
    const sourceParam = searchParams.get("source") || "ALL";

    // Date range filter
    const now = new Date();
    let startDate: Date | null = null;

    if (dateRangeParam === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRangeParam === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRangeParam === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRangeParam === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const leadWhere: any = {};
    if (startDate) {
      leadWhere.createdAt = { gte: startDate };
    }
    if (sourceParam !== "ALL" && Object.values(LeadSource).includes(sourceParam as LeadSource)) {
      leadWhere.source = sourceParam as LeadSource;
    }

    // 1. Fetch filtered leads
    const leads = await scopedDb.lead.findMany({
      where: leadWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, createdAt: true, stage: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Compute Funnel Breakdown & Drop-off
    const stageCounts: Record<string, number> = {
      COLD: 0,
      WARM: 0,
      HOT: 0,
      CONVERTING: 0,
      LOST: 0,
    };

    const lostReasonCounts: Record<string, number> = {};

    leads.forEach((l) => {
      stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
      if (l.stage === LeadStage.LOST && l.lostReason) {
        lostReasonCounts[l.lostReason] = (lostReasonCounts[l.lostReason] || 0) + 1;
      }
    });

    const totalLeads = leads.length;
    const coldCount = stageCounts.COLD || 0;
    const warmCount = stageCounts.WARM || 0;
    const hotCount = stageCounts.HOT || 0;
    const convertingCount = stageCounts.CONVERTING || 0;
    const lostCount = stageCounts.LOST || 0;

    // Cumulative progression funnel
    // Stage 1: Ingested (All Leads)
    // Stage 2: Engaged (Warm + Hot + Converting)
    // Stage 3: High Intent (Hot + Converting)
    // Stage 4: Enrolled / Converted (Converting)
    const funnelSteps = [
      {
        id: "TOTAL",
        label: "Ingested Leads",
        count: totalLeads,
        conversionRateFromTotal: 100,
        dropOffCount: 0,
        dropOffPercentage: 0,
        color: "#3b82f6", // blue
      },
      {
        id: "ENGAGED",
        label: "Contacted & Warm",
        count: warmCount + hotCount + convertingCount,
        conversionRateFromTotal: totalLeads > 0 ? Math.round(((warmCount + hotCount + convertingCount) / totalLeads) * 100) : 0,
        dropOffCount: coldCount,
        dropOffPercentage: totalLeads > 0 ? Math.round((coldCount / totalLeads) * 100) : 0,
        color: "#06b6d4", // cyan
      },
      {
        id: "HIGH_INTENT",
        label: "Qualified & Hot",
        count: hotCount + convertingCount,
        conversionRateFromTotal: totalLeads > 0 ? Math.round(((hotCount + convertingCount) / totalLeads) * 100) : 0,
        dropOffCount: warmCount,
        dropOffPercentage:
          warmCount + hotCount + convertingCount > 0
            ? Math.round((warmCount / (warmCount + hotCount + convertingCount)) * 100)
            : 0,
        color: "#f59e0b", // amber
      },
      {
        id: "CONVERTED",
        label: "Admissions Converted",
        count: convertingCount,
        conversionRateFromTotal: totalLeads > 0 ? Math.round((convertingCount / totalLeads) * 100) : 0,
        dropOffCount: hotCount,
        dropOffPercentage:
          hotCount + convertingCount > 0
            ? Math.round((hotCount / (hotCount + convertingCount)) * 100)
            : 0,
        color: "#10b981", // emerald
      },
    ];

    // 3. Source-wise ROI Breakdown
    const sourceBuckets: Record<string, { total: number; converted: number; cost: number }> = {};

    // Initialize all known sources
    Object.values(LeadSource).forEach((s) => {
      sourceBuckets[s] = { total: 0, converted: 0, cost: 0 };
    });

    leads.forEach((lead) => {
      if (!sourceBuckets[lead.source]) {
        sourceBuckets[lead.source] = { total: 0, converted: 0, cost: 0 };
      }
      sourceBuckets[lead.source].total += 1;
      if (lead.stage === LeadStage.CONVERTING || (lead.students && lead.students.length > 0)) {
        sourceBuckets[lead.source].converted += 1;
      }
      // Add benchmark CPL or known channel cost
      sourceBuckets[lead.source].cost += ESTIMATED_CPL[lead.source] || 0;
    });

    // Also include direct AI Agent conversation costs per channel
    const conversationWhere: any = {};
    if (startDate) {
      conversationWhere.createdAt = { gte: startDate };
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        agent: { organizationId: orgId },
        ...conversationWhere,
      },
      include: { agent: true },
    });

    let totalAgentCostPaise = 0;
    conversations.forEach((c) => {
      const paise = c.costInPaise || 0;
      totalAgentCostPaise += paise;
      const costRupees = paise / 100;
      if (c.agent.channel === "WHATSAPP" && sourceBuckets.WHATSAPP) {
        sourceBuckets.WHATSAPP.cost += costRupees;
      } else if (c.agent.channel === "VOICE" && sourceBuckets.CALL_TRACKING) {
        sourceBuckets.CALL_TRACKING.cost += costRupees;
      } else if (c.agent.channel === "WEBSITE_CHAT" && sourceBuckets.WEBSITE_FORM) {
        sourceBuckets.WEBSITE_FORM.cost += costRupees;
      }
    });

    const sourceRoiTable = Object.entries(sourceBuckets)
      .map(([source, stats]) => {
        const rate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;
        const costPerLead = stats.total > 0 ? Math.round(stats.cost / stats.total) : 0;
        const costPerConversion = stats.converted > 0 ? Math.round(stats.cost / stats.converted) : 0;
        return {
          source,
          totalLeads: stats.total,
          convertedLeads: stats.converted,
          conversionRate: rate,
          estimatedSpend: Math.round(stats.cost),
          costPerLead,
          costPerConversion,
        };
      })
      .filter((s) => s.totalLeads > 0 || sourceParam === "ALL")
      .sort((a, b) => b.totalLeads - a.totalLeads);

    // 4. Counselor-wise Performance (ADMIN ONLY)
    let counselorPerformance: any[] | null = null;

    if (isAdmin) {
      // Find all counselors in organization
      const counselors = await scopedDb.user.findMany({
        where: { role: Role.COUNSELOR },
        select: { id: true, name: true, email: true },
      });

      // Also include admins who might have assigned leads
      const allAssignedUserIds = Array.from(
        new Set(leads.map((l) => l.assignedToUserId).filter(Boolean))
      );

      const staffUsers = await scopedDb.user.findMany({
        where: { id: { in: allAssignedUserIds as string[] } },
        select: { id: true, name: true, email: true, role: true },
      });

      const uniqueStaffMap = new Map<string, { id: string; name: string; email: string }>();
      counselors.forEach((c) =>
        uniqueStaffMap.set(c.id, {
          id: c.id,
          name: c.name || "Admissions Counselor",
          email: c.email,
        })
      );
      staffUsers.forEach((u) =>
        uniqueStaffMap.set(u.id, {
          id: u.id,
          name: u.name || "Staff Member",
          email: u.email,
        })
      );

      counselorPerformance = Array.from(uniqueStaffMap.values()).map((counselor) => {
        const counselorLeads = leads.filter((l) => l.assignedToUserId === counselor.id);
        const convertedLeads = counselorLeads.filter(
          (l) => l.stage === LeadStage.CONVERTING || (l.students && l.students.length > 0)
        );

        const convRate =
          counselorLeads.length > 0
            ? Math.round((convertedLeads.length / counselorLeads.length) * 100)
            : 0;

        // Calculate average time-to-conversion in days
        let totalConversionTimeMs = 0;
        let validConversionCount = 0;

        convertedLeads.forEach((l) => {
          const leadCreated = new Date(l.createdAt).getTime();
          let conversionTimestamp = new Date(l.updatedAt).getTime();

          if (l.students && l.students.length > 0) {
            conversionTimestamp = new Date(l.students[0].createdAt).getTime();
          }

          const diffMs = conversionTimestamp - leadCreated;
          if (diffMs >= 0) {
            totalConversionTimeMs += diffMs;
            validConversionCount++;
          }
        });

        const avgTimeToConversionHours =
          validConversionCount > 0
            ? (totalConversionTimeMs / validConversionCount / (1000 * 60 * 60)).toFixed(1)
            : null;

        const avgTimeToConversionDays =
          validConversionCount > 0
            ? (totalConversionTimeMs / validConversionCount / (1000 * 60 * 60 * 24)).toFixed(1)
            : null;

        return {
          counselorId: counselor.id,
          name: counselor.name,
          email: counselor.email,
          leadsAssigned: counselorLeads.length,
          leadsConverted: convertedLeads.length,
          conversionRate: convRate,
          avgTimeToConversionDays: avgTimeToConversionDays ? Number(avgTimeToConversionDays) : null,
          avgTimeToConversionHours: avgTimeToConversionHours ? Number(avgTimeToConversionHours) : null,
        };
      });

      counselorPerformance.sort((a, b) => b.leadsConverted - a.leadsConverted);
    }

    // 5. Agent-wise Conversion & Human vs AI Comparative Benchmarking
    const agents = await scopedDb.agent.findMany({
      orderBy: { createdAt: "asc" },
    });

    const agentStats = agents.map((agent) => {
      const agentConvs = conversations.filter((c) => c.agentId === agent.id);
      const converted = agentConvs.filter((c) => c.outcome === ConversationOutcome.CONVERTED);
      const totalCostPaise = agentConvs.reduce((sum, c) => sum + (c.costInPaise || 0), 0);
      const costInRupees = Number((totalCostPaise / 100).toFixed(2));
      const rate = agentConvs.length > 0 ? Math.round((converted.length / agentConvs.length) * 100) : 0;
      const costPerConv = converted.length > 0 ? Number((costInRupees / converted.length).toFixed(2)) : 0;

      return {
        id: agent.id,
        name: agent.name,
        channel: agent.channel,
        role: agent.role,
        category: agent.category,
        status: agent.status,
        conversationsCount: agentConvs.length,
        convertedCount: converted.length,
        conversionRate: rate,
        costInRupees,
        costPerConversion: costPerConv,
      };
    });

    // Human counselor summary
    const humanAssignedLeads = leads.filter((l) => Boolean(l.assignedToUserId));
    const humanConvertedLeads = humanAssignedLeads.filter(
      (l) => l.stage === LeadStage.CONVERTING || (l.students && l.students.length > 0)
    );
    const humanConversionRate =
      humanAssignedLeads.length > 0
        ? Math.round((humanConvertedLeads.length / humanAssignedLeads.length) * 100)
        : 0;

    // AI Agent total summary
    const totalAiConversations = conversations.length;
    const totalAiConverted = conversations.filter(
      (c) => c.outcome === ConversationOutcome.CONVERTED
    ).length;
    const totalAiConversionRate =
      totalAiConversations > 0 ? Math.round((totalAiConverted / totalAiConversations) * 100) : 0;
    const totalAiCostRupees = Number((totalAgentCostPaise / 100).toFixed(2));

    const comparativeBenchmark = {
      humanCounselors: {
        totalHandled: humanAssignedLeads.length,
        totalConverted: humanConvertedLeads.length,
        conversionRate: humanConversionRate,
        type: "Human Counselors",
      },
      aiAgents: {
        totalHandled: totalAiConversations,
        totalConverted: totalAiConverted,
        conversionRate: totalAiConversionRate,
        totalCostRupees: totalAiCostRupees,
        type: "Autonomous AI Agents",
      },
      comparison: [
        {
          metric: "Handled Volume",
          human: humanAssignedLeads.length,
          ai: totalAiConversations,
        },
        {
          metric: "Converted Total",
          human: humanConvertedLeads.length,
          ai: totalAiConverted,
        },
        {
          metric: "Conversion Rate (%)",
          human: humanConversionRate,
          ai: totalAiConversionRate,
        },
      ],
    };

    // SLA Compliance Metrics filterable by source & date range
    const slaStats = await getSlaComplianceStats({
      organizationId: orgId,
      startDate,
      source: sourceParam,
      client: scopedDb,
    });

    // Overall summary metrics
    const overallConversionRate =
      totalLeads > 0 ? Math.round((convertingCount / totalLeads) * 100) : 0;

    return NextResponse.json({
      lastUpdated: new Date().toISOString(),
      dateRange: dateRangeParam,
      sourceFilter: sourceParam,
      summary: {
        totalLeads,
        coldCount,
        warmCount,
        hotCount,
        convertingCount,
        lostCount,
        overallConversionRate,
        totalAiConversations,
        totalAiCostRupees,
        slaComplianceRate: slaStats.complianceRate,
        slaRespondedCount: slaStats.respondedWithinSlaCount,
        slaBreachedCount: slaStats.breachedSlaCount,
        avgFirstResponseMinutes: slaStats.avgFirstResponseMinutes,
      },
      slaCompliance: slaStats,
      funnel: {
        stageCounts,
        lostReasonCounts,
        steps: funnelSteps,
      },
      sourceRoi: sourceRoiTable,
      counselorPerformance,
      isCounselorRestricted: !isAdmin,
      agentPerformance: agentStats,
      comparativeBenchmark,
    });
  } catch (error: any) {
    console.error("Error generating analytics report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate analytics report." },
      { status: 500 }
    );
  }
}
