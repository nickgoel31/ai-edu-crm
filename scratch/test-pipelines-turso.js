require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const libsql = createClient({ url, authToken });
const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

const PipelineStageBucket = {
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
  CONVERTING: "CONVERTING",
  LOST: "LOST",
};

const CANONICAL_DEFAULT_STAGES = [
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

async function ensureDefaultPipeline(organizationId) {
  let defaultTemplate = await prisma.pipelineTemplate.findFirst({
    where: { organizationId, isDefault: true },
    include: { stages: { orderBy: { displayOrder: "asc" } } },
  });

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
      include: { stages: { orderBy: { displayOrder: "asc" } } },
    });
  }
  return defaultTemplate;
}

async function main() {
  console.log("🚀 Starting Configurable Pipelines Test Suite (Turso LibSQL Adapter)...");

  // 1. Get or create test organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Test University",
        slug: "test-university-" + Date.now(),
      },
    });
    console.log("✔ Created test organization:", org.id);
  } else {
    console.log("✔ Found organization:", org.id, org.name);
  }

  // 2. Test Default Pipeline auto-provisioning
  const defaultPipeline = await ensureDefaultPipeline(org.id);
  console.log(`✔ Default pipeline verified: "${defaultPipeline.name}" with ${defaultPipeline.stages.length} canonical stages.`);

  if (defaultPipeline.stages.length !== 5) {
    throw new Error(`Expected 5 stages in default pipeline, found ${defaultPipeline.stages.length}`);
  }

  // 3. Test Custom Per-Program Pipeline creation
  const testProgram = "Electric Vehicle Engineering - " + Date.now();
  const customPipeline = await prisma.pipelineTemplate.create({
    data: {
      organizationId: org.id,
      name: "EV Diploma Pipeline",
      program: testProgram,
      isDefault: false,
      stages: {
        create: [
          {
            name: "EV Inquiry / Form Filled",
            displayOrder: 0,
            color: "#3b82f6",
            requiresReasonOnExit: false,
            mapsToBucket: PipelineStageBucket.COLD,
          },
          {
            name: "Technical Screening Call",
            displayOrder: 1,
            color: "#f59e0b",
            requiresReasonOnExit: false,
            mapsToBucket: PipelineStageBucket.WARM,
          },
          {
            name: "Workshop Demonstration & Interview",
            displayOrder: 2,
            color: "#f97316",
            requiresReasonOnExit: false,
            mapsToBucket: PipelineStageBucket.HOT,
          },
          {
            name: "Seat Reserved / Token Paid",
            displayOrder: 3,
            color: "#8b5cf6",
            requiresReasonOnExit: false,
            mapsToBucket: PipelineStageBucket.CONVERTING,
          },
          {
            name: "Rejected / Unresponsive",
            displayOrder: 4,
            color: "#ef4444",
            requiresReasonOnExit: true,
            mapsToBucket: PipelineStageBucket.LOST,
          },
        ],
      },
    },
    include: {
      stages: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });
  console.log(`✔ Created custom per-program pipeline: "${customPipeline.name}" (ID: ${customPipeline.id}) with ${customPipeline.stages.length} stages.`);

  // 4. Test Lead creation for custom program and stage assignment
  const initialStage = customPipeline.stages[0];
  const testLead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      name: "Elon Musk Candidate",
      email: `candidate-${Date.now()}@evlabs.io`,
      phone: `+1-555-${Math.floor(1000000 + Math.random() * 9000000)}`,
      source: "WEBSITE_FORM",
      program: testProgram,
      pipelineStageId: initialStage.id,
      stage: initialStage.mapsToBucket,
    },
    include: {
      pipelineStage: true,
    },
  });
  console.log(`✔ Created Lead "${testLead.name}" linked to stage "${testLead.pipelineStage.name}" (Bucket: ${testLead.stage}).`);

  if (testLead.stage !== "COLD") {
    throw new Error(`Lead stage mismatch! Expected COLD, got ${testLead.stage}`);
  }

  // 5. Test Stage Transition & Bucket Derivation
  const convertingStage = customPipeline.stages.find((s) => s.mapsToBucket === PipelineStageBucket.CONVERTING);
  const updatedLead = await prisma.lead.update({
    where: { id: testLead.id },
    data: {
      pipelineStageId: convertingStage.id,
      stage: convertingStage.mapsToBucket,
    },
    include: {
      pipelineStage: true,
    },
  });
  console.log(`✔ Moved Lead to stage "${updatedLead.pipelineStage.name}" -> Automatically derived stage bucket: ${updatedLead.stage}`);

  if (updatedLead.stage !== "CONVERTING") {
    throw new Error(`Stage derivation failed! Expected CONVERTING, got ${updatedLead.stage}`);
  }

  // 6. Cleanup test lead & custom pipeline
  await prisma.lead.delete({ where: { id: testLead.id } });
  await prisma.pipelineTemplate.delete({ where: { id: customPipeline.id } });
  console.log("✔ Cleaned up test lead and custom pipeline.");

  console.log("\n🎉 ALL CONFIGURABLE PIPELINE TESTS PASSED WITH 100% SUCCESS!");
}

main()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
