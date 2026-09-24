import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const rawTemplates = await scopedDb.documentTemplate.findMany({
      orderBy: { program: "asc" },
    });

    const templates = rawTemplates.map((t) => ({
      ...t,
      requiredDocuments: typeof t.requiredDocuments === "string" ? JSON.parse(t.requiredDocuments) : t.requiredDocuments,
    }));

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Error fetching document templates:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch document templates." },
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
    assertAdmin(session);
    const body = await req.json();
    const { program, requiredDocuments } = body;

    if (!program?.trim()) {
      return NextResponse.json(
        { error: "Program name is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(requiredDocuments)) {
      return NextResponse.json(
        { error: "requiredDocuments must be an array of document names." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const template = await scopedDb.documentTemplate.upsert({
      where: {
        organizationId_program: {
          organizationId: session.user.organizationId,
          program: program.trim(),
        },
      },
      update: {
        requiredDocuments: JSON.stringify(requiredDocuments),
      },
      create: {
        organizationId: session.user.organizationId,
        program: program.trim(),
        requiredDocuments: JSON.stringify(requiredDocuments),
      },
    });

    return NextResponse.json({
      template: {
        ...template,
        requiredDocuments: typeof template.requiredDocuments === "string" ? JSON.parse(template.requiredDocuments) : template.requiredDocuments,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error saving document template:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save document template." },
      { status: 500 }
    );
  }
}
