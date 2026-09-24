import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedPrisma = getScopedPrismaClient(session);

    const tags = await scopedPrisma.tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { entityTags: true },
        },
      },
    });

    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color } = await req.json();

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const tagColor = (color || "").trim() || "#3b82f6";

    const scopedPrisma = getScopedPrismaClient(session);

    // Check if tag already exists in organization
    const existing = await scopedPrisma.tag.findFirst({
      where: {
        name: trimmedName,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists", tag: existing },
        { status: 409 }
      );
    }

    const newTag = await scopedPrisma.tag.create({
      data: {
        organizationId: session.user.organizationId,
        name: trimmedName,
        color: tagColor,
      },
      include: {
        _count: {
          select: { entityTags: true },
        },
      },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TAG_CREATED",
        entityType: "Tag",
        entityId: newTag.id,
        changesJson: JSON.stringify({ name: newTag.name, color: newTag.color }),
      },
    });

    return NextResponse.json({ tag: newTag }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tags error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create tag" },
      { status: 500 }
    );
  }
}
