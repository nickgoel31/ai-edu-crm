import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    const scopedDb = getScopedPrismaClient(session);

    const document = await scopedDb.knowledgeBaseDocument.findUnique({ where: { id: params.docId } });
    if (!document || document.knowledgeBaseId !== params.id) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await scopedDb.knowledgeBaseDocument.delete({ where: { id: params.docId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting knowledge base document:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete document." }, { status: 500 });
  }
}
