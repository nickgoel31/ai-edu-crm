import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { recalculateAllLeadsForOrg } from "@/lib/lead-scoring";
import { ScoringOperator } from "@/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required to modify scoring rules" },
        { status: 403 }
      );
    }

    const ruleId = params.id;
    const body = await req.json();
    const { name, field, operator, value, points, enabled, displayOrder } = body;

    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.scoringRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Scoring rule not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (field !== undefined) updateData.field = String(field).trim();
    if (operator !== undefined) {
      if (!Object.values(ScoringOperator).includes(operator)) {
        return NextResponse.json({ error: "Invalid operator" }, { status: 400 });
      }
      updateData.operator = operator;
    }
    if (value !== undefined) updateData.value = String(value).trim();
    if (points !== undefined) updateData.points = Number(points);
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

    const updated = await scopedPrisma.scoringRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Recalculate leads
    await recalculateAllLeadsForOrg(session.user.organizationId);

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "SCORING_RULE_UPDATED",
        entityType: "ScoringRule",
        entityId: ruleId,
        changesJson: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ rule: updated });
  } catch (error: any) {
    console.error("PATCH /api/settings/scoring-rules/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update scoring rule" },
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required to delete scoring rules" },
        { status: 403 }
      );
    }

    const ruleId = params.id;
    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.scoringRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Scoring rule not found" }, { status: 404 });
    }

    await scopedPrisma.scoringRule.delete({
      where: { id: ruleId },
    });

    // Recalculate leads
    await recalculateAllLeadsForOrg(session.user.organizationId);

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "SCORING_RULE_DELETED",
        entityType: "ScoringRule",
        entityId: ruleId,
        changesJson: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ success: true, message: `Rule "${existing.name}" deleted` });
  } catch (error: any) {
    console.error("DELETE /api/settings/scoring-rules/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete scoring rule" },
      { status: 500 }
    );
  }
}
