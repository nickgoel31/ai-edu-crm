import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { AgentTriggerEvent } from "@/types";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const { id } = params;
    const body = await req.json();
    const { triggerEvent, conditions, enabled } = body;

    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.agentTrigger.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Trigger not found in this organization." }, { status: 404 });
    }

    const updates: any = {};
    if (triggerEvent !== undefined) {
      if (!Object.values(AgentTriggerEvent).includes(triggerEvent)) {
        return NextResponse.json({ error: "Invalid triggerEvent." }, { status: 400 });
      }
      updates.triggerEvent = triggerEvent;
    }
    if (conditions !== undefined) {
      updates.conditions = conditions ? JSON.stringify(conditions) : null;
    }
    if (enabled !== undefined) {
      updates.enabled = !!enabled;
    }

    const updated = await scopedDb.agentTrigger.update({
      where: { id },
      data: updates,
      include: {
        agent: {
          select: { id: true, name: true, role: true, channel: true, category: true, status: true },
        },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "AGENT_TRIGGER_UPDATED",
        entityType: "AgentTrigger",
        entityId: id,
        changesJson: JSON.stringify(updates),
      },
    });

    return NextResponse.json({
      trigger: { ...updated, conditions: updated.conditions ? JSON.parse(updated.conditions) : {} },
    });
  } catch (error: any) {
    console.error("Error updating agent trigger:", error);
    const status = error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to update agent trigger." },
      { status }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.agentTrigger.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Trigger not found." }, { status: 404 });
    }

    await scopedDb.agentTrigger.delete({ where: { id } });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "AGENT_TRIGGER_DELETED",
        entityType: "AgentTrigger",
        entityId: id,
        changesJson: JSON.stringify({ agentId: existing.agentId, triggerEvent: existing.triggerEvent }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting agent trigger:", error);
    const status = error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to delete agent trigger." },
      { status }
    );
  }
}
