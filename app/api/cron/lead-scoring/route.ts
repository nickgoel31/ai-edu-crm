import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateAllLeadsForOrg } from "@/lib/lead-scoring";

export const dynamic = "force-dynamic";

/**
 * Nightly Cron Sweep for Lead Scoring
 * Re-evaluates time-based rules (days in stage, days since last activity) across all tenants.
 */
export async function GET(req: NextRequest) {
  try {
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    const results = [];
    for (const org of organizations) {
      const res = await recalculateAllLeadsForOrg(org.id);
      results.push({
        orgId: org.id,
        name: org.name,
        updatedLeads: res.updatedCount,
        averageScore: res.averageScore,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tenantsScored: organizations.length,
      results,
    });
  } catch (error: any) {
    console.error("Cron /api/cron/lead-scoring error:", error);
    return NextResponse.json(
      { error: error?.message || "Nightly lead scoring sweep failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
