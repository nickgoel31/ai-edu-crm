import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { logActivity } from "@/lib/activity";
import { normalizePhoneNumber, getPhoneSearchVariations } from "@/lib/lead-ingestion";
import { AgentChannel, AgentRole, AgentStatus, ConversationOutcome, LeadSource, LeadStage } from "@/types";
import { AIConfigError, generateChatCompletion, resolveModel, type ChatMessage } from "@/lib/ai/llm";
import { buildAgentSystemPrompt, fetchAgentKnowledgeText, parseAgentConfigSafe } from "@/lib/ai/agent-context";
import { getBillingGate } from "@/lib/billing/access";
import { notifyEscalation } from "@/lib/notifications";

// Transcript lines are prefixed so a follow-up turn can reconstruct message
// history from the stored Conversation row without any extra schema.
const VISITOR_PREFIX = "Visitor: ";
const AGENT_PREFIX = "Agent: ";

function transcriptToMessages(transcript: string): ChatMessage[] {
  if (!transcript) return [];
  return transcript
    .split("\n")
    .filter((line) => line.startsWith(VISITOR_PREFIX) || line.startsWith(AGENT_PREFIX))
    .map((line) =>
      line.startsWith(VISITOR_PREFIX)
        ? { role: "user" as const, content: line.slice(VISITOR_PREFIX.length) }
        : { role: "assistant" as const, content: line.slice(AGENT_PREFIX.length) }
    );
}

function originAllowed(req: Request, allowedDomains: string | undefined): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin/non-browser requests send no Origin header
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }

  const appHost = new URL(req.url).host;
  if (host === appHost) return true; // the in-app widget test page

  const domains = (allowedDomains || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true; // no restriction configured yet

  return domains.some((d) => host.toLowerCase() === d || host.toLowerCase().endsWith(`.${d}`));
}

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const rl = await checkRateLimit(req, "widget:chat", { limit: 30, windowMs: 60000, identifier: params.agentId });
  if (!rl.allowed && rl.response) {
    return rl.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { message, conversationId, visitor } = body as {
      message?: string;
      conversationId?: string;
      visitor?: { name?: string; email?: string; phone?: string };
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "message is too long." }, { status: 400 });
    }

    const agent = await prisma.agent.findUnique({ where: { id: params.agentId } });
    if (
      !agent ||
      agent.status !== AgentStatus.LIVE ||
      agent.channel !== AgentChannel.WEBSITE_CHAT
    ) {
      return NextResponse.json({ error: "This chat agent is not available." }, { status: 404 });
    }

    const config = parseAgentConfigSafe(agent.config);

    if (!originAllowed(req, config.allowedDomains)) {
      return NextResponse.json({ error: "This domain is not authorized to embed this agent." }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: agent.organizationId },
      select: { name: true, subscriptionStatus: true, trialEndsAt: true },
    });
    if (org && getBillingGate(org).isBlocked) {
      return NextResponse.json(
        { error: "This chat agent is temporarily unavailable." },
        { status: 503 }
      );
    }

    let conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;
    if (conversation && conversation.agentId !== agent.id) {
      conversation = null; // don't let a client splice into another agent's conversation
    }

    const history = transcriptToMessages(conversation?.transcript || "");

    const knowledgeText = await fetchAgentKnowledgeText(agent.id);
    const system = buildAgentSystemPrompt({
      role: agent.role as AgentRole,
      agentName: agent.name,
      organizationName: org?.name || "the institution",
      config,
      knowledgeText,
      extraContext: [
        config.welcomeMessage ? `Your welcome message was: "${config.welcomeMessage}"` : "",
        "You are chatting live with a website visitor. Be warm and helpful.",
        "If the visitor asks to speak to a human, or you cannot help them, say you're connecting them",
        "with the team and end your reply with exactly one final line (no extra text after it):",
        "OUTCOME: ESCALATED",
        "Otherwise, if the conversation is clearly done (visitor said thanks/bye or is satisfied), end with:",
        "OUTCOME: CONTINUED",
        "Do not print the OUTCOME line anywhere except as the final line.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const model = resolveModel(config.aiModel);

    let completion;
    try {
      completion = await generateChatCompletion({
        model,
        system,
        messages: [...history, { role: "user", content: message.trim() }],
        maxTokens: 600,
      });
    } catch (aiError: any) {
      if (aiError instanceof AIConfigError) {
        return NextResponse.json(
          {
            error:
              "This chat agent is not configured yet. Set ANTHROPIC_API_KEY in the environment to enable it.",
          },
          { status: 503 }
        );
      }
      throw aiError;
    }

    const outcomeMatch = completion.text.match(/OUTCOME:\s*(ESCALATED|CONTINUED)/i);
    const reply = outcomeMatch ? completion.text.slice(0, outcomeMatch.index).trim() : completion.text;
    const outcome: ConversationOutcome = outcomeMatch
      ? (outcomeMatch[1].toUpperCase() as ConversationOutcome)
      : ConversationOutcome.CONTINUED;

    const newTranscriptLines = `${VISITOR_PREFIX}${message.trim()}\n${AGENT_PREFIX}${reply}`;
    const transcript = conversation?.transcript
      ? `${conversation.transcript}\n${newTranscriptLines}`
      : newTranscriptLines;

    // Match/create a Lead once the visitor has shared contact info.
    let leadId = conversation?.leadId || null;
    if (!leadId && visitor && (visitor.email?.trim() || visitor.phone?.trim())) {
      const rawPhone = visitor.phone?.trim() || "";
      if (rawPhone) {
        const phoneVariations = getPhoneSearchVariations(rawPhone);
        const matchedLead = await prisma.lead.findFirst({
          where: { organizationId: agent.organizationId, OR: phoneVariations.map((v) => ({ phone: { contains: v } })) },
        });
        leadId = matchedLead?.id || null;
      }
      if (!leadId) {
        const cleanPhone = rawPhone ? normalizePhoneNumber(rawPhone) : "";
        const createdLead = await prisma.lead.create({
          data: {
            organizationId: agent.organizationId,
            name: visitor.name?.trim() || "Website Visitor",
            phone: cleanPhone || `web_${Date.now()}`,
            email: visitor.email?.trim() || `visitor_${Date.now()}@inbound.edu`,
            source: LeadSource.WEBSITE_FORM,
            stage: outcome === ConversationOutcome.ESCALATED ? LeadStage.HOT : LeadStage.WARM,
            score: 55,
          },
        });
        leadId = createdLead.id;
      }
    }

    const savedConversation = conversation
      ? await prisma.conversation.update({
          where: { id: conversation.id },
          data: { transcript, outcome, costInPaise: (conversation.costInPaise || 0) + completion.costInPaise, leadId },
        })
      : await prisma.conversation.create({
          data: {
            agentId: agent.id,
            leadId,
            channel: "WEBSITE_CHAT",
            transcript,
            outcome,
            costInPaise: completion.costInPaise,
          },
        });

    if (leadId) {
      await logActivity({
        organizationId: agent.organizationId,
        entityType: "LEAD",
        entityId: leadId,
        type: "AGENT_CONVERSATION",
        content: transcript.slice(-500),
        metadata: { conversationId: savedConversation.id, agentName: agent.name, channel: "WEBSITE_CHAT", outcome },
      });
    }

    // Only alert on the transition into ESCALATED, not on every subsequent
    // turn of an already-escalated conversation.
    const wasAlreadyEscalated = conversation?.outcome === ConversationOutcome.ESCALATED;
    if (outcome === ConversationOutcome.ESCALATED && !wasAlreadyEscalated) {
      await prisma.auditLog.create({
        data: {
          organizationId: agent.organizationId,
          action: "AGENT_CONVERSATION_ESCALATED",
          entityType: "Conversation",
          entityId: savedConversation.id,
          changesJson: JSON.stringify({ agentName: agent.name, channel: "WEBSITE_CHAT", leadId }),
        },
      });

      try {
        await notifyEscalation({
          organizationId: agent.organizationId,
          conversationId: savedConversation.id,
          agentName: agent.name,
          channel: "WEBSITE_CHAT",
          contactName: visitor?.name,
          contactPhone: visitor?.phone,
        });
      } catch (err) {
        console.error("Failed to send escalation notification:", err);
      }
    }

    return NextResponse.json({
      conversationId: savedConversation.id,
      reply,
      outcome,
    });
  } catch (error: any) {
    console.error("Error handling widget chat message:", error);
    return NextResponse.json({ error: error?.message || "Internal server error." }, { status: 500 });
  }
}
