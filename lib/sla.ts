import { prisma } from "@/lib/prisma";
import { LeadSource, SLAComplianceSummary } from "@/types";

export const DEFAULT_ORG_SLA_MINUTES = 120; // 2 hours default fallback

export const DEFAULT_SLA_PRESETS: Array<{
  source: string | null;
  label: string;
  respondWithinMinutes: number;
  description: string;
}> = [
  {
    source: null,
    label: "Org-Wide Default Fallback",
    respondWithinMinutes: 120,
    description: "Applied to all lead channels without a dedicated source-level policy (2 hours).",
  },
  {
    source: LeadSource.WHATSAPP,
    label: "WhatsApp Inbound",
    respondWithinMinutes: 10,
    description: "High-urgency mobile messaging channel requiring fast first engagement.",
  },
  {
    source: LeadSource.META_ADS,
    label: "Meta Lead Ads",
    respondWithinMinutes: 15,
    description: "Social ad leads with highest conversion when contacted within 15 minutes.",
  },
  {
    source: LeadSource.GOOGLE_ADS,
    label: "Google Search Ads",
    respondWithinMinutes: 20,
    description: "High intent prospective students researching specific courses.",
  },
  {
    source: LeadSource.CALL_TRACKING,
    label: "Voice & Call Tracking",
    respondWithinMinutes: 15,
    description: "Inbound call inquiries and callback requests.",
  },
  {
    source: LeadSource.WEBSITE_FORM,
    label: "Website Inquiries",
    respondWithinMinutes: 30,
    description: "Prospects submitting campus tour or curriculum inquiry forms.",
  },
  {
    source: LeadSource.GOOGLE_SHEETS,
    label: "Google Sheets Sync",
    respondWithinMinutes: 60,
    description: "Partner, school fairs, or expo lead lists synced via spreadsheets.",
  },
  {
    source: LeadSource.CSV_IMPORT,
    label: "Bulk CSV Imports",
    respondWithinMinutes: 180,
    description: "Historical or bulk batch uploads.",
  },
];

/**
 * Computes the SLA dueBy target timestamp for a lead based on matching source policy or org fallback
 */
export async function computeLeadSlaDueBy({
  organizationId,
  source,
  createdAt = new Date(),
  client,
}: {
  organizationId: string;
  source?: string | null;
  createdAt?: Date;
  client?: any;
}): Promise<{ dueBy: Date; respondWithinMinutes: number }> {
  const db = client || prisma;

  let policy = null;

  // 1. Try finding source-specific policy
  if (source) {
    policy = await db.sLAPolicy.findFirst({
      where: {
        organizationId,
        source,
      },
    });
  }

  // 2. Fall back to org-wide default policy (source: null)
  if (!policy) {
    policy = await db.sLAPolicy.findFirst({
      where: {
        organizationId,
        source: null,
      },
    });
  }

  const minutes = policy?.respondWithinMinutes || DEFAULT_ORG_SLA_MINUTES;
  const dueBy = new Date(new Date(createdAt).getTime() + minutes * 60 * 1000);

  return { dueBy, respondWithinMinutes: minutes };
}

/**
 * Records first contact against a lead when an Activity (Note, Call, Email, AI Conversation) is logged.
 * Sets firstContactAt and marks whether SLA was breached.
 */
export async function recordLeadFirstContact({
  leadId,
  organizationId,
  contactTimestamp = new Date(),
  client,
}: {
  leadId: string;
  organizationId: string;
  contactTimestamp?: Date;
  client?: any;
}) {
  const db = client || prisma;

  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true, firstContactAt: true, slaDueBy: true, createdAt: true },
  });

  if (!lead || lead.firstContactAt) {
    // Already recorded first contact
    return null;
  }

  const isBreached = lead.slaDueBy
    ? new Date(contactTimestamp).getTime() > new Date(lead.slaDueBy).getTime()
    : false;

  const updatedLead = await db.lead.update({
    where: { id: leadId },
    data: {
      firstContactAt: contactTimestamp,
      slaBreached: isBreached,
    },
  });

  return {
    lead: updatedLead,
    isBreached,
    responseTimeMinutes: Math.round(
      (new Date(contactTimestamp).getTime() - new Date(lead.createdAt).getTime()) / (60 * 1000)
    ),
  };
}

/**
 * Evaluates all active leads in an organization to mark slaBreached = true if current time passed slaDueBy
 */
export async function updateOverdueLeadSlaStatus(organizationId: string, client?: any) {
  const db = client || prisma;
  const now = new Date();

  const result = await db.lead.updateMany({
    where: {
      organizationId,
      firstContactAt: null,
      slaDueBy: { lt: now },
      slaBreached: false,
    },
    data: {
      slaBreached: true,
    },
  });

  return result.count;
}

/**
 * Calculates SLA compliance statistics for reporting & dashboard cards
 */
export async function getSlaComplianceStats({
  organizationId,
  startDate,
  source,
  client,
}: {
  organizationId: string;
  startDate?: Date | null;
  source?: string;
  client?: any;
}): Promise<SLAComplianceSummary> {
  const db = client || prisma;

  // 1. Fetch configured policies for this org
  const policies = await db.sLAPolicy.findMany({
    where: { organizationId },
  });
  const policyMap = new Map<string, number>();
  let defaultOrgMinutes = DEFAULT_ORG_SLA_MINUTES;

  policies.forEach((p: any) => {
    if (p.source === null) {
      defaultOrgMinutes = p.respondWithinMinutes;
    } else {
      policyMap.set(p.source, p.respondWithinMinutes);
    }
  });

  // 2. Build where clause for leads
  const where: any = {
    organizationId,
    isArchived: false,
  };

  if (startDate) {
    where.createdAt = { gte: startDate };
  }
  if (source && source !== "ALL") {
    where.source = source;
  }

  const leads = await db.lead.findMany({
    where,
    select: {
      id: true,
      source: true,
      createdAt: true,
      slaDueBy: true,
      firstContactAt: true,
      slaBreached: true,
    },
  });

  const now = new Date();
  let respondedWithinSlaCount = 0;
  let breachedSlaCount = 0;
  let pendingSlaCount = 0;
  let totalResponseTimeMinutes = 0;
  let responseTimeCount = 0;

  // Per source breakdown tracking
  const sourceStatsMap = new Map<
    string,
    {
      total: number;
      respondedOnTime: number;
      breached: number;
      pending: number;
    }
  >();

  leads.forEach((lead: any) => {
    const src = lead.source;
    if (!sourceStatsMap.has(src)) {
      sourceStatsMap.set(src, {
        total: 0,
        respondedOnTime: 0,
        breached: 0,
        pending: 0,
      });
    }
    const stat = sourceStatsMap.get(src)!;
    stat.total += 1;

    const hasContact = Boolean(lead.firstContactAt);
    const dueBy = lead.slaDueBy ? new Date(lead.slaDueBy) : null;

    if (hasContact) {
      const contactTime = new Date(lead.firstContactAt).getTime();
      const createTime = new Date(lead.createdAt).getTime();
      const diffMinutes = Math.max(0, Math.round((contactTime - createTime) / (60 * 1000)));
      totalResponseTimeMinutes += diffMinutes;
      responseTimeCount += 1;

      if (!dueBy || contactTime <= dueBy.getTime()) {
        respondedWithinSlaCount += 1;
        stat.respondedOnTime += 1;
      } else {
        breachedSlaCount += 1;
        stat.breached += 1;
      }
    } else {
      // Pending first contact
      if (dueBy && now.getTime() > dueBy.getTime()) {
        // Already passed deadline without response
        breachedSlaCount += 1;
        stat.breached += 1;
      } else {
        pendingSlaCount += 1;
        stat.pending += 1;
      }
    }
  });

  const totalLeadsWithSla = leads.length;
  const resolvedCount = respondedWithinSlaCount + breachedSlaCount;
  const complianceRate =
    resolvedCount > 0
      ? Math.round((respondedWithinSlaCount / resolvedCount) * 100)
      : totalLeadsWithSla > 0
      ? 100
      : 100;

  const avgFirstResponseMinutes =
    responseTimeCount > 0
      ? Math.round(totalResponseTimeMinutes / responseTimeCount)
      : null;

  const sourceBreakdown = Array.from(sourceStatsMap.entries())
    .map(([src, stat]) => {
      const srcResolved = stat.respondedOnTime + stat.breached;
      const rate = srcResolved > 0 ? Math.round((stat.respondedOnTime / srcResolved) * 100) : 100;
      const configuredMinutes = policyMap.get(src) || defaultOrgMinutes;
      return {
        source: src,
        total: stat.total,
        respondedOnTime: stat.respondedOnTime,
        breached: stat.breached,
        pending: stat.pending,
        complianceRate: rate,
        respondWithinMinutes: configuredMinutes,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    totalLeadsWithSla,
    respondedWithinSlaCount,
    breachedSlaCount,
    pendingSlaCount,
    complianceRate,
    avgFirstResponseMinutes,
    sourceBreakdown,
  };
}
