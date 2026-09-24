import { prisma } from "@/lib/prisma";
import { PipelineStageBucket } from "@/types";

export const CANONICAL_DEFAULT_STAGES: Array<{
  name: string;
  displayOrder: number;
  color: string;
  mapsToBucket: string;
  requiresReasonOnExit: boolean;
}> = [
  {
    name: "New / Inbound Inquiries",
    displayOrder: 0,
    color: "#3b82f6",
    mapsToBucket: PipelineStageBucket.COLD,
    requiresReasonOnExit: false,
  },
  {
    name: "Contacted / Qualified",
    displayOrder: 1,
    color: "#f59e0b",
    mapsToBucket: PipelineStageBucket.WARM,
    requiresReasonOnExit: false,
  },
  {
    name: "Counseling / High Intent",
    displayOrder: 2,
    color: "#f97316",
    mapsToBucket: PipelineStageBucket.HOT,
    requiresReasonOnExit: false,
  },
  {
    name: "Application / Converting",
    displayOrder: 3,
    color: "#8b5cf6",
    mapsToBucket: PipelineStageBucket.CONVERTING,
    requiresReasonOnExit: false,
  },
  {
    name: "Lost / Disqualified",
    displayOrder: 4,
    color: "#ef4444",
    mapsToBucket: PipelineStageBucket.LOST,
    requiresReasonOnExit: true,
  },
];

/**
 * Ensures an organization has a default PipelineTemplate with 5 canonical stages.
 * If not present, creates it automatically.
 */
export async function ensureDefaultPipeline(organizationId: string) {
  let defaultTemplate = await prisma.pipelineTemplate.findFirst({
    where: {
      organizationId,
      isDefault: true,
    },
    include: {
      stages: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!defaultTemplate) {
    // Check if there is any template without program
    defaultTemplate = await prisma.pipelineTemplate.findFirst({
      where: {
        organizationId,
        program: null,
      },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  if (!defaultTemplate) {
    defaultTemplate = await prisma.pipelineTemplate.create({
      data: {
        organizationId,
        name: "Default Admissions Pipeline",
        program: null,
        isDefault: true,
        stages: {
          create: CANONICAL_DEFAULT_STAGES,
        },
      },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  } else if (defaultTemplate.stages.length === 0) {
    // Backfill stages if template was empty
    await prisma.pipelineStage.createMany({
      data: CANONICAL_DEFAULT_STAGES.map((s) => ({
        pipelineTemplateId: defaultTemplate!.id,
        ...s,
      })),
    });

    defaultTemplate = await prisma.pipelineTemplate.findUnique({
      where: { id: defaultTemplate.id },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  return defaultTemplate!;
}

/**
 * Finds the matching pipeline template for an organization and optional program.
 * Falls back to default template if no program-specific template exists.
 */
export async function getPipelineForLead(organizationId: string, program?: string | null) {
  if (program && program.trim()) {
    const programTemplate = await prisma.pipelineTemplate.findFirst({
      where: {
        organizationId,
        program: {
          equals: program.trim(),
        },
      },
      include: {
        stages: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });
    if (programTemplate && programTemplate.stages.length > 0) {
      return programTemplate;
    }
  }

  return ensureDefaultPipeline(organizationId);
}

/**
 * Returns the default first stage for a given pipeline template or program.
 */
export async function getInitialPipelineStage(organizationId: string, program?: string | null) {
  const pipeline = await getPipelineForLead(organizationId, program);
  return pipeline.stages[0] || null;
}

/**
 * Helper to ensure an existing lead without a pipelineStageId gets assigned to the correct stage.
 */
export async function ensureLeadPipelineStage(lead: {
  id: string;
  organizationId: string;
  program?: string | null;
  stage: string;
  pipelineStageId?: string | null;
}) {
  if (lead.pipelineStageId) {
    return lead.pipelineStageId;
  }

  const pipeline = await getPipelineForLead(lead.organizationId, lead.program);
  const matchedStage =
    pipeline.stages.find((s) => s.mapsToBucket === lead.stage) ||
    pipeline.stages[0];

  if (matchedStage) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStageId: matchedStage.id,
        stage: matchedStage.mapsToBucket,
      },
    });
    return matchedStage.id;
  }

  return null;
}
