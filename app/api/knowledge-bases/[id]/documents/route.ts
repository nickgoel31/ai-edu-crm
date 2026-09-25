import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    const body = await req.json();
    const { title, content, sourceType } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Document title and content are required." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);
    const knowledgeBase = await scopedDb.knowledgeBase.findUnique({ where: { id: params.id } });
    if (!knowledgeBase) {
      return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    }

    const document = await scopedDb.knowledgeBaseDocument.create({
      data: {
        knowledgeBaseId: params.id,
        title: title.trim(),
        content: content.trim(),
        sourceType: sourceType === "URL" ? "URL" : "TEXT",
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding knowledge base document:", error);
    return NextResponse.json({ error: error?.message || "Failed to add document." }, { status: 500 });
  }
}
