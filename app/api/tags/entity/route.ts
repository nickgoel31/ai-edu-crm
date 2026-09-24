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

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType"); // "LEAD" | "STUDENT"
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    const scopedPrisma = getScopedPrismaClient(session);

    const entityTags = await scopedPrisma.entityTag.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        tag: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const tags = entityTags.map((et: any) => et.tag).filter(Boolean);

    return NextResponse.json({ tags, entityTags });
  } catch (error: any) {
    console.error("GET /api/tags/entity error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch entity tags" },
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

    const { entityType, entityId, tagId } = await req.json();

    if (!entityType || !entityId || !tagId) {
      return NextResponse.json(
        { error: "entityType, entityId, and tagId are required" },
        { status: 400 }
      );
    }

    const scopedPrisma = getScopedPrismaClient(session);

    // Verify tag exists in current organization
    const tag = await scopedPrisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Attach tag (upsert or findFirst + create)
    const existing = await scopedPrisma.entityTag.findFirst({
      where: {
        entityType,
        entityId,
        tagId,
      },
      include: { tag: true },
    });

    if (existing) {
      return NextResponse.json({ entityTag: existing, tag: existing.tag });
    }

    const entityTag = await scopedPrisma.entityTag.create({
      data: {
        organizationId: session.user.organizationId,
        entityType,
        entityId,
        tagId,
      },
      include: {
        tag: true,
      },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TAG_ATTACHED",
        entityType,
        entityId,
        changesJson: JSON.stringify({ tagId, tagName: tag.name }),
      },
    });

    return NextResponse.json({ entityTag, tag }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tags/entity error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to attach tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entityType, entityId, tagId } = await req.json();

    if (!entityType || !entityId || !tagId) {
      return NextResponse.json(
        { error: "entityType, entityId, and tagId are required" },
        { status: 400 }
      );
    }

    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.entityTag.findFirst({
      where: {
        entityType,
        entityId,
        tagId,
      },
      include: { tag: true },
    });

    if (!existing) {
      return NextResponse.json({ success: true, message: "Tag not attached" });
    }

    await scopedPrisma.entityTag.delete({
      where: {
        id: existing.id,
      },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TAG_DETACHED",
        entityType,
        entityId,
        changesJson: JSON.stringify({ tagId, tagName: existing.tag?.name }),
      },
    });

    return NextResponse.json({ success: true, message: "Tag detached" });
  } catch (error: any) {
    console.error("DELETE /api/tags/entity error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to detach tag" },
      { status: 500 }
    );
  }
}
