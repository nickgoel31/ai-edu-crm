import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { ConversationOutcome } from "@/types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // 'unclaimed' | 'claimed' | 'all'

    const where: any = {
      outcome: ConversationOutcome.ESCALATED,
      agent: {
        organizationId,
      },
    };

    if (filter === "unclaimed") {
      where.claimedByUserId = null;
    } else if (filter === "claimed") {
      where.claimedByUserId = { not: null };
    }

    const escalations = await prisma.conversation.findMany({
      where,
      orderBy: [
        { claimedByUserId: "asc" }, // Unclaimed nulls first in Postgres
        { createdAt: "desc" },
      ],
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            channel: true,
            role: true,
            status: true,
          },
        },
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
    });

    const totalUnclaimed = escalations.filter((e) => !e.claimedByUserId).length;
    const totalClaimed = escalations.filter((e) => !!e.claimedByUserId).length;

    return NextResponse.json({
      escalations,
      stats: {
        total: escalations.length,
        unclaimed: totalUnclaimed,
        claimed: totalClaimed,
      },
    });
  } catch (error: any) {
    console.error("Error fetching escalation queue:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch escalation queue." },
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
    const { conversationId, action } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify conversation belongs to this tenant's agent
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        agent: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        agent: true,
        claimedBy: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found in your organization." },
        { status: 404 }
      );
    }

    const isRelease = action === "RELEASE";

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        claimedByUserId: isRelease ? null : session.user.id,
        claimedAt: isRelease ? null : new Date(),
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
        claimedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: isRelease ? "AGENT_ESCALATION_RELEASED" : "AGENT_ESCALATION_CLAIMED",
        entityType: "Conversation",
        entityId: conversationId,
        changesJson: JSON.stringify({
          agentName: conversation.agent.name,
          previousClaimedBy: conversation.claimedBy?.name || "Unclaimed",
          newClaimedBy: isRelease ? "Unclaimed" : session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      conversation: updated,
      message: isRelease ? "Escalation released back to queue." : "Escalation claimed successfully.",
    });
  } catch (error: any) {
    console.error("Error claiming escalation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update escalation claim." },
      { status: 500 }
    );
  }
}
