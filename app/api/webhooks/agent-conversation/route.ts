import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizePhoneNumber,
  getPhoneSearchVariations,
} from "@/lib/lead-ingestion";
import { ConversationOutcome, LeadSource, LeadStage } from "@/types";

import { checkRateLimit } from "@/lib/rate-limiter";
import { logActivity } from "@/lib/activity";
import { notifyEscalation } from "@/lib/notifications";

export async function POST(req: Request) {
  // Rate limit: 120 requests per minute for agent webhooks
  const rl = await checkRateLimit(req, "webhook:agent-conversation", { limit: 120, windowMs: 60000 });
  if (!rl.allowed && rl.response) {
    return rl.response;
  }

  try {
    const body = await req.json();
    const {
      agentId,
      agentType,
      phone,
      callerPhone,
      customerNumber,
      callerName,
      name,
      transcript,
      outcome,
      costInPaise,
      cost,
      channel,
      durationSeconds,
    } = body;

    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get("token") || url.searchParams.get("secret");
    const tokenFromHeader =
      req.headers.get("x-webhook-token") ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const token = tokenFromQuery || tokenFromHeader;

    let organizationId: string | null = null;
    let agent = null;

    if (token) {
      const integration = await prisma.integration.findFirst({
        where: { webhookSecret: token, isEnabled: true },
      });
      if (integration) {
        organizationId = integration.organizationId;
      }
    }

    if (agentId) {
      agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });
      if (agent) {
        organizationId = agent.organizationId;
      }
    }

    if (!organizationId && !agent) {
      return NextResponse.json(
        { error: "Unauthorized: Valid webhook token or registered agentId required." },
        { status: 401 }
      );
    }

    if (!agent && organizationId) {
      // If agentId was not passed or not found, match by channel or take first agent of this org
      const channelFilter = agentType ? agentType.toUpperCase() : "VOICE";
      agent = await prisma.agent.findFirst({
        where: {
          organizationId,
          channel: channelFilter,
        },
      });

      if (!agent) {
        agent = await prisma.agent.findFirst({
          where: { organizationId },
        });
      }
    }

    if (!agent) {
      return NextResponse.json(
        { error: "No matching AI Agent found in this organization." },
        { status: 404 }
      );
    }

    const orgId = agent.organizationId;

    // Format transcript
    let formattedTranscript = "";
    if (typeof transcript === "string") {
      formattedTranscript = transcript;
    } else if (Array.isArray(transcript)) {
      formattedTranscript = transcript
        .map((item: any) => {
          const role = item.role || item.speaker || "Speaker";
          const text = item.message || item.text || item.content || "";
          return `${role}: ${text}`;
        })
        .join("\n");
    } else if (transcript && typeof transcript === "object") {
      formattedTranscript = JSON.stringify(transcript, null, 2);
    } else {
      formattedTranscript = "Call completed with agent " + agent.name;
    }

    // Validate and format outcome
    let resolvedOutcome: ConversationOutcome = ConversationOutcome.CONTINUED;
    const normalizedOutcome = outcome?.toString().toUpperCase();
    if (normalizedOutcome && Object.values(ConversationOutcome).includes(normalizedOutcome as ConversationOutcome)) {
      resolvedOutcome = normalizedOutcome as ConversationOutcome;
    }

    // Calculate cost in paise
    let resolvedCostInPaise: number | null = null;
    if (typeof costInPaise === "number") {
      resolvedCostInPaise = Math.round(costInPaise);
    } else if (typeof cost === "number") {
      // Assume cost in rupees (or dollars/cents, e.g. 3.50 -> 350 paise)
      resolvedCostInPaise = Math.round(cost * 100);
    }

    // Resolve channel
    const resolvedChannel =
      channel || (agent.channel === "VOICE" ? "VOICE_CALL" : agent.channel === "WHATSAPP" ? "WHATSAPP" : agent.channel === "EMAIL" ? "EMAIL" : "WEBSITE_CHAT");

    // Match phone number to Student or Lead
    const rawPhone = callerPhone || phone || customerNumber || "";
    let matchedStudentId: string | null = null;
    let matchedLeadId: string | null = null;

    if (rawPhone.trim()) {
      const phoneVariations = getPhoneSearchVariations(rawPhone);

      // 1. Search for matching Student in organization
      const matchedStudent = await prisma.student.findFirst({
        where: {
          organizationId: orgId,
          OR: phoneVariations.map((v) => ({ phone: { contains: v } })),
        },
      });

      if (matchedStudent) {
        matchedStudentId = matchedStudent.id;
        matchedLeadId = matchedStudent.leadId;
      } else {
        // 2. Search for matching Lead in organization
        const matchedLead = await prisma.lead.findFirst({
          where: {
            organizationId: orgId,
            OR: phoneVariations.map((v) => ({ phone: { contains: v } })),
          },
        });

        if (matchedLead) {
          matchedLeadId = matchedLead.id;
          // If lead was lost, reactivate if customer is talking again
          if (matchedLead.stage === LeadStage.LOST && resolvedOutcome !== ConversationOutcome.NO_RESPONSE) {
            const reactivatedStage =
              resolvedOutcome === ConversationOutcome.CONVERTED ? LeadStage.CONVERTING : LeadStage.WARM;
            await prisma.lead.update({
              where: { id: matchedLead.id },
              data: { stage: reactivatedStage },
            });
            await logActivity({
              organizationId: orgId,
              entityType: "LEAD",
              entityId: matchedLead.id,
              type: "STAGE_CHANGE",
              metadata: { oldStage: matchedLead.stage, newStage: reactivatedStage },
            });
          }
        } else {
          // 3. Auto-provision a new Lead for unknown inbound caller
          const cleanPhone = normalizePhoneNumber(rawPhone);
          const contactName =
            callerName || name || `Caller (${cleanPhone.slice(-4) || "Direct"})`;

          const createdLead = await prisma.lead.create({
            data: {
              organizationId: orgId,
              name: contactName.trim(),
              phone: cleanPhone || rawPhone,
              email: `caller_${Date.now()}@inbound.edu`,
              source:
                agent.channel === "VOICE"
                  ? LeadSource.CALL_TRACKING
                  : agent.channel === "WHATSAPP"
                  ? LeadSource.WHATSAPP
                  : LeadSource.WEBSITE_FORM,
              stage:
                resolvedOutcome === ConversationOutcome.CONVERTED
                  ? LeadStage.CONVERTING
                  : resolvedOutcome === ConversationOutcome.ESCALATED
                  ? LeadStage.HOT
                  : LeadStage.WARM,
              score: resolvedOutcome === ConversationOutcome.CONVERTED ? 85 : 60,
            },
          });

          matchedLeadId = createdLead.id;
        }
      }
    }

    // Create Conversation record
    const conversation = await prisma.conversation.create({
      data: {
        agentId: agent.id,
        leadId: matchedLeadId,
        studentId: matchedStudentId,
        channel: resolvedChannel,
        transcript: formattedTranscript,
        outcome: resolvedOutcome,
        costInPaise: resolvedCostInPaise,
        claimedByUserId: null, // Escalation queue is unclaimed by default
      },
      include: {
        agent: {
          select: { id: true, name: true, channel: true, role: true },
        },
        lead: {
          select: { id: true, name: true, phone: true },
        },
        student: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (matchedStudentId || matchedLeadId) {
      await logActivity({
        organizationId: orgId,
        entityType: matchedStudentId ? "STUDENT" : "LEAD",
        entityId: matchedStudentId || matchedLeadId!,
        type: "AGENT_CONVERSATION",
        content: formattedTranscript.slice(0, 500),
        metadata: {
          conversationId: conversation.id,
          agentName: agent.name,
          channel: resolvedChannel,
          outcome: resolvedOutcome,
        },
      });
    }

    // If escalated, log audit event and alert staff immediately (not just
    // via tomorrow's daily digest — a lead asking for a human is urgent).
    if (resolvedOutcome === ConversationOutcome.ESCALATED) {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          action: "AGENT_CONVERSATION_ESCALATED",
          entityType: "Conversation",
          entityId: conversation.id,
          changesJson: JSON.stringify({
            agentName: agent.name,
            channel: resolvedChannel,
            callerPhone: rawPhone,
            matchedStudentId,
            matchedLeadId,
          }),
        },
      });

      // Awaited (not fire-and-forget): on serverless, a promise left
      // running after the response is sent can be killed before it
      // completes, silently dropping the alert.
      try {
        await notifyEscalation({
          organizationId: orgId,
          conversationId: conversation.id,
          agentName: agent.name,
          channel: resolvedChannel,
          contactName: callerName || name,
          contactPhone: rawPhone,
        });
      } catch (err) {
        console.error("Failed to send escalation notification:", err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        conversationId: conversation.id,
        outcome: resolvedOutcome,
        matched: {
          studentId: matchedStudentId,
          leadId: matchedLeadId,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error ingesting agent conversation webhook:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
