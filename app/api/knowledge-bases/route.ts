import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const knowledgeBases = await scopedDb.knowledgeBase.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        documents: { select: { id: true, title: true, sourceType: true, createdAt: true } },
        agents: { select: { agentId: true, agent: { select: { id: true, name: true, role: true } } } },
      },
    });

    return NextResponse.json({
      knowledgeBases: knowledgeBases.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
        documentCount: kb.documents.length,
        documents: kb.documents,
        agents: kb.agents.map((a) => a.agent),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching knowledge bases:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch knowledge bases." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    const body = await req.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Knowledge base name is required." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);
    const knowledgeBase = await scopedDb.knowledgeBase.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "KNOWLEDGE_BASE_CREATED",
        entityType: "KnowledgeBase",
        entityId: knowledgeBase.id,
        changesJson: JSON.stringify({ name: knowledgeBase.name }),
      },
    });

    return NextResponse.json({ knowledgeBase }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating knowledge base:", error);
    return NextResponse.json({ error: error?.message || "Failed to create knowledge base." }, { status: 500 });
  }
}
