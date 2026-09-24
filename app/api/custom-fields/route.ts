import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { CustomFieldEntityType, CustomFieldType } from "@/types";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as CustomFieldEntityType | null;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const scopedDb = getScopedPrismaClient(session);

    const where: any = {};
    if (entityType && (entityType === "LEAD" || entityType === "STUDENT")) {
      where.entityType = entityType;
    }
    if (!includeInactive) {
      where.isActive = true;
    }

    const definitions = await scopedDb.customFieldDefinition.findMany({
      where,
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });

    // Parse JSON options for SELECT fields
    const parsedDefinitions = definitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    return NextResponse.json({
      definitions: parsedDefinitions,
    });
  } catch (error: any) {
    console.error("Error fetching custom field definitions:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch custom fields." },
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
    const { entityType, fieldKey, label, fieldType, options, required, displayOrder } = body;

    if (!entityType || (entityType !== "LEAD" && entityType !== "STUDENT")) {
      return NextResponse.json(
        { error: "entityType must be either 'LEAD' or 'STUDENT'." },
        { status: 400 }
      );
    }

    if (!label?.trim()) {
      return NextResponse.json(
        { error: "Field label is required." },
        { status: 400 }
      );
    }

    // Clean / validate fieldKey
    let cleanKey = fieldKey?.trim()?.toLowerCase()?.replace(/[^a-z0-9_]/g, "_");
    if (!cleanKey) {
      cleanKey = label.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    }

    if (!fieldType || !Object.values(CustomFieldType).includes(fieldType)) {
      return NextResponse.json(
        { error: "Valid fieldType (TEXT, NUMBER, DATE, SELECT, BOOLEAN) is required." },
        { status: 400 }
      );
    }

    let serializedOptions: string | null = null;
    if (fieldType === CustomFieldType.SELECT) {
      if (!Array.isArray(options) || options.length === 0) {
        return NextResponse.json(
          { error: "SELECT fields require at least one option." },
          { status: 400 }
        );
      }
      serializedOptions = JSON.stringify(options.map((o: any) => String(o).trim()).filter(Boolean));
    }

    const scopedDb = getScopedPrismaClient(session);

    // Check for duplicate key
    const existing = await scopedDb.customFieldDefinition.findFirst({
      where: {
        entityType,
        fieldKey: cleanKey,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A field with key '${cleanKey}' already exists for ${entityType}.` },
        { status: 400 }
      );
    }

    // Determine display order if not provided
    let order = typeof displayOrder === "number" ? displayOrder : 0;
    if (displayOrder === undefined) {
      const maxOrderField = await scopedDb.customFieldDefinition.findFirst({
        where: { entityType },
        orderBy: { displayOrder: "desc" },
      });
      order = maxOrderField ? maxOrderField.displayOrder + 1 : 0;
    }

    const definition = await scopedDb.customFieldDefinition.create({
      data: {
        organizationId: session.user.organizationId,
        entityType,
        fieldKey: cleanKey,
        label: label.trim(),
        fieldType,
        options: serializedOptions,
        required: Boolean(required),
        displayOrder: order,
        isActive: true,
      },
    });

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CUSTOM_FIELD_CREATED",
        entityType: "CustomFieldDefinition",
        entityId: definition.id,
        changesJson: JSON.stringify({
          entityType,
          fieldKey: cleanKey,
          label: definition.label,
          fieldType,
        }),
      },
    });

    return NextResponse.json(
      {
        definition: {
          ...definition,
          options: definition.options ? JSON.parse(definition.options) : null,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating custom field definition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create custom field." },
      { status: 500 }
    );
  }
}
