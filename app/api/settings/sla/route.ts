import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { DEFAULT_SLA_PRESETS, DEFAULT_ORG_SLA_MINUTES, getSlaComplianceStats } from "@/lib/sla";
import { LeadSource } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    const policies = await scopedPrisma.sLAPolicy.findMany({
      orderBy: { createdAt: "asc" },
    });

    const stats = await getSlaComplianceStats({
      organizationId: orgId,
      client: scopedPrisma,
    });

    return NextResponse.json({
      policies,
      stats,
      presets: DEFAULT_SLA_PRESETS,
      defaultOrgMinutes: DEFAULT_ORG_SLA_MINUTES,
    });
  } catch (error: any) {
    console.error("GET /api/settings/sla error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch SLA policies" },
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
        { error: "Forbidden: Admin access required to configure SLA policies" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { source, respondWithinMinutes, loadPresets } = body;
    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    // 1. Install Default Presets
    if (loadPresets) {
      const created = [];
      for (const preset of DEFAULT_SLA_PRESETS) {
        const existing = await scopedPrisma.sLAPolicy.findFirst({
          where: {
            organizationId: orgId,
            source: preset.source,
          },
        });

        if (existing) {
          const updated = await scopedPrisma.sLAPolicy.update({
            where: { id: existing.id },
            data: { respondWithinMinutes: preset.respondWithinMinutes },
          });
          created.push(updated);
        } else {
          const newPolicy = await scopedPrisma.sLAPolicy.create({
            data: {
              organizationId: orgId,
              source: preset.source,
              respondWithinMinutes: preset.respondWithinMinutes,
            },
          });
          created.push(newPolicy);
        }
      }

      await scopedPrisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.user.id,
          action: "DEFAULT_SLA_PRESETS_INSTALLED",
          entityType: "SLAPolicy",
          entityId: "BULK",
          changesJson: JSON.stringify({ count: created.length }),
        },
      });

      return NextResponse.json(
        { message: "Default SLA policies installed", policies: created },
        { status: 201 }
      );
    }

    // 2. Create or Upsert Single Policy
    if (respondWithinMinutes === undefined || Number(respondWithinMinutes) <= 0) {
      return NextResponse.json(
        { error: "respondWithinMinutes must be a positive number of minutes" },
        { status: 400 }
      );
    }

    const targetSource = source ? String(source).trim() : null;
    if (targetSource && !Object.values(LeadSource).includes(targetSource as LeadSource)) {
      return NextResponse.json(
        { error: `Invalid source: ${targetSource}. Must be a valid LeadSource enum.` },
        { status: 400 }
      );
    }

    const minutes = Number(respondWithinMinutes);

    // Upsert policy
    let policy = await scopedPrisma.sLAPolicy.findFirst({
      where: {
        organizationId: orgId,
        source: targetSource,
      },
    });

    if (policy) {
      policy = await scopedPrisma.sLAPolicy.update({
        where: { id: policy.id },
        data: { respondWithinMinutes: minutes },
      });
    } else {
      policy = await scopedPrisma.sLAPolicy.create({
        data: {
          organizationId: orgId,
          source: targetSource,
          respondWithinMinutes: minutes,
        },
      });
    }

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "SLA_POLICY_SAVED",
        entityType: "SLAPolicy",
        entityId: policy.id,
        changesJson: JSON.stringify({
          source: targetSource || "ORG_DEFAULT",
          respondWithinMinutes: minutes,
        }),
      },
    });

    return NextResponse.json({ policy }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/settings/sla error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save SLA policy" },
      { status: 500 }
    );
  }
}
