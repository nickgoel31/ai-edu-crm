import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { CustomFieldEntityType } from "@/types";

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
    const entityId = searchParams.get("entityId")?.trim();

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Get active field definitions and recorded values
    const [definitions, values] = await Promise.all([
      scopedDb.customFieldDefinition.findMany({
        where: {
          entityType,
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      scopedDb.customFieldValue.findMany({
        where: {
          entityType,
          entityId,
        },
        include: {
          fieldDefinition: true,
        },
      }),
    ]);

    const parsedDefinitions = definitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    // Map values by fieldKey and fieldDefinitionId
    const valuesByFieldKey: Record<string, any> = {};
    const valuesByFieldId: Record<string, any> = {};

    values.forEach((v) => {
      let castValue: any = v.value;
      const fType = v.fieldDefinition?.fieldType;
      if (fType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (fType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        valuesByFieldKey[v.fieldDefinition.fieldKey] = castValue;
      }
      valuesByFieldId[v.fieldDefinitionId] = castValue;
    });

    return NextResponse.json({
      definitions: parsedDefinitions,
      values,
      valuesByFieldKey,
      valuesByFieldId,
    });
  } catch (error: any) {
    console.error("Error fetching custom field values:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch custom field values." },
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
    assertCanMutate(session);
    const body = await req.json();
    const { entityType, entityId, values } = body;
    // values can be a key-value map: { fieldKeyOrId: value } or array of { fieldDefinitionId, value }

    if (!entityType || !entityId || !values) {
      return NextResponse.json(
        { error: "entityType, entityId, and values are required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Fetch definitions for this entityType
    const definitions = await scopedDb.customFieldDefinition.findMany({
      where: {
        entityType,
      },
    });

    const defByKey = new Map<string, any>();
    const defById = new Map<string, any>();
    definitions.forEach((d) => {
      defByKey.set(d.fieldKey, d);
      defById.set(d.id, d);
    });

    const entriesToSave: Array<{ fieldDefinitionId: string; value: string | null }> = [];

    if (Array.isArray(values)) {
      values.forEach((item) => {
        const def = defById.get(item.fieldDefinitionId) || defByKey.get(item.fieldKey);
        if (def) {
          const stringVal = item.value === null || item.value === undefined ? null : String(item.value);
          entriesToSave.push({ fieldDefinitionId: def.id, value: stringVal });
        }
      });
    } else if (typeof values === "object") {
      Object.entries(values).forEach(([k, v]) => {
        const def = defById.get(k) || defByKey.get(k);
        if (def) {
          const stringVal = v === null || v === undefined || v === "" ? null : String(v);
          entriesToSave.push({ fieldDefinitionId: def.id, value: stringVal });
        }
      });
    }

    // Upsert each custom field value
    await Promise.all(
      entriesToSave.map(async (entry) => {
        const existingVal = await scopedDb.customFieldValue.findUnique({
          where: {
            fieldDefinitionId_entityId: {
              fieldDefinitionId: entry.fieldDefinitionId,
              entityId,
            },
          },
        });

        if (existingVal) {
          return scopedDb.customFieldValue.update({
            where: { id: existingVal.id },
            data: { value: entry.value },
          });
        } else {
          return scopedDb.customFieldValue.create({
            data: {
              organizationId: session.user.organizationId,
              entityType,
              entityId,
              fieldDefinitionId: entry.fieldDefinitionId,
              value: entry.value,
            },
          });
        }
      })
    );

    return NextResponse.json({ success: true, count: entriesToSave.length });
  } catch (error: any) {
    console.error("Error saving custom field values:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save custom field values." },
      { status: 500 }
    );
  }
}
