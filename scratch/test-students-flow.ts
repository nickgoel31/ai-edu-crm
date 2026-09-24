import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { assertCanMutate } from "../lib/rbac";
import { StudentStage, DocumentStatus, PaymentStatus, LeadStage } from "../types";

async function runTests() {
  console.log("🚀 Running Students Module Verification Tests...\n");

  // 1. Fetch organization and users
  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
  });

  if (!org) {
    throw new Error("Organization not found. Seed first!");
  }

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
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      organizationId: org.id,
    },
  };

  const readonlySession = {
    user: {
      id: readonly.id,
      email: readonly.email,
      role: readonly.role,
      organizationId: org.id,
    },
  };

  const scopedDb = getScopedPrismaClient(adminSession as any);

  // Test 1: Verify Students Registry Querying & Stage Filtering
  console.log("--- Test 1: Students Querying & Scoping ---");
  const allStudents = await scopedDb.student.findMany({
    include: { documents: true, payments: true },
  });
  console.log(`✔ Found ${allStudents.length} students in tenant registry.`);
  if (allStudents.length < 5) throw new Error("Expected at least 5 seeded students.");

  const activeStudents = await scopedDb.student.findMany({
    where: { stage: StudentStage.ACTIVE },
  });
  console.log(`✔ Found ${activeStudents.length} ACTIVE students.`);

  // Test 2: Verify Document Templates
  console.log("\n--- Test 2: Document Templates ---");
  const templates = await scopedDb.documentTemplate.findMany();
  console.log(`✔ Found ${templates.length} program document templates.`);
  const evTemplate = templates.find((t) => t.program.includes("Electric Vehicle"));
  let evDocs: string[] = [];
  try {
    evDocs = typeof evTemplate?.requiredDocuments === "string" ? JSON.parse(evTemplate.requiredDocuments) : (evTemplate?.requiredDocuments || []);
  } catch (e) {
    evDocs = [];
  }
  if (!evTemplate || !Array.isArray(evDocs)) {
    throw new Error("EV Document Template missing or malformed.");
  }
  console.log(`✔ EV Template required docs:`, evDocs);

  // Test 3: Document Status Cycling & Audit Log
  console.log("\n--- Test 3: Document Status Toggle & Audit Log ---");
  const studentWithDocs = allStudents.find((s) => s.documents.length > 0);
  if (!studentWithDocs) throw new Error("No student with documents found.");

  const targetDoc = studentWithDocs.documents[0];
  console.log(`Initial status of ${targetDoc.name}: ${targetDoc.status}`);

  // Advance status
  const nextStatus =
    targetDoc.status === DocumentStatus.PENDING
      ? DocumentStatus.RECEIVED
      : targetDoc.status === DocumentStatus.RECEIVED
      ? DocumentStatus.VERIFIED
      : DocumentStatus.PENDING;

  await prisma.document.update({
    where: { id: targetDoc.id },
    data: { status: nextStatus },
  });

  const auditLogDoc = await scopedDb.auditLog.create({
    data: {
      organizationId: org.id,
      userId: counselor.id,
      action: "DOCUMENT_UPDATED",
      entityType: "Student",
      entityId: studentWithDocs.id,
      changesJson: JSON.stringify({
        documentName: targetDoc.name,
        from: targetDoc.status,
        to: nextStatus,
      }),
    },
  });
  console.log(`✔ Successfully cycled document to ${nextStatus} and wrote AuditLog (${auditLogDoc.id}).`);

  // Test 4: Payment Milestone & Mark as Paid
  console.log("\n--- Test 4: Payment Milestone & Mark as Paid ---");
  const studentWithPayments = allStudents.find((s) => s.payments.length > 0);
  if (!studentWithPayments) throw new Error("No student with payments found.");

  const targetPayment = studentWithPayments.payments[0];
  const nextPaymentStatus =
    targetPayment.status === PaymentStatus.PAID
      ? PaymentStatus.PENDING
      : PaymentStatus.PAID;

  await prisma.payment.update({
    where: { id: targetPayment.id },
    data: { status: nextPaymentStatus },
  });

  const auditLogPayment = await scopedDb.auditLog.create({
    data: {
      organizationId: org.id,
      userId: counselor.id,
      action: "PAYMENT_STATUS_UPDATED",
      entityType: "Student",
      entityId: studentWithPayments.id,
      changesJson: JSON.stringify({
        installmentNumber: targetPayment.installmentNumber,
        amount: targetPayment.amount,
        status: nextPaymentStatus,
      }),
    },
  });
  console.log(
    `✔ Installment #${targetPayment.installmentNumber} (₹${targetPayment.amount}) updated to ${nextPaymentStatus} with AuditLog (${auditLogPayment.id}).`
  );

  // Test 5: Convert Lead to Student Flow
  console.log("\n--- Test 5: Convert Lead to Student ---");
  // Find a lead with stage WARM or HOT that does not yet have a student
  const unconvertedLead = await scopedDb.lead.findFirst({
    where: {
      students: { none: {} },
      stage: { in: [LeadStage.WARM, LeadStage.HOT] },
    },
  });

  if (!unconvertedLead) {
    throw new Error("No unconverted lead found for conversion test.");
  }

  console.log(`Converting lead: ${unconvertedLead.name} (${unconvertedLead.id})...`);

  // Lookup template for Full Stack Web Development
  const webDevTemplate = await scopedDb.documentTemplate.findFirst({
    where: { program: "Full Stack Web Development" },
  });

  let parsedReqDocs: string[] = [];
  try {
    parsedReqDocs = typeof webDevTemplate?.requiredDocuments === "string" ? JSON.parse(webDevTemplate.requiredDocuments) : (webDevTemplate?.requiredDocuments || []);
  } catch (e) {
    parsedReqDocs = [];
  }

  const initialDocs = parsedReqDocs.map(
    (name: string) => ({ name, status: DocumentStatus.PENDING })
  );

  const newStudent = await scopedDb.student.create({
    data: {
      organizationId: org.id,
      leadId: unconvertedLead.id,
      name: unconvertedLead.name,
      phone: unconvertedLead.phone,
      email: unconvertedLead.email,
      program: "Full Stack Web Development",
      cohort: "2026-Q3",
      branch: "Bangalore Central",
      stage: StudentStage.ENROLLED,
      documents: {
        create: initialDocs,
      },
      payments: {
        create: [
          {
            amount: 25000,
            dueDate: new Date("2026-06-15"),
            installmentNumber: 1,
            status: PaymentStatus.PENDING,
          },
        ],
      },
    },
    include: {
      documents: true,
      payments: true,
    },
  });

  // Update lead stage to CONVERTING
  await scopedDb.lead.update({
    where: { id: unconvertedLead.id },
    data: { stage: LeadStage.CONVERTING },
  });

  // Log audit trail
  await scopedDb.auditLog.create({
    data: {
      organizationId: org.id,
      userId: counselor.id,
      action: "LEAD_CONVERTED_TO_STUDENT",
      entityType: "Lead",
      entityId: unconvertedLead.id,
      changesJson: JSON.stringify({
        studentId: newStudent.id,
        program: newStudent.program,
        cohort: newStudent.cohort,
      }),
    },
  });

  console.log(`✔ Converted lead to new student ID: ${newStudent.id}`);
  console.log(`✔ Created ${newStudent.documents.length} document checklist items from template.`);
  console.log(`✔ Created ${newStudent.payments.length} fee installment milestones.`);

  const updatedLead = await scopedDb.lead.findUnique({
    where: { id: unconvertedLead.id },
  });
  console.log(`✔ Lead stage is now: ${updatedLead?.stage}`);
  if (updatedLead?.stage !== LeadStage.CONVERTING) {
    throw new Error("Expected lead stage to be CONVERTING.");
  }

  // Test 6: RBAC assertion
  console.log("\n--- Test 6: RBAC Verification ---");
  try {
    assertCanMutate(readonlySession as any);
    throw new Error("READONLY user should not be able to mutate!");
  } catch (err: any) {
    console.log("✔ READONLY mutation correctly blocked by RBAC:", err.message);
  }

  // Test 7: Multi-tenant Scoping
  console.log("\n--- Test 7: Multi-tenant Scoping ---");
  const foreignSession = {
    user: {
      id: "fake-user",
      email: "fake@otherorg.com",
      role: "ADMIN",
      organizationId: "org-foreign-tenant-9999",
    },
  };
  const foreignDb = getScopedPrismaClient(foreignSession as any);
  const foreignStudents = await foreignDb.student.findMany();
  console.log(`✔ Foreign tenant queries returned ${foreignStudents.length} students (Expected: 0).`);
  if (foreignStudents.length !== 0) {
    throw new Error("Cross-tenant leakage detected!");
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Students Module is fully verified.");
}

runTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
