import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { AgentTriggerEvent } from "@/types";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId") || undefined;

    const scopedDb = getScopedPrismaClient(session);

    const triggers = await scopedDb.agentTrigger.findMany({
      where: agentId ? { agentId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        agent: {
          select: { id: true, name: true, role: true, channel: true, category: true, status: true },
        },
        fires: {
          orderBy: { lastTriggeredAt: "desc" },
          take: 10,
        },
      },
    });

    const parsed = triggers.map((t) => ({
      ...t,
      conditions: t.conditions ? JSON.parse(t.conditions) : {},
    }));

    return NextResponse.json({ triggers: parsed });
  } catch (error: any) {
    console.error("Error fetching agent triggers:", error);
    const status = error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to fetch agent triggers." },
      { status }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const body = await req.json();
    const { agentId, triggerEvent, conditions, enabled } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }
    if (!triggerEvent || !Object.values(AgentTriggerEvent).includes(triggerEvent)) {
      return NextResponse.json({ error: "A valid triggerEvent is required." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);

    const agent = await scopedDb.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found in this organization." }, { status: 404 });
    }

    const trigger = await scopedDb.agentTrigger.create({
      data: {
        organizationId: session.user.organizationId,
        agentId,
        triggerEvent,
        conditions: conditions ? JSON.stringify(conditions) : null,
        enabled: enabled !== false,
      },
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
        action: "AGENT_TRIGGER_CREATED",
        entityType: "AgentTrigger",
        entityId: trigger.id,
        changesJson: JSON.stringify({ agentId, triggerEvent, conditions, enabled: trigger.enabled }),
      },
    });

    return NextResponse.json(
      { trigger: { ...trigger, conditions: trigger.conditions ? JSON.parse(trigger.conditions) : {} } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating agent trigger:", error);
    const status = error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to create agent trigger." },
      { status }
    );
  }
}
