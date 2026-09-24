import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { DuplicateMatchStatus } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType"); // "LEAD" | "STUDENT" | null
    const status = searchParams.get("status"); // "PENDING" | "MERGED" | "DISMISSED" | null

    const scopedPrisma = getScopedPrismaClient(session);
    const orgId = session.user.organizationId;

    const where: any = {};
    if (entityType) {
      where.entityType = entityType;
    }
    if (status && Object.values(DuplicateMatchStatus).includes(status as any)) {
      where.status = status;
    }

    // Fetch duplicate matches
    const matches = await scopedPrisma.duplicateMatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Counts for tabs/badges
    const counts = {
      PENDING: await scopedPrisma.duplicateMatch.count({
        where: { ...(entityType ? { entityType } : {}), status: DuplicateMatchStatus.PENDING },
      }),
      MERGED: await scopedPrisma.duplicateMatch.count({
        where: { ...(entityType ? { entityType } : {}), status: DuplicateMatchStatus.MERGED },
      }),
      DISMISSED: await scopedPrisma.duplicateMatch.count({
        where: { ...(entityType ? { entityType } : {}), status: DuplicateMatchStatus.DISMISSED },
      }),
      TOTAL: await scopedPrisma.duplicateMatch.count({
        where: entityType ? { entityType } : {},
      }),
    };

    // Hydrate all primary and duplicate entities
    const leadIds = new Set<string>();
    const studentIds = new Set<string>();

    matches.forEach((m) => {
      if (m.entityType === "LEAD") {
        leadIds.add(m.primaryEntityId);
        leadIds.add(m.duplicateEntityId);
      } else if (m.entityType === "STUDENT") {
        studentIds.add(m.primaryEntityId);
        studentIds.add(m.duplicateEntityId);
      }
    });

    const [
      leads,
      students,
      customFieldDefinitions,
      customFieldValues,
      entityTags,
    ] = await Promise.all([
      leadIds.size > 0
        ? scopedPrisma.lead.findMany({
            where: { id: { in: Array.from(leadIds) } },
            include: {
              assignedTo: {
                select: { id: true, name: true, email: true },
              },
            },
          })
        : [],
      studentIds.size > 0
        ? scopedPrisma.student.findMany({
            where: { id: { in: Array.from(studentIds) } },
            include: {
              documents: true,
              payments: true,
            },
          })
        : [],
      scopedPrisma.customFieldDefinition.findMany({
        where: {
          isActive: true,
          ...(entityType ? { entityType } : {}),
        },
        orderBy: { displayOrder: "asc" },
      }),
      scopedPrisma.customFieldValue.findMany({
        where: {
          entityId: {
            in: [...Array.from(leadIds), ...Array.from(studentIds)],
          },
        },
        include: {
          fieldDefinition: true,
        },
      }),
      scopedPrisma.entityTag.findMany({
        where: {
          entityId: {
            in: [...Array.from(leadIds), ...Array.from(studentIds)],
          },
        },
        include: {
          tag: true,
        },
      }),
    ]);

    // Build lookup maps
    const leadsMap = new Map(leads.map((l) => [l.id, l]));
    const studentsMap = new Map(students.map((s) => [s.id, s]));

    const customFieldsMap: Record<string, Record<string, any>> = {};
    customFieldValues.forEach((v) => {
      if (!customFieldsMap[v.entityId]) {
        customFieldsMap[v.entityId] = {};
      }
      let castValue: any = v.value;
      if (v.fieldDefinition?.fieldType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (v.fieldDefinition?.fieldType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        customFieldsMap[v.entityId][v.fieldDefinition.fieldKey] = castValue;
      }
    });

    const tagsMap: Record<string, any[]> = {};
    entityTags.forEach((et) => {
      if (!tagsMap[et.entityId]) {
        tagsMap[et.entityId] = [];
      }
      if (et.tag) {
        tagsMap[et.entityId].push(et.tag);
      }
    });

    // Hydrate matches
    const hydratedMatches = matches.map((m) => {
      const isLead = m.entityType === "LEAD";
      const primary = isLead
        ? leadsMap.get(m.primaryEntityId)
        : studentsMap.get(m.primaryEntityId);
      const duplicate = isLead
        ? leadsMap.get(m.duplicateEntityId)
        : studentsMap.get(m.duplicateEntityId);

      const relevantDefs = customFieldDefinitions.filter(
        (def) => def.entityType === m.entityType
      );

      return {
        ...m,
        primaryEntity: primary || null,
        duplicateEntity: duplicate || null,
        primaryCustomFields: customFieldsMap[m.primaryEntityId] || {},
        duplicateCustomFields: customFieldsMap[m.duplicateEntityId] || {},
        primaryTags: tagsMap[m.primaryEntityId] || [],
        duplicateTags: tagsMap[m.duplicateEntityId] || [],
        customFieldDefinitions: relevantDefs,
      };
    });

    return NextResponse.json({
      duplicateMatches: hydratedMatches,
      counts,
    });
  } catch (error: any) {
    console.error("GET /api/duplicates error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch duplicate matches" },
      { status: 500 }
    );
  }
}
