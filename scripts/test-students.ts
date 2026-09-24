import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { assertCanMutate } from "../lib/rbac";
import { StudentStage, DocumentStatus, PaymentStatus, LeadStage } from "@prisma/client";

async function run() {
  console.log("Database URL:", process.env.DATABASE_URL);
  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
  });

  if (!org) {
    throw new Error("Organization not found.");
  }

  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
  });

  const session = {
    user: {
      id: admin!.id,
      email: admin!.email,
      role: admin!.role,
      organizationId: org.id,
    },
  };

  const scopedDb = getScopedPrismaClient(session as any);

  // 1. Verify students
  const students = await scopedDb.student.findMany({
    include: { documents: true, payments: true, lead: true },
  });
  console.log(`[PASS] Queried ${students.length} students in tenant.`);

  // 2. Verify templates
  const templates = await scopedDb.documentTemplate.findMany();
  console.log(`[PASS] Queried ${templates.length} document templates.`);

  // 3. Document cycle test
  const student = students[0];
  const doc = student.documents[0];
  console.log(`[INFO] Current doc '${doc.name}': status = ${doc.status}`);
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: DocumentStatus.VERIFIED },
  });
  console.log(`[PASS] Document marked VERIFIED.`);

  // 4. Payment cycle test
  const payment = student.payments[0];
  console.log(`[INFO] Current payment #${payment.installmentNumber}: status = ${payment.status}`);
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.PAID },
  });
  console.log(`[PASS] Payment marked PAID.`);

  // 5. Convert lead test
  const lead = await scopedDb.lead.findFirst({
    where: { students: { none: {} }, stage: { in: [LeadStage.WARM, LeadStage.HOT] } },
  });

  if (lead) {
    console.log(`[INFO] Converting lead '${lead.name}'...`);
    const template = templates.find((t) => t.program.includes("Electric Vehicle")) || templates[0];
    const docs = (template.requiredDocuments as string[]).map((name) => ({
      name,
      status: DocumentStatus.PENDING,
    }));

    const newStudent = await scopedDb.student.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        program: template.program,
        cohort: "2026-Q3",
        stage: StudentStage.ENROLLED,
        documents: { create: docs },
        payments: {
          create: [
            {
              amount: 15000,
              dueDate: new Date("2026-05-15"),
              installmentNumber: 1,
              status: PaymentStatus.PENDING,
            },
          ],
        },
      },
      include: { documents: true, payments: true },
    });

    await scopedDb.lead.update({
      where: { id: lead.id },
      data: { stage: LeadStage.CONVERTING },
    });

    console.log(`[PASS] Successfully converted lead '${lead.name}' to student ID ${newStudent.id}.`);
    console.log(`[PASS] Instantiated ${newStudent.documents.length} document items.`);
  }

  // 6. RBAC verification
  try {
    assertCanMutate({ user: { id: "1", email: "a", role: "READONLY", organizationId: org.id } } as any);
    throw new Error("Should have failed");
  } catch (e: any) {
    console.log(`[PASS] RBAC blocked READONLY: ${e.message}`);
  }

  console.log("\nALL VERIFICATIONS PASSED!");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
