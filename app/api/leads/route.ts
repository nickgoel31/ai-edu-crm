import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { LeadSource, LeadStage } from "@/types";
import { normalizePhoneNumber, checkAndCreateLeadDuplicateMatch } from "@/lib/dedup";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { computeLeadSlaDueBy } from "@/lib/sla";

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
    const q = searchParams.get("q")?.trim();
    const source = searchParams.get("source") as LeadSource | null;
    const counselorId = searchParams.get("counselorId")?.trim();
    const stage = searchParams.get("stage") as LeadStage | null;
    const dateRange = searchParams.get("dateRange");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const scopedDb = getScopedPrismaClient(session);

    // Build filter where clause
    const where: any = { isArchived: false };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    if (source && Object.values(LeadSource).includes(source)) {
      where.source = source;
    }

    if (counselorId) {
      if (counselorId === "unassigned") {
        where.assignedToUserId = null;
      } else {
        where.assignedToUserId = counselorId;
      }
    }

    if (stage && Object.values(LeadStage).includes(stage)) {
      where.stage = stage;
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      if (dateRange === "today") {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        where.createdAt = { gte: startOfDay };
      } else if (dateRange === "7days") {
        const past7Days = new Date(now.setDate(now.getDate() - 7));
        where.createdAt = { gte: past7Days };
      } else if (dateRange === "30days") {
        const past30Days = new Date(now.setDate(now.getDate() - 30));
        where.createdAt = { gte: past30Days };
      }
    }

    // Determine sorting
    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "name") {
      orderBy = { name: sortOrder };
    } else if (sortBy === "score") {
      orderBy = { score: sortOrder };
    } else {
      orderBy = { createdAt: sortOrder };
    }

    const [leads, counselors, customFieldDefinitions, customFieldValues, entityTags, allTags] = await Promise.all([
      scopedDb.lead.findMany({
        where,
        orderBy,
        include: {
          pipelineStage: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      scopedDb.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: "asc" },
      }),
      scopedDb.customFieldDefinition.findMany({
        where: {
          entityType: "LEAD",
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      scopedDb.customFieldValue.findMany({
        where: {
          entityType: "LEAD",
        },
        include: {
          fieldDefinition: true,
        },
      }),
      scopedDb.entityTag.findMany({
        where: {
          entityType: "LEAD",
        },
        include: {
          tag: true,
        },
      }),
      scopedDb.tag.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    // Build value map by leadId -> { fieldKey: castValue }
    const valuesByLeadId: Record<string, Record<string, any>> = {};
    customFieldValues.forEach((v: any) => {
      if (!valuesByLeadId[v.entityId]) {
        valuesByLeadId[v.entityId] = {};
      }
      let castValue: any = v.value;
      if (v.fieldDefinition?.fieldType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (v.fieldDefinition?.fieldType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        valuesByLeadId[v.entityId][v.fieldDefinition.fieldKey] = castValue;
      }
    });

    // Build tags map by leadId -> Tag[]
    const tagsByLeadId: Record<string, any[]> = {};
    entityTags.forEach((et: any) => {
      if (!tagsByLeadId[et.entityId]) {
        tagsByLeadId[et.entityId] = [];
      }
      if (et.tag) {
        tagsByLeadId[et.entityId].push(et.tag);
      }
    });

    const enrichedLeads = leads.map((lead: any) => ({
      ...lead,
      customFields: valuesByLeadId[lead.id] || {},
      tags: tagsByLeadId[lead.id] || [],
    }));

    const parsedDefinitions = customFieldDefinitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    return NextResponse.json({
      leads: enrichedLeads,
      counselors,
      customFieldDefinitions: parsedDefinitions,
      tags: allTags,
      total: leads.length,
    });
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch leads." },
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
    const body = await req.json();
    const { name, phone, email, source, stage, program, pipelineStageId, assignedToUserId, customFields } = body;

    if (!name?.trim() || !phone?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name, phone, and email are required." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone.trim());
    const leadSource = source || LeadSource.MANUAL;

    const scopedDb = getScopedPrismaClient(session);

    // Resolve pipeline stage
    let resolvedPipelineStageId = pipelineStageId || null;
    let resolvedStage = stage || LeadStage.COLD;

    if (resolvedPipelineStageId) {
      const ps = await scopedDb.pipelineStage.findFirst({
        where: { id: resolvedPipelineStageId },
      });
      if (ps) {
        resolvedStage = ps.mapsToBucket as LeadStage;
      }
    } else {
      // Find matching stage from template
      const pipeline = await scopedDb.pipelineTemplate.findFirst({
        where: program ? { program } : { isDefault: true },
        include: { stages: { orderBy: { displayOrder: "asc" } } },
      });
      if (pipeline && pipeline.stages.length > 0) {
        const matched = pipeline.stages.find((s: any) => s.mapsToBucket === resolvedStage) || pipeline.stages[0];
        resolvedPipelineStageId = matched.id;
        resolvedStage = matched.mapsToBucket as LeadStage;
      }
    }

    // Compute SLA deadline based on source policy or org default
    const { dueBy } = await computeLeadSlaDueBy({
      organizationId: session.user.organizationId,
      source: leadSource,
      client: scopedDb,
    });

    const lead = await scopedDb.lead.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim().toLowerCase(),
        source: leadSource,
        stage: resolvedStage,
        program: program?.trim() || null,
        pipelineStageId: resolvedPipelineStageId,
        assignedToUserId: assignedToUserId || null,
        slaDueBy: dueBy,
      },
      include: {
        pipelineStage: true,
      },
    });

    // Run deduplication check against existing leads in the organization
    const duplicateResult = await checkAndCreateLeadDuplicateMatch({
      organizationId: session.user.organizationId,
      newLeadId: lead.id,
      phone: normalizedPhone,
      email: email.trim().toLowerCase(),
      client: scopedDb,
    });

    // Save custom fields if provided
    if (customFields && typeof customFields === "object") {
      const definitions = await scopedDb.customFieldDefinition.findMany({
        where: { entityType: "LEAD" },
      });

      const defByKey = new Map<string, any>();
      definitions.forEach((d) => defByKey.set(d.fieldKey, d));

      for (const [key, val] of Object.entries(customFields)) {
        const def = defByKey.get(key);
        if (def && val !== undefined && val !== null && val !== "") {
          await scopedDb.customFieldValue.create({
            data: {
              organizationId: session.user.organizationId,
              entityType: "LEAD",
              entityId: lead.id,
              fieldDefinitionId: def.id,
              value: String(val),
            },
          });
        }
      }
    }

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: duplicateResult ? "LEAD_CREATED_WITH_DUPLICATE_FLAG" : "LEAD_CREATED",
        entityType: "Lead",
        entityId: lead.id,
        changesJson: JSON.stringify({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          duplicateMatchId: duplicateResult?.duplicateMatch?.id || null,
          primaryLeadId: duplicateResult?.primaryLead?.id || null,
        }),
      },
    });

    // Calculate initial score using scoring engine rules
    let scoredLead = lead;
    try {
      const result = await recalculateLeadScore(lead.id, session.user.organizationId);
      if (result) {
        scoredLead = result.lead;
      }
    } catch (scoringErr) {
      console.error("Non-blocking error during initial lead score calculation:", scoringErr);
    }

    return NextResponse.json(
      {
        lead: scoredLead,
        duplicateMatch: duplicateResult?.duplicateMatch || null,
        primaryLead: duplicateResult?.primaryLead || null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create lead." },
      { status: 500 }
    );
  }
}
