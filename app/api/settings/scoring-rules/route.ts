import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { previewScoringRulesImpact, recalculateAllLeadsForOrg, DEFAULT_SCORING_RULE_SUGGESTIONS } from "@/lib/lead-scoring";
import { ScoringOperator } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    let rules = await scopedPrisma.scoringRule.findMany({
      orderBy: { displayOrder: "asc" },
    });

    // If tenant has no rules yet, return templates alongside
    const impactCounts = await previewScoringRulesImpact(orgId);

    // Calculate overall stats for header
    const leads = await scopedPrisma.lead.findMany({
      where: { isArchived: false },
      select: { score: true },
    });

    const totalLeads = leads.length;
    const scoredLeads = leads.filter((l) => l.score !== null);
    const averageScore =
      scoredLeads.length > 0
        ? Math.round(
            scoredLeads.reduce((acc, curr) => acc + (curr.score || 0), 0) /
              scoredLeads.length
          )
        : 50;

    const hotLeadsCount = leads.filter((l) => (l.score || 0) >= 70).length;
    const coldLeadsCount = leads.filter((l) => (l.score || 0) < 40).length;

    const rulesWithCounts = rules.map((r) => ({
      ...r,
      matchedCount: impactCounts[r.id] || 0,
    }));

    return NextResponse.json({
      rules: rulesWithCounts,
      stats: {
        totalRules: rules.length,
        enabledRules: rules.filter((r) => r.enabled).length,
        totalLeads,
        avgScore: averageScore,
        hotLeadsCount,
        coldLeadsCount,
      },
      templates: DEFAULT_SCORING_RULE_SUGGESTIONS,
    });
  } catch (error: any) {
    console.error("GET /api/settings/scoring-rules error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch scoring rules" },
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required to configure lead scoring rules" },
        { status: 403 }
      );
    }

    const scopedPrisma = getScopedPrismaClient(session);
    const body = await req.json();
    const { name, field, operator, value, points, enabled = true, loadDefaults } = body;

    // 1. Bulk load default suggestions if requested
    if (loadDefaults) {
      const createdRules = [];
      let order = 1;
      for (const t of DEFAULT_SCORING_RULE_SUGGESTIONS) {
        const rule = await scopedPrisma.scoringRule.create({
          data: {
            organizationId: session.user.organizationId,
            name: t.name,
            field: t.field,
            operator: t.operator,
            value: t.value,
            points: t.points,
            enabled: t.enabled,
            displayOrder: order++,
          },
        });
        createdRules.push(rule);
      }

      // Automatically recalculate leads
      await recalculateAllLeadsForOrg(session.user.organizationId);

      await scopedPrisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: "DEFAULT_SCORING_RULES_LOADED",
          entityType: "ScoringRule",
          entityId: "BULK",
          changesJson: JSON.stringify({ count: createdRules.length }),
        },
      });

      return NextResponse.json({ rules: createdRules, message: "Default scoring rules installed successfully" }, { status: 201 });
    }

    // 2. Standard Single Rule Creation
    if (!name?.trim() || !field?.trim() || !operator || value === undefined || points === undefined) {
      return NextResponse.json(
        { error: "Name, field, operator, value, and points are required." },
        { status: 400 }
      );
    }

    if (!Object.values(ScoringOperator).includes(operator)) {
      return NextResponse.json(
        { error: "Invalid operator. Must be EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, or CONTAINS." },
        { status: 400 }
      );
    }

    const currentCount = await scopedPrisma.scoringRule.count();

    const newRule = await scopedPrisma.scoringRule.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        field: field.trim(),
        operator,
        value: String(value).trim(),
        points: Number(points),
        enabled: Boolean(enabled),
        displayOrder: currentCount + 1,
      },
    });

    // Recalculate lead scores in the background for this org
    await recalculateAllLeadsForOrg(session.user.organizationId);

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "SCORING_RULE_CREATED",
        entityType: "ScoringRule",
        entityId: newRule.id,
        changesJson: JSON.stringify({
          name: newRule.name,
          field: newRule.field,
          operator: newRule.operator,
          points: newRule.points,
        }),
      },
    });

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/settings/scoring-rules error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create scoring rule" },
      { status: 500 }
    );
  }
}
