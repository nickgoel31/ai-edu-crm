import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tagId = params.id;
    const { name, color } = await req.json();

    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Tag name cannot be empty" },
          { status: 400 }
        );
      }
      // Check collision
      const collision = await scopedPrisma.tag.findFirst({
        where: {
          name: trimmedName,
          id: { not: tagId },
        },
      });
      if (collision) {
        return NextResponse.json(
          { error: "Another tag with this name already exists" },
          { status: 409 }
        );
      }
      updateData.name = trimmedName;
    }

    if (color !== undefined) {
      updateData.color = String(color).trim() || "#3b82f6";
    }

    const updatedTag = await scopedPrisma.tag.update({
      where: { id: tagId },
      data: updateData,
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
        action: "TAG_UPDATED",
        entityType: "Tag",
        entityId: tagId,
        changesJson: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ tag: updatedTag });
  } catch (error: any) {
    console.error("PATCH /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ADMIN only delete
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required to delete tags" },
        { status: 403 }
      );
    }

    const tagId = params.id;
    const scopedPrisma = getScopedPrismaClient(session);

    const existing = await scopedPrisma.tag.findUnique({
      where: { id: tagId },
      include: {
        _count: {
          select: { entityTags: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Delete tag (EntityTag rows cascade deleted via schema relation)
    await scopedPrisma.tag.delete({
      where: { id: tagId },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TAG_DELETED",
        entityType: "Tag",
        entityId: tagId,
        changesJson: JSON.stringify({
          name: existing.name,
          color: existing.color,
          removedEntityAttachments: existing._count?.entityTags || 0,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Tag "${existing.name}" deleted`,
    });
  } catch (error: any) {
    console.error("DELETE /api/tags/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete tag" },
      { status: 500 }
    );
  }
}
