import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

export const dynamic = "force-dynamic";

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
        { error: "Forbidden: Admin access required to delete SLA policies" },
        { status: 403 }
      );
    }

    const policyId = params.id;
    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.sLAPolicy.findUnique({
      where: { id: policyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "SLA policy not found" }, { status: 404 });
    }

    await scopedPrisma.sLAPolicy.delete({
      where: { id: policyId },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "SLA_POLICY_DELETED",
        entityType: "SLAPolicy",
        entityId: policyId,
        changesJson: JSON.stringify({
          source: existing.source || "ORG_DEFAULT",
          respondWithinMinutes: existing.respondWithinMinutes,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `SLA policy for ${existing.source || "Default"} removed`,
    });
  } catch (error: any) {
    console.error("DELETE /api/settings/sla/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete SLA policy" },
      { status: 500 }
    );
  }
}
