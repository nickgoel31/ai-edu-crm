import { NextResponse } from "next/server";
import { LeadSource, IntegrationType, AgentChannel } from "@/types";
import {
  resolveTenantFromWebhook,
  ingestOrUpdateLead,
} from "@/lib/lead-ingestion";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

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

    // Record conversation under WhatsApp Agent if available
    const whatsappAgent = await prisma.agent.findFirst({
      where: {
        organizationId,
        channel: AgentChannel.WHATSAPP,
      },
    });

    if (whatsappAgent) {
      const conversation = await prisma.conversation.create({
        data: {
          agentId: whatsappAgent.id,
          leadId: result.lead.id,
          channel: "WHATSAPP",
          transcript: `Applicant: ${messageText}`,
          costInPaise: 15,
        },
      });

      await logActivity({
        organizationId,
        entityType: "LEAD",
        entityId: result.lead.id,
        type: "AGENT_CONVERSATION",
        content: `Applicant: ${messageText}`.slice(0, 500),
        metadata: {
          conversationId: conversation.id,
          agentName: whatsappAgent.name,
          channel: "WHATSAPP",
        },
      });
    }

    return NextResponse.json({
      status: "success",
      result: result.message,
      isNew: result.isNew,
      leadId: result.lead.id,
      inboundMessage: messageText,
    });
  } catch (error: any) {
    console.error("WhatsApp Webhook Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process WhatsApp webhook." },
      { status: error?.message?.includes("token") ? 401 : 500 }
    );
  }
}
