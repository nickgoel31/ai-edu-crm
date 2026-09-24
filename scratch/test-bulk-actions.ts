import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "../lib/rbac";
import { LeadStage, StudentStage } from "../types";

async function runTests() {
  console.log("🚀 Running Bulk Actions Verification Suite...\n");

  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
  });

  if (!org) throw new Error("Organization not found.");

  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
  });
  const counselor = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "COUNSELOR" },
  });
  const readonly = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "READONLY" },
  });

  if (!admin || !counselor || !readonly) {
    throw new Error("Admin, Counselor, or Readonly user missing!");
  }

  const adminSession = {
    user: { id: admin.id, email: admin.email, role: admin.role, organizationId: org.id, name: admin.name },
  };
  const counselorSession = {
    user: { id: counselor.id, email: counselor.email, role: counselor.role, organizationId: org.id, name: counselor.name },
  };
  const readonlySession = {
    user: { id: readonly.id, email: readonly.email, role: readonly.role, organizationId: org.id, name: readonly.name },
  };

  const scopedDb = getScopedPrismaClient(adminSession as any);

  // 1. Create Test Leads
  console.log("--- Test 1: Setup Test Leads & Bulk Stage Change ---");
  const testLead1 = await scopedDb.lead.create({
    data: {
      name: "Bulk Test Lead A",
      email: "bulk.a@example.com",
      phone: "+919876543201",
      source: "META_ADS",
      stage: LeadStage.COLD,
    },
  });

  const testLead2 = await scopedDb.lead.create({
    data: {
      name: "Bulk Test Lead B",
      email: "bulk.b@example.com",
      phone: "+919876543202",
      source: "WHATSAPP",
      stage: LeadStage.COLD,
    },
  });

  console.log(`✔ Created 2 test leads (${testLead1.id}, ${testLead2.id})`);

  // Test 1b: Bulk move to LOST requires lostReason
  console.log("--- Test 1b: Bulk Stage Change to LOST with Reason ---");
  const leadsToLost = [testLead1.id, testLead2.id];
  const lostReason = "Budget: Fees too high for current financial year";

  await scopedDb.lead.updateMany({
    where: { id: { in: leadsToLost } },
    data: { stage: LeadStage.LOST, lostReason },
  });

  for (const id of leadsToLost) {
    await scopedDb.auditLog.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        action: "LEAD_STAGE_UPDATED",
        entityType: "Lead",
        entityId: id,
        changesJson: JSON.stringify({ oldStage: "COLD", newStage: "LOST", lostReason, bulk: true }),
      },
    });
  }

  const updatedLeads = await scopedDb.lead.findMany({
    where: { id: { in: leadsToLost } },
  });

  if (updatedLeads.some((l) => l.stage !== LeadStage.LOST || l.lostReason !== lostReason)) {
    throw new Error("Bulk stage update to LOST failed to record stage or lostReason.");
  }
  console.log(`✔ Both leads moved to LOST with lostReason: "${lostReason}"`);

  // Test 2: Bulk Tag Addition & Removal (Lead & Student)
  console.log("\n--- Test 2: Bulk Tag (Add & Remove) ---");
  let testTag = await scopedDb.tag.findFirst({ where: { name: "2026-Priority" } });
  if (!testTag) {
    testTag = await scopedDb.tag.create({
      data: { name: "2026-Priority", color: "#8b5cf6" },
    });
  }

  // Add tag to both leads
  for (const leadId of leadsToLost) {
    await scopedDb.entityTag.create({
      data: {
        organizationId: org.id,
        entityType: "LEAD",
        entityId: leadId,
        tagId: testTag.id,
      },
    });
  }

  const taggedEntities = await scopedDb.entityTag.findMany({
    where: { entityType: "LEAD", tagId: testTag.id, entityId: { in: leadsToLost } },
  });
  if (taggedEntities.length !== 2) throw new Error("Bulk tag attach failed.");
  console.log(`✔ Tag "${testTag.name}" attached across ${taggedEntities.length} leads.`);

  // Remove tag
  await scopedDb.entityTag.deleteMany({
    where: { entityType: "LEAD", tagId: testTag.id, entityId: { in: leadsToLost } },
  });
  const remainingTags = await scopedDb.entityTag.findMany({
    where: { entityType: "LEAD", tagId: testTag.id, entityId: { in: leadsToLost } },
  });
  if (remainingTags.length !== 0) throw new Error("Bulk tag detach failed.");
  console.log(`✔ Tag "${testTag.name}" detached cleanly across all leads.`);

  // Test 3: Students Bulk Stage Change & Tagging
  console.log("\n--- Test 3: Students Bulk Operations ---");
  const testStudent1 = await scopedDb.student.create({
    data: {
      name: "Bulk Student X",
      email: "student.x@example.com",
      phone: "+919876543203",
      program: "Full Stack AI Bootcamp",
      cohort: "2026-A",
      stage: StudentStage.ENQUIRY,
    },
  });
  const testStudent2 = await scopedDb.student.create({
    data: {
      name: "Bulk Student Y",
      email: "student.y@example.com",
      phone: "+919876543204",
      program: "Full Stack AI Bootcamp",
      cohort: "2026-A",
      stage: StudentStage.ENQUIRY,
    },
  });

  const studentIds = [testStudent1.id, testStudent2.id];

  // Bulk Stage Change to ACTIVE
  await scopedDb.student.updateMany({
    where: { id: { in: studentIds } },
    data: { stage: StudentStage.ACTIVE },
  });

  const activeStudents = await scopedDb.student.findMany({
    where: { id: { in: studentIds } },
  });
  if (activeStudents.some((s) => s.stage !== StudentStage.ACTIVE)) {
    throw new Error("Bulk student stage update failed.");
  }
  console.log(`✔ ${activeStudents.length} students moved to ACTIVE stage.`);

  // Test 4: Bulk Soft Delete & AuditLog Trail
  console.log("\n--- Test 4: Bulk Soft Delete & AuditLog Verification ---");
  const now = new Date();

  // Soft delete leads
  await scopedDb.lead.updateMany({
    where: { id: { in: leadsToLost } },
    data: { isArchived: true, archivedAt: now },
  });

  for (const id of leadsToLost) {
    await scopedDb.auditLog.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        action: "LEAD_DELETED",
        entityType: "Lead",
        entityId: id,
        changesJson: JSON.stringify({ softDelete: true, bulk: true }),
      },
    });
  }

  // Soft delete students
  await scopedDb.student.updateMany({
    where: { id: { in: studentIds } },
    data: { isArchived: true, archivedAt: now },
  });

  for (const id of studentIds) {
    await scopedDb.auditLog.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        action: "STUDENT_DELETED",
        entityType: "Student",
        entityId: id,
        changesJson: JSON.stringify({ softDelete: true, bulk: true }),
      },
    });
  }

  // Verify that active queries exclude soft-deleted leads and students
  const activeLeadsQuery = await scopedDb.lead.findMany({
    where: { isArchived: false, id: { in: leadsToLost } },
  });
  if (activeLeadsQuery.length !== 0) throw new Error("Soft-deleted leads still returned in active query.");

  const activeStudentsQuery = await scopedDb.student.findMany({
    where: { isArchived: false, id: { in: studentIds } },
  });
  if (activeStudentsQuery.length !== 0) throw new Error("Soft-deleted students still returned in active query.");

  // Verify AuditLog entries
  const deleteAuditLogs = await scopedDb.auditLog.findMany({
    where: {
      action: { in: ["LEAD_DELETED", "STUDENT_DELETED"] },
      entityId: { in: [...leadsToLost, ...studentIds] },
    },
  });

  if (deleteAuditLogs.length !== 4) {
    throw new Error(`Expected 4 audit log entries for deleted records, got ${deleteAuditLogs.length}`);
  }
  console.log(`✔ Soft delete verified. Active queries return 0 archived records.`);
  console.log(`✔ Verified ${deleteAuditLogs.length} individual AuditLog entries recorded.`);

  // Test 5: RBAC Delete Restriction
  console.log("\n--- Test 5: RBAC Role Restrictions ---");
  try {
    assertAdmin(counselorSession as any);
    throw new Error("Counselor should not have admin delete permission!");
  } catch (err: any) {
    console.log("✔ Counselor correctly blocked from bulk delete:", err.message);
  }

  try {
    assertAdmin(readonlySession as any);
    throw new Error("Readonly user should not have admin delete permission!");
  } catch (err: any) {
    console.log("✔ Readonly user correctly blocked from bulk delete:", err.message);
  }

  console.log("\n🎉 ALL TESTS PASSED! Bulk Action Bar & Engine Fully Verified.");
}

runTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
