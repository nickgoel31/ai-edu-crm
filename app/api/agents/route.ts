import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { AgentChannel, AgentRole, AgentStatus, AGENT_ROLE_META, ConversationOutcome } from "@/types";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const organizationId = session.user.organizationId;

    // Time boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch agents with conversations
    const agents = await scopedDb.agent.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        conversations: {
          select: {
            id: true,
            outcome: true,
            costInPaise: true,
            createdAt: true,
            claimedByUserId: true,
          },
        },
      },
    });

    let globalConversationsToday = 0;
    let globalConversationsThisWeek = 0;
    let globalTotalConversations = 0;
    let globalConvertedConversations = 0;
    let globalCostThisMonthPaise = 0;
    let globalUnclaimedEscalations = 0;

    const enrichedAgents = agents.map((agent) => {
      const convs = agent.conversations || [];
      const totalConversations = convs.length;

      let convsToday = 0;
      let convsThisWeek = 0;
      let convertedCount = 0;
      let costThisMonthPaise = 0;

      convs.forEach((c) => {
        const cDate = new Date(c.createdAt);
        if (cDate >= startOfToday) {
          convsToday++;
        }
        if (cDate >= startOfWeek) {
          convsThisWeek++;
        }
        if (c.outcome === ConversationOutcome.CONVERTED) {
          convertedCount++;
        }
        if (cDate >= startOfMonth && c.costInPaise) {
          costThisMonthPaise += c.costInPaise;
        }
        if (c.outcome === ConversationOutcome.ESCALATED && !c.claimedByUserId) {
          globalUnclaimedEscalations++;
        }
      });

      const conversionRate =
        totalConversations > 0
          ? Math.round((convertedCount / totalConversations) * 100)
          : 0;

      globalConversationsToday += convsToday;
      globalConversationsThisWeek += convsThisWeek;
      globalTotalConversations += totalConversations;
      globalConvertedConversations += convertedCount;
      globalCostThisMonthPaise += costThisMonthPaise;

      // Extract config safely
      let config: Record<string, any> = {};
      try {
        config = typeof agent.config === "string" ? JSON.parse(agent.config) : (agent.config || {});
      } catch (e) {
        config = {};
      }

      return {
        id: agent.id,
        name: agent.name,
        channel: agent.channel,
        role: agent.role,
        category: agent.category,
        status: agent.status,
        config: {
          workingHours: config.workingHours || "09:00 - 20:00 IST",
          language: config.language || "en-IN",
          scriptPromptVersion: config.scriptPromptVersion || config.systemPromptVersion || "v1.0",
          ...config,
        },
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        metrics: {
          conversationsToday: convsToday,
          conversationsThisWeek: convsThisWeek,
          totalConversations,
          convertedCount,
          conversionRate,
          costThisMonthPaise,
          costThisMonthRupees: (costThisMonthPaise / 100).toFixed(2),
        },
      };
    });

    const overallConversionRate =
      globalTotalConversations > 0
        ? Math.round((globalConvertedConversations / globalTotalConversations) * 100)
        : 0;

    return NextResponse.json({
      agents: enrichedAgents,
      stats: {
        activeAgentsCount: enrichedAgents.filter((a) => a.status === AgentStatus.LIVE).length,
        totalAgentsCount: enrichedAgents.length,
        totalConversationsToday: globalConversationsToday,
        totalConversationsThisWeek: globalConversationsThisWeek,
        totalConversationsAllTime: globalTotalConversations,
        overallConversionRate,
        totalCostThisMonthPaise: globalCostThisMonthPaise,
        totalCostThisMonthRupees: (globalCostThisMonthPaise / 100).toFixed(2),
        unclaimedEscalationsCount: globalUnclaimedEscalations,
      },
    });
  } catch (error: any) {
    console.error("Error fetching agents dashboard:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch agents." },
      { status: 500 }
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
    assertCanMutate(session);
    const body = await req.json();
    const {
      name,
      role,
      channel,
      status,
      workingHours,
      language,
      scriptPromptVersion,
      outboundWebhookUrl,
      extraConfig,
    } = body;

    if (!name?.trim() || !role || !Object.values(AgentRole).includes(role)) {
      return NextResponse.json(
        { error: "Valid agent name and role are required." },
        { status: 400 }
      );
    }

    const roleMeta = AGENT_ROLE_META[role as AgentRole];
    const resolvedChannel =
      channel && Object.values(AgentChannel).includes(channel) ? channel : roleMeta.channel;

    const scopedDb = getScopedPrismaClient(session);

    const agent = await scopedDb.agent.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        channel: resolvedChannel,
        role,
        category: roleMeta.category,
        status: status === AgentStatus.PAUSED ? AgentStatus.PAUSED : AgentStatus.LIVE,
        outboundWebhookUrl: outboundWebhookUrl?.trim() || null,
        config: JSON.stringify({
          workingHours: workingHours || "09:00 - 20:00 IST",
          language: language || "en-IN",
          scriptPromptVersion: scriptPromptVersion || "v1.0",
          ...(extraConfig && typeof extraConfig === "object" ? extraConfig : {}),
        }),
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "AGENT_CREATED",
        entityType: "Agent",
        entityId: agent.id,
        changesJson: JSON.stringify({
          name: agent.name,
          role: agent.role,
          channel: agent.channel,
          status: agent.status,
        }),
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create agent." },
      { status: 500 }
    );
  }
}
