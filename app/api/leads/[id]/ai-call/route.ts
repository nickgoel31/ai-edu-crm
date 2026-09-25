import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ConversationOutcome } from "@/types";
import { AIConfigError, generateChatCompletion, resolveModel } from "@/lib/ai/llm";
import { buildAgentSystemPrompt, fetchAgentKnowledgeText, parseAgentConfigSafe } from "@/lib/ai/agent-context";
import { getBillingGate } from "@/lib/billing/access";

export async function POST(
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

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    });
    const gate = getBillingGate(org!);
    if (gate.isBlocked) {
      return NextResponse.json(
        {
          error:
            gate.status === "trial_expired"
              ? "Your 14-day trial has ended. Add a payment method in Settings → Billing to keep using AI agents."
              : "Your subscription is inactive. Update billing in Settings → Billing to keep using AI agents.",
        },
        { status: 402 }
      );
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { agentId, goal } = body;

    const scopedDb = getScopedPrismaClient(session);

    // 1. Fetch Lead
    const lead = await scopedDb.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found in this organization." },
        { status: 404 }
      );
    }

    // 2. Resolve AI Agent
    let agent = null;
    if (agentId) {
      agent = await scopedDb.agent.findUnique({
        where: { id: agentId },
      });
    }

    if (!agent) {
      agent = await scopedDb.agent.findFirst({
        where: {
          channel: "VOICE_CALL",
          status: "LIVE",
        },
      });
    }

    if (!agent) {
      agent = await scopedDb.agent.findFirst({
        where: { status: "LIVE" },
      });
    }

    if (!agent) {
      return NextResponse.json(
        { error: "No active AI Voice Agents configured in this workspace." },
        { status: 400 }
      );
    }

    // 3. Generate a real call transcript with the LLM, driven by the
    // agent's configured system prompt, its knowledge base, and the lead's
    // actual CRM profile.
    const callGoal = goal || "Initial qualification and campus visit booking";
    const agentName = agent.name.split("-")[0].trim();
    const config = parseAgentConfigSafe(agent.config);
    const model = resolveModel(config.aiModel);

    const organization = await scopedDb.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    });

    const knowledgeText = await fetchAgentKnowledgeText(agent.id);
    const system = buildAgentSystemPrompt({
      role: agent.role as any,
      agentName,
      organizationName: organization?.name || "the institution",
      config,
      knowledgeText,
      extraContext: [
        "You are placing an OUTBOUND phone call to a lead. Write the FULL call transcript",
        "from greeting to close, alternating between 'Agent:' and 'Lead:' lines, roleplaying",
        "a realistic, cooperative-but-plausible prospective student based on their profile below.",
        "Keep it to 6-12 exchanges.",
        "",
        `Call goal: ${callGoal}`,
        `Lead name: ${lead.name}`,
        `Lead source: ${lead.source}`,
        `Lead score: ${lead.score ?? "unknown"}`,
        `Lead stage: ${lead.stage}`,
        "",
        "End your response with exactly one final line in this format (no extra text after it):",
        "OUTCOME: CONVERTED | ESCALATED | CONTINUED | NO_RESPONSE",
      ].join("\n"),
    });

    let transcript: string;
    let resolvedOutcome: ConversationOutcome = ConversationOutcome.CONTINUED;
    let costInPaise = 0;

    try {
      const completion = await generateChatCompletion({
        model,
        system,
        messages: [
          {
            role: "user",
            content: "Generate the call transcript now.",
          },
        ],
        maxTokens: 1200,
      });

      const outcomeMatch = completion.text.match(/OUTCOME:\s*(CONVERTED|ESCALATED|CONTINUED|NO_RESPONSE)/i);
      if (outcomeMatch && Object.values(ConversationOutcome).includes(outcomeMatch[1].toUpperCase() as ConversationOutcome)) {
        resolvedOutcome = outcomeMatch[1].toUpperCase() as ConversationOutcome;
      }
      transcript = outcomeMatch
        ? completion.text.slice(0, outcomeMatch.index).trim()
        : completion.text;
      costInPaise = completion.costInPaise;
    } catch (aiError: any) {
      if (aiError instanceof AIConfigError) {
        return NextResponse.json(
          {
            error:
              "AI calling is not configured yet. Set ANTHROPIC_API_KEY in the environment to enable real AI voice agents.",
          },
          { status: 503 }
        );
      }
      throw aiError;
    }

    // 4. Save Conversation record
    const conversation = await scopedDb.conversation.create({
      data: {
        agentId: agent.id,
        leadId: lead.id,
        channel: "VOICE_CALL",
        transcript,
        outcome: resolvedOutcome,
        costInPaise,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            channel: true,
            role: true,
          },
        },
      },
    });

    // 5. Log Activity
    await logActivity({
      organizationId: session.user.organizationId,
      entityType: "LEAD",
      entityId: lead.id,
      type: "CALL",
      content: `AI Agent (${agent.name}) completed an automated outbound voice screening call. Outcome: ${resolvedOutcome}.`,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        conversationId: conversation.id,
        costPaise: costInPaise,
        model,
      },
    });

    // 6. Write AuditLog
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "AI_AGENT_CALL_DISPATCHED",
        entityType: "Lead",
        entityId: lead.id,
        changesJson: JSON.stringify({
          agentName: agent.name,
          phone: lead.phone,
          goal: callGoal,
          conversationId: conversation.id,
          performedBy: session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `AI Voice Call completed successfully by ${agent.name}`,
      conversation,
    });
  } catch (error: any) {
    console.error("Error triggering AI call:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger AI call." },
      { status: 500 }
    );
  }
}
