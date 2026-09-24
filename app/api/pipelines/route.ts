import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { ensureDefaultPipeline } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const orgId = session.user.organizationId;
    // Ensure default pipeline exists
    await ensureDefaultPipeline(orgId);

    const scopedDb = getScopedPrismaClient(session);

    const templates = await scopedDb.pipelineTemplate.findMany({
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: {
              select: { leads: true },
            },
          },
        },
        _count: {
          select: { stages: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      templates,
    });
  } catch (error: any) {
    console.error("Error fetching pipeline templates:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch pipeline templates." },
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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required to create pipeline templates." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, program, stages } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Pipeline template name is required." },
        { status: 400 }
      );
    }

    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);

    const cleanProgram = program?.trim() ? program.trim() : null;

    // If program is specified, check if one already exists for this program
    if (cleanProgram) {
      const existing = await scopedDb.pipelineTemplate.findFirst({
        where: { program: cleanProgram },
      });
      if (existing) {
        return NextResponse.json(
          { error: `A pipeline template already exists for program "${cleanProgram}".` },
          { status: 400 }
        );
      }
    }

    const stageData = Array.isArray(stages) && stages.length > 0
      ? stages.map((s: any, idx: number) => ({
          name: s.name.trim(),
          displayOrder: typeof s.displayOrder === "number" ? s.displayOrder : idx,
          color: s.color || "#3b82f6",
          requiresReasonOnExit: Boolean(s.requiresReasonOnExit),
          mapsToBucket: s.mapsToBucket || "COLD",
        }))
      : [
          {
            name: "New Inquiries",
            displayOrder: 0,
            color: "#3b82f6",
            requiresReasonOnExit: false,
            mapsToBucket: "COLD",
          },
          {
            name: "Qualified",
            displayOrder: 1,
            color: "#f59e0b",
            requiresReasonOnExit: false,
            mapsToBucket: "WARM",
          },
          {
            name: "Counseling",
            displayOrder: 2,
            color: "#f97316",
            requiresReasonOnExit: false,
            mapsToBucket: "HOT",
          },
          {
            name: "Enrolling",
            displayOrder: 3,
            color: "#8b5cf6",
            requiresReasonOnExit: false,
            mapsToBucket: "CONVERTING",
          },
          {
            name: "Lost / Closed",
            displayOrder: 4,
            color: "#ef4444",
            requiresReasonOnExit: true,
            mapsToBucket: "LOST",
          },
        ];

    const template = await prisma.pipelineTemplate.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        program: cleanProgram,
        isDefault: false,
        stages: {
          create: stageData,
        },
      },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "PIPELINE_TEMPLATE_CREATED",
        entityType: "PipelineTemplate",
        entityId: template.id,
        changesJson: JSON.stringify({
          name: template.name,
          program: template.program,
          stageCount: template.stages.length,
          performedBy: session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating pipeline template:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create pipeline template." },
      { status: 500 }
    );
  }
}
