import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPipeline } from "@/lib/pipeline";

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

    const template = await scopedDb.pipelineTemplate.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: {
              select: { leads: true },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pipeline template not found in this organization." },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error("Error fetching pipeline template:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch pipeline template." },
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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const body = await req.json();
    const { name, program, isDefault, stages } = body;

    const scopedDb = getScopedPrismaClient(session);

    const existingTemplate = await scopedDb.pipelineTemplate.findUnique({
      where: { id },
      include: { stages: true },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Pipeline template not found." },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (program !== undefined) {
      updateData.program = program?.trim() ? program.trim() : null;
    }
    if (isDefault !== undefined && !existingTemplate.isDefault) {
      // If setting this as default, unset other defaults in the org
      if (isDefault) {
        await prisma.pipelineTemplate.updateMany({
          where: { organizationId: session.user.organizationId, isDefault: true },
          data: { isDefault: false },
        });
        updateData.isDefault = true;
      }
    }

    // 1. Update template top-level fields
    if (Object.keys(updateData).length > 0) {
      await scopedDb.pipelineTemplate.update({
        where: { id },
        data: updateData,
      });
    }

    // 2. Manage stages if provided
    if (Array.isArray(stages)) {
      const incomingIds = stages.filter((s: any) => s.id).map((s: any) => s.id);
      const stagesToDelete = existingTemplate.stages.filter(
        (s) => !incomingIds.includes(s.id)
      );

      // Default pipeline fallback stage if we delete stages with leads
      const defaultPipeline = await ensureDefaultPipeline(session.user.organizationId);
      const fallbackStage = defaultPipeline.stages[0];

      // Reassign leads from deleted stages to fallback stage
      for (const deletedStage of stagesToDelete) {
        if (fallbackStage) {
          await prisma.lead.updateMany({
            where: { pipelineStageId: deletedStage.id },
            data: {
              pipelineStageId: fallbackStage.id,
              stage: fallbackStage.mapsToBucket,
            },
          });
        }
        await prisma.pipelineStage.delete({
          where: { id: deletedStage.id },
        });
      }

      // Upsert/update stages
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (stage.id && existingTemplate.stages.some((s) => s.id === stage.id)) {
          // Update existing stage
          await prisma.pipelineStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name.trim(),
              displayOrder: i,
              color: stage.color || "#3b82f6",
              requiresReasonOnExit: Boolean(stage.requiresReasonOnExit),
              mapsToBucket: stage.mapsToBucket || "COLD",
            },
          });

          // Sync lead stage bucket if bucket changed
          await prisma.lead.updateMany({
            where: { pipelineStageId: stage.id },
            data: {
              stage: stage.mapsToBucket || "COLD",
            },
          });
        } else {
          // Create new stage
          await prisma.pipelineStage.create({
            data: {
              pipelineTemplateId: id,
              name: stage.name.trim(),
              displayOrder: i,
              color: stage.color || "#3b82f6",
              requiresReasonOnExit: Boolean(stage.requiresReasonOnExit),
              mapsToBucket: stage.mapsToBucket || "COLD",
            },
          });
        }
      }
    }

    const updatedTemplate = await scopedDb.pipelineTemplate.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: {
              select: { leads: true },
            },
          },
        },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "PIPELINE_TEMPLATE_UPDATED",
        entityType: "PipelineTemplate",
        entityId: id,
        changesJson: JSON.stringify({
          name: updatedTemplate?.name,
          program: updatedTemplate?.program,
          stageCount: updatedTemplate?.stages.length,
          performedBy: session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({ template: updatedTemplate });
  } catch (error: any) {
    console.error("Error updating pipeline template:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update pipeline template." },
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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const template = await scopedDb.pipelineTemplate.findUnique({
      where: { id },
      include: { stages: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pipeline template not found." },
        { status: 404 }
      );
    }

    if (template.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the organization's default pipeline template." },
        { status: 400 }
      );
    }

    const defaultPipeline = await ensureDefaultPipeline(session.user.organizationId);
    const fallbackStage = defaultPipeline.stages[0];

    // Reassign all leads in stages of this pipeline to the default pipeline first stage
    const stageIds = template.stages.map((s) => s.id);
    if (stageIds.length > 0 && fallbackStage) {
      await prisma.lead.updateMany({
        where: { pipelineStageId: { in: stageIds } },
        data: {
          pipelineStageId: fallbackStage.id,
          stage: fallbackStage.mapsToBucket,
        },
      });
    }

    await prisma.pipelineTemplate.delete({
      where: { id },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "PIPELINE_TEMPLATE_DELETED",
        entityType: "PipelineTemplate",
        entityId: id,
        changesJson: JSON.stringify({
          name: template.name,
          program: template.program,
          performedBy: session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({
      message: "Pipeline template deleted and leads migrated to default pipeline.",
    });
  } catch (error: any) {
    console.error("Error deleting pipeline template:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete pipeline template." },
      { status: 500 }
    );
  }
}
