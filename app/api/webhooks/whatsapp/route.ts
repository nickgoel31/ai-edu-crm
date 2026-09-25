import { NextResponse } from "next/server";
import { LeadSource, IntegrationType, AgentChannel } from "@/types";
import {
  resolveTenantFromWebhook,
  ingestOrUpdateLead,
} from "@/lib/lead-ingestion";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { AIConfigError, generateChatCompletion, resolveModel } from "@/lib/ai/llm";
import { buildAgentSystemPrompt, fetchAgentKnowledgeText } from "@/lib/ai/agent-context";
import { parseAgentConfig } from "@/lib/agent-config";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send";

/**
 * WhatsApp Business API Inbound Webhook Endpoint
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken) {
    const integration = await prisma.integration.findFirst({
      where: {
        type: IntegrationType.WHATSAPP,
        OR: [
          { webhookSecret: verifyToken },
        ],
      },
    });

    if (integration || verifyToken === "whatsapp_verify_token") {
      return new Response(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ error: "WhatsApp verification failed." }, { status: 403 });
}

import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  // Rate limit: 60 requests per minute
  const rl = await checkRateLimit(req, "webhook:whatsapp", { limit: 60, windowMs: 60000 });
  if (!rl.allowed && rl.response) {
    return rl.response;
  }

  try {
    const { organizationId, integration } = await resolveTenantFromWebhook(
      IntegrationType.WHATSAPP,
      req
    );

    const body = await req.json();

    let senderName = "WhatsApp User";
    let senderPhone = "";
    let messageText = "";

    // 1. WhatsApp Cloud API Payload Format
    if (body?.entry && Array.isArray(body.entry)) {
      for (const entryItem of body.entry) {
        if (entryItem.changes && Array.isArray(entryItem.changes)) {
          for (const change of entryItem.changes) {
            const val = change.value;

            // Extract contact profile name
            if (val?.contacts && Array.isArray(val.contacts)) {
              const contact = val.contacts[0];
              if (contact?.profile?.name) {
                senderName = contact.profile.name;
              }
            }

            // Extract message details
            if (val?.messages && Array.isArray(val.messages)) {
              const msg = val.messages[0];
              senderPhone = msg.from;
              if (msg.text?.body) {
                messageText = msg.text.body;
              } else if (msg.type === "button") {
                messageText = msg.button?.text || "Button clicked";
              }
            }
          }
        }
      }
    }
    // 2. Direct simulation payload format
    else if (body.phone || body.senderPhone) {
      senderPhone = body.phone || body.senderPhone;
      senderName = body.name || body.senderName || "WhatsApp Inquirer";
      messageText = body.message || body.text || "Hello, I would like admission information.";
    }

    if (!senderPhone) {
      return NextResponse.json(
        { error: "Invalid payload: Sender phone number not found in WhatsApp webhook." },
        { status: 400 }
      );
    }

    // Ingest or deduplicate lead
    const result = await ingestOrUpdateLead({
      organizationId,
      source: LeadSource.WHATSAPP,
      name: senderName,
      phone: senderPhone,
      score: 70,
      metadata: {
        inboundChannel: "WHATSAPP",
        messageSnippet: messageText.slice(0, 200),
      },
      notes: `Inbound WhatsApp: "${messageText}"`,
    });

    // Record conversation under a LIVE WhatsApp Agent if available (most
    // recently updated one, since there may be several WhatsApp-channel
    // agents configured in the marketplace).
    const whatsappAgent = await prisma.agent.findFirst({
      where: {
        organizationId,
        channel: AgentChannel.WHATSAPP,
        status: "LIVE",
      },
      orderBy: { updatedAt: "desc" },
    });

    let aiReplySkipped = false;
    let aiReplySkippedReason: string | undefined;
    let aiReplyText: string | undefined;

    if (whatsappAgent) {
      const inboundLine = `Applicant: ${messageText}`;

      // Continue an existing recent conversation with this lead+agent
      // (last 30 minutes) instead of always creating a new single-turn one,
      // so multi-turn context is preserved.
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          agentId: whatsappAgent.id,
          leadId: result.lead.id,
          createdAt: { gte: thirtyMinutesAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      let conversation = existingConversation;
      let costInPaise = 0;

      // 1. Generate and send a real AI reply. Failures here (e.g. missing
      // ANTHROPIC_API_KEY) must never break lead capture, which already
      // succeeded above.
      try {
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });

        const agentName = whatsappAgent.name.split("-")[0].trim();
        const config = parseAgentConfig(whatsappAgent.config);
        const model = resolveModel(config.aiModel);
        const knowledgeText = await fetchAgentKnowledgeText(whatsappAgent.id);

        const system = buildAgentSystemPrompt({
          role: whatsappAgent.role as any,
          agentName,
          organizationName: organization?.name || "the institution",
          config,
          knowledgeText,
          extraContext:
            "You are replying to an INBOUND WhatsApp message from a prospective student/applicant. Keep the reply short and natural, like a real WhatsApp message.",
        });

        // Prior turns as context, parsed from the existing transcript.
        const priorMessages: { role: "user" | "assistant"; content: string }[] = [];
        if (existingConversation?.transcript) {
          for (const line of existingConversation.transcript.split("\n")) {
            if (line.startsWith("Applicant: ")) {
              priorMessages.push({ role: "user", content: line.slice("Applicant: ".length) });
            } else if (line.startsWith("Agent: ")) {
              priorMessages.push({ role: "assistant", content: line.slice("Agent: ".length) });
            }
          }
        }
        priorMessages.push({ role: "user", content: messageText });

        const completion = await generateChatCompletion({
          model,
          system,
          messages: priorMessages,
        });

        aiReplyText = completion.text;
        costInPaise = completion.costInPaise;

        // 2. Actually send the reply back to WhatsApp.
        const sendResult = await sendWhatsAppMessage({
          organizationId,
          agentConfig: config,
          to: senderPhone,
          message: aiReplyText,
        });

        if (!sendResult.success) {
          console.warn(
            `WhatsApp reply generated but not delivered (provider: ${sendResult.provider}): ${sendResult.error}`
          );
        }

        const newTranscriptTurn = `${inboundLine}\nAgent: ${aiReplyText}`;

        if (conversation) {
          const updatedTranscript = `${conversation.transcript}\n${newTranscriptTurn}`;
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              transcript: updatedTranscript,
              costInPaise: (conversation.costInPaise || 0) + costInPaise,
            },
          });
        } else {
          conversation = await prisma.conversation.create({
            data: {
              agentId: whatsappAgent.id,
              leadId: result.lead.id,
              channel: "WHATSAPP",
              transcript: newTranscriptTurn,
              costInPaise,
            },
          });
        }
      } catch (aiError: any) {
        aiReplySkipped = true;
        aiReplySkippedReason =
          aiError instanceof AIConfigError
            ? aiError.message
            : aiError?.message || "Failed to generate AI reply.";
        console.warn("WhatsApp AI reply skipped:", aiReplySkippedReason);

        // Still record the inbound turn even if the AI reply failed.
        if (conversation) {
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: { transcript: `${conversation.transcript}\n${inboundLine}` },
          });
        } else {
          conversation = await prisma.conversation.create({
            data: {
              agentId: whatsappAgent.id,
              leadId: result.lead.id,
              channel: "WHATSAPP",
              transcript: inboundLine,
              costInPaise: 0,
            },
          });
        }
      }

      await logActivity({
        organizationId,
        entityType: "LEAD",
        entityId: result.lead.id,
        type: "AGENT_CONVERSATION",
        content: (aiReplyText ? `${inboundLine}\nAgent: ${aiReplyText}` : inboundLine).slice(0, 500),
        metadata: {
          conversationId: conversation.id,
          agentName: whatsappAgent.name,
          channel: "WHATSAPP",
          aiReplySkipped,
        },
      });
    }

    return NextResponse.json({
      status: "success",
      result: result.message,
      isNew: result.isNew,
      leadId: result.lead.id,
      inboundMessage: messageText,
      ...(aiReplyText ? { aiReply: aiReplyText } : {}),
      ...(aiReplySkipped ? { aiReplySkipped: true, reason: aiReplySkippedReason } : {}),
    });
  } catch (error: any) {
    console.error("WhatsApp Webhook Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process WhatsApp webhook." },
      { status: error?.message?.includes("token") ? 401 : 500 }
    );
  }
}
