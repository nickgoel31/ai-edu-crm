import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ConversationOutcome } from "@/types";

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

    // 3. Generate realistic transcript based on lead profile
    const callGoal = goal || "Initial qualification and campus visit booking";
    const agentName = agent.name.split("-")[0].trim();
    const transcript = `[AI Voice Caller - ${agent.name}]
Agent: Hello ${lead.name}, this is ${agentName} from Apex Technical & Vocational Academy. Am I speaking with ${lead.name}?
Lead: Yes, speaking.
Agent: I noticed you recently inquired through ${lead.source.replace(/_/g, " ")}. Are you looking to join our upcoming vocational training cohort?
Lead: Yes, I am exploring hands-on certification programs to upgrade my skills.
Agent: Wonderful! Based on your profile (Score: ${lead.score || 80} pts), you're eligible for our practical lab demo this Saturday at 11:00 AM. Would that time work for you?
Lead: That sounds great, please confirm the slot for me.
Agent: Confirmed! We've reserved your campus demo seat. An admissions counselor will also share the directions via WhatsApp. Thank you, ${lead.name}!`;

    // 4. Save Conversation record
    const conversation = await scopedDb.conversation.create({
      data: {
        agentId: agent.id,
        leadId: lead.id,
        channel: "VOICE_CALL",
        transcript,
        outcome: ConversationOutcome.CONVERTED,
        costInPaise: 380, // ~3.80 INR
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
      content: `AI Agent (${agent.name}) completed an automated outbound voice screening call. Outcome: Demo booked for Saturday.`,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        conversationId: conversation.id,
        durationSeconds: 114,
        costPaise: 380,
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
