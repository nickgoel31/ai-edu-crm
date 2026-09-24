import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { CustomFieldType } from "@/types";

export async function GET(
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
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const definition = await scopedDb.customFieldDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });

    if (!definition) {
      return NextResponse.json(
        { error: "Custom field definition not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      definition: {
        ...definition,
        options: definition.options ? JSON.parse(definition.options) : null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching custom field definition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch custom field." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    assertAdmin(session);
    const { id } = params;
    const body = await req.json();
    const { label, options, required, displayOrder, isActive } = body;

    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.customFieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Custom field definition not found." },
        { status: 404 }
      );
    }

    const updates: any = {};
    if (label !== undefined && label.trim()) updates.label = label.trim();
    if (required !== undefined) updates.required = Boolean(required);
    if (displayOrder !== undefined && typeof displayOrder === "number") updates.displayOrder = displayOrder;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    if (options !== undefined) {
      if (existing.fieldType === CustomFieldType.SELECT) {
        if (!Array.isArray(options) || options.length === 0) {
          return NextResponse.json(
            { error: "SELECT fields require at least one option." },
            { status: 400 }
          );
        }
        updates.options = JSON.stringify(options.map((o: any) => String(o).trim()).filter(Boolean));
      }
    }

    const updated = await scopedDb.customFieldDefinition.update({
      where: { id },
      data: updates,
    });

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CUSTOM_FIELD_UPDATED",
        entityType: "CustomFieldDefinition",
        entityId: id,
        changesJson: JSON.stringify(updates),
      },
    });

    return NextResponse.json({
      definition: {
        ...updated,
        options: updated.options ? JSON.parse(updated.options) : null,
      },
    });
  } catch (error: any) {
    console.error("Error updating custom field definition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update custom field." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    assertAdmin(session);
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.customFieldDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Custom field definition not found." },
        { status: 404 }
      );
    }

    // Soft-deactivate if it has values or per preference, or hard delete if 0 values
    if (existing._count.values > 0) {
      // Deactivate
      await scopedDb.customFieldDefinition.update({
        where: { id },
        data: { isActive: false },
      });

      await scopedDb.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: "CUSTOM_FIELD_DEACTIVATED",
          entityType: "CustomFieldDefinition",
          entityId: id,
          changesJson: JSON.stringify({ fieldKey: existing.fieldKey, preservedValuesCount: existing._count.values }),
        },
      });

      return NextResponse.json({
        message: "Field deactivated and preserved existing data.",
        deactivated: true,
      });
    } else {
      await scopedDb.customFieldDefinition.delete({
        where: { id },
      });

      await scopedDb.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: "CUSTOM_FIELD_DELETED",
          entityType: "CustomFieldDefinition",
          entityId: id,
          changesJson: JSON.stringify({ fieldKey: existing.fieldKey }),
        },
      });

      return NextResponse.json({
        message: "Field deleted successfully.",
        deleted: true,
      });
    }
  } catch (error: any) {
    console.error("Error deleting custom field definition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete custom field." },
      { status: 500 }
    );
  }
}
