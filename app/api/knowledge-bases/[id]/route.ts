import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const knowledgeBase = await scopedDb.knowledgeBase.findUnique({
      where: { id: params.id },
      include: {
        documents: { orderBy: { createdAt: "desc" } },
        agents: { include: { agent: { select: { id: true, name: true, role: true, channel: true } } } },
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    }

    return NextResponse.json({
      knowledgeBase: {
        ...knowledgeBase,
        agents: knowledgeBase.agents.map((a) => a.agent),
      },
    });
  } catch (error: any) {
    console.error("Error fetching knowledge base:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch knowledge base." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    const body = await req.json();
    const { name, description } = body;

    const scopedDb = getScopedPrismaClient(session);
    const existing = await scopedDb.knowledgeBase.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    }

    const knowledgeBase = await scopedDb.knowledgeBase.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? description?.trim() || null : existing.description,
      },
    });

    return NextResponse.json({ knowledgeBase });
  } catch (error: any) {
    console.error("Error updating knowledge base:", error);
    return NextResponse.json({ error: error?.message || "Failed to update knowledge base." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
    const scopedDb = getScopedPrismaClient(session);
    const existing = await scopedDb.knowledgeBase.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    }

    await scopedDb.knowledgeBase.delete({ where: { id: params.id } });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "KNOWLEDGE_BASE_DELETED",
        entityType: "KnowledgeBase",
        entityId: params.id,
        changesJson: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting knowledge base:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete knowledge base." }, { status: 500 });
  }
}
