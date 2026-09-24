import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { AgentStatus, ConversationOutcome } from "@/types";
import { prisma } from "@/lib/prisma";

export async function GET(
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
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const outcome = searchParams.get("outcome") as ConversationOutcome | null;

    const scopedDb = getScopedPrismaClient(session);

    const agent = await scopedDb.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found in this organization." },
        { status: 404 }
      );
    }

    // Build conversation where filter
    const conversationWhere: any = { agentId: id };
    if (outcome && Object.values(ConversationOutcome).includes(outcome)) {
      conversationWhere.outcome = outcome;
    }

    // Fetch conversations with relations
    const [conversations, allAgentConvs] = await Promise.all([
      prisma.conversation.findMany({
        where: conversationWhere,
        orderBy: { createdAt: "desc" },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              stage: true,
              score: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              stage: true,
              program: true,
              cohort: true,
            },
          },
          claimedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.conversation.findMany({
        where: { agentId: id },
        select: {
          outcome: true,
          costInPaise: true,
          createdAt: true,
        },
      }),
    ]);

    // Compute metrics
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let convsToday = 0;
    let convsThisWeek = 0;
    let convertedCount = 0;
    let escalatedCount = 0;
    let costThisMonthPaise = 0;
    let totalCostPaise = 0;

    const outcomeCounts: Record<string, number> = {
      ALL: allAgentConvs.length,
      CONTINUED: 0,
      ESCALATED: 0,
      CONVERTED: 0,
      NO_RESPONSE: 0,
    };

    allAgentConvs.forEach((c) => {
      const cDate = new Date(c.createdAt);
      if (cDate >= startOfToday) convsToday++;
      if (cDate >= startOfWeek) convsThisWeek++;
      if (c.outcome === ConversationOutcome.CONVERTED) convertedCount++;
      if (c.outcome === ConversationOutcome.ESCALATED) escalatedCount++;
      if (c.costInPaise) {
        totalCostPaise += c.costInPaise;
        if (cDate >= startOfMonth) costThisMonthPaise += c.costInPaise;
      }
      if (outcomeCounts[c.outcome] !== undefined) {
        outcomeCounts[c.outcome]++;
      }
    });

    const conversionRate =
      allAgentConvs.length > 0
        ? Math.round((convertedCount / allAgentConvs.length) * 100)
        : 0;

    let rawConfig: Record<string, any> = {};
    try {
      rawConfig = typeof agent.config === "string" ? JSON.parse(agent.config) : (agent.config || {});
    } catch {
      rawConfig = {};
    }
    const config = {
      workingHours: rawConfig.workingHours || "09:00 - 20:00 IST",
      language: rawConfig.language || "en-IN",
      scriptPromptVersion:
        rawConfig.scriptPromptVersion || rawConfig.systemPromptVersion || "v1.0",
      ...rawConfig,
    };

    return NextResponse.json({
      agent: {
        ...agent,
        config,
      },
      conversations,
      outcomeCounts,
      metrics: {
        conversationsToday: convsToday,
        conversationsThisWeek: convsThisWeek,
        totalConversations: allAgentConvs.length,
        convertedCount,
        escalatedCount,
        conversionRate,
        costThisMonthPaise,
        costThisMonthRupees: (costThisMonthPaise / 100).toFixed(2),
        totalCostPaise,
        totalCostRupees: (totalCostPaise / 100).toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("Error fetching agent details:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch agent profile." },
      { status: 500 }
    );
  }
}

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
    assertCanMutate(session);
    const { id } = params;
    const body = await req.json();
    const { status, name, workingHours, language, scriptPromptVersion, extraConfig, outboundWebhookUrl } = body;

    const scopedDb = getScopedPrismaClient(session);

    const existingAgent = await scopedDb.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Agent not found in this organization." },
        { status: 404 }
      );
    }

    const updates: any = {};
    const auditChanges: Record<string, { from: any; to: any }> = {};

    if (status && Object.values(AgentStatus).includes(status) && status !== existingAgent.status) {
      updates.status = status;
      auditChanges.status = { from: existingAgent.status, to: status };
    }

    if (name && name.trim() !== existingAgent.name) {
      updates.name = name.trim();
      auditChanges.name = { from: existingAgent.name, to: name.trim() };
    }

    if (outboundWebhookUrl !== undefined && outboundWebhookUrl.trim() !== (existingAgent.outboundWebhookUrl || "")) {
      updates.outboundWebhookUrl = outboundWebhookUrl.trim() || null;
      auditChanges.outboundWebhookUrl = { from: existingAgent.outboundWebhookUrl, to: updates.outboundWebhookUrl };
    }

    // Update config fields
    let currentConfig: Record<string, any> = {};
    try {
      currentConfig = typeof existingAgent.config === "string" ? JSON.parse(existingAgent.config) : (existingAgent.config || {});
    } catch {
      currentConfig = {};
    }
    let configUpdated = false;
    const newConfig = { ...currentConfig, ...extraConfig };

    if (workingHours !== undefined && workingHours !== currentConfig.workingHours) {
      newConfig.workingHours = workingHours.trim();
      auditChanges.workingHours = { from: currentConfig.workingHours, to: workingHours.trim() };
      configUpdated = true;
    }

    if (language !== undefined && language !== currentConfig.language) {
      newConfig.language = language.trim();
      auditChanges.language = { from: currentConfig.language, to: language.trim() };
      configUpdated = true;
    }

    if (
      scriptPromptVersion !== undefined &&
      scriptPromptVersion !== currentConfig.scriptPromptVersion
    ) {
      newConfig.scriptPromptVersion = scriptPromptVersion.trim();
      auditChanges.scriptPromptVersion = {
        from: currentConfig.scriptPromptVersion,
        to: scriptPromptVersion.trim(),
      };
      configUpdated = true;
    }

    if (configUpdated) {
      updates.config = JSON.stringify(newConfig);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ agent: existingAgent });
    }

    const updatedAgent = await scopedDb.agent.update({
      where: { id },
      data: updates,
    });

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: auditChanges.status ? "AGENT_STATUS_TOGGLED" : "AGENT_CONFIG_UPDATED",
        entityType: "Agent",
        entityId: id,
        changesJson: JSON.stringify(auditChanges),
      },
    });

    return NextResponse.json({ agent: updatedAgent });
  } catch (error: any) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update agent." },
      { status: 500 }
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

    const agent = await scopedDb.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found." },
        { status: 404 }
      );
    }

    await scopedDb.agent.delete({
      where: { id },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "AGENT_DELETED",
        entityType: "Agent",
        entityId: id,
        changesJson: JSON.stringify({ name: agent.name, role: agent.role, channel: agent.channel }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete agent." },
      { status: 500 }
    );
  }
}
