import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import http from "http";
import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { assertCanMutate } from "../lib/rbac";
import {
  getErpIntegration,
  transformStudentForErp,
  syncStudentToErp,
  processInboundErpUpdate,
  DEFAULT_FIELD_MAPPING,
} from "../lib/erp-sync";
import { PaymentStatus, StudentStage } from "@prisma/client";

async function run() {
  console.log("Starting Enterprise ERP Sync Verification Suite...\n");

  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
  });

  if (!org) {
    throw new Error("Apex Tech Academy organization not found.");
  }

  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
  });

  const counselor = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "COUNSELOR" },
  });

  const readonlyUser = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "READONLY" },
  });

  if (!admin || !counselor || !readonlyUser) {
    throw new Error("Required users (ADMIN, COUNSELOR, READONLY) not found.");
  }

  const session = {
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      organizationId: org.id,
    },
  };

  const scopedDb = getScopedPrismaClient(session as any);

  // 1. Verify / provision ERP integration
  console.log("1. Testing ERP Integration retrieval and configuration...");
  const { integration, config } = await getErpIntegration(org.id);
  console.log(`[PASS] ERP Integration retrieved (ID: ${integration.id}). Token: ${integration.webhookSecret}`);

  // 2. Test Field Mapping translation
  console.log("2. Testing Field Mapping translation engine...");
  const sampleStudent = await scopedDb.student.findFirst({
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });

  if (!sampleStudent) {
    throw new Error("No students found to test field mapping.");
  }

  const customMapping = {
    name: "student_full_name",
    email: "student_primary_email",
    phone: "contact_cell",
    program: "target_degree_code",
    cohort: "academic_intake",
    stage: "lifecycle_status",
    totalPaid: "realized_tuition",
  };

  const transformed = transformStudentForErp(sampleStudent, customMapping);
  console.log(`   Transformed student '${sampleStudent.name}':`, transformed);

  if (
    transformed.student_full_name !== sampleStudent.name ||
    transformed.student_primary_email !== sampleStudent.email ||
    transformed.target_degree_code !== sampleStudent.program
  ) {
    throw new Error("Field mapping did not produce expected target schema keys.");
  }
  console.log("[PASS] Field mapping translation validated successfully.\n");

  // 3. Test Outbound Push to Mock ERP Server
  console.log("3. Testing Outbound Push on Student Enrollment...");
  const MOCK_PORT = 3099;
  let receivedPayload: any = null;
  let receivedHeaders: any = null;

  const mockErpServer = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        receivedPayload = JSON.parse(body);
      } catch {
        receivedPayload = body;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          status: "ENROLLED_IN_CAMPUS_ERP",
          externalId: "ERP-APEX-998811",
          registeredAt: new Date().toISOString(),
        })
      );
    });
  });

  await new Promise<void>((resolve) => mockErpServer.listen(MOCK_PORT, resolve));
  console.log(`   Mock ERP Webhook Server listening on http://localhost:${MOCK_PORT}`);

  try {
    // Save ERP configuration to point to mock server
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        isEnabled: true,
        config: {
          endpointUrl: `http://localhost:${MOCK_PORT}/api/v1/admissions/sync`,
          authHeader: "Bearer test_bearer_token_apex_erp",
          externalIdField: "externalId",
          fieldMapping: customMapping,
          syncOnEnrolled: true,
        },
      },
    });

    // Pick a student without externalId for testing
    let testStudent = await scopedDb.student.findFirst({
      where: { externalId: null },
      include: { payments: true },
    });

    if (!testStudent) {
      testStudent = sampleStudent;
      await prisma.student.update({
        where: { id: testStudent.id },
        data: { externalId: null },
      });
    }

    console.log(`   Dispatching outbound push for student '${testStudent.name}' (ID: ${testStudent.id})...`);
    const pushResult = await syncStudentToErp({
      studentId: testStudent.id,
      organizationId: org.id,
    });

    console.log(`[PASS] Outbound Push Result:`, {
      synced: pushResult.synced,
      durationMs: pushResult.durationMs,
      response: pushResult.response,
    });

    if (!pushResult.synced) {
      throw new Error("Outbound sync failed: " + pushResult.error);
    }

    if (receivedHeaders["authorization"] !== "Bearer test_bearer_token_apex_erp") {
      throw new Error("Authorization header was not transmitted to ERP endpoint.");
    }

    if (receivedPayload.student_full_name !== testStudent.name) {
      throw new Error("Received payload in mock ERP does not match mapped student name.");
    }

    // Verify externalId was saved to Student
    const reloadedStudent = await scopedDb.student.findUnique({
      where: { id: testStudent.id },
    });

    if (reloadedStudent?.externalId !== "ERP-APEX-998811") {
      throw new Error(`Expected externalId 'ERP-APEX-998811' but found '${reloadedStudent?.externalId}'`);
    }
    console.log(`[PASS] Student '${testStudent.name}' updated with externalId: ${reloadedStudent.externalId}\n`);
  } finally {
    mockErpServer.close();
  }

  // 4. Test Inbound Webhook Processing
  console.log("4. Testing Inbound ERP Webhook (fees, attendance, exam-results)...");
  const targetExternalId = "ERP-APEX-998811";

  // Inbound 1: Fee Installment update
  console.log("   * Testing Inbound Fee Payment update...");
  const feeResult = await processInboundErpUpdate({
    organizationId: org.id,
    payload: {
      externalId: targetExternalId,
      fee: {
        installmentNumber: 1,
        amount: 28000,
        status: "PAID",
      },
    },
  });
  console.log(`[PASS] Fee update result:`, feeResult.updatesApplied);

  const updatedStudentWithPayment = await scopedDb.student.findFirst({
    where: { externalId: targetExternalId },
    include: { payments: true },
  });

  const installment1 = updatedStudentWithPayment?.payments.find((p) => p.installmentNumber === 1);
  if (!installment1 || installment1.status !== PaymentStatus.PAID) {
    throw new Error("Installment 1 was not updated to PAID from ERP webhook.");
  }
  console.log(`[PASS] Verified Installment 1 is marked ${installment1.status} (Amount: ₹${installment1.amount}).`);

  // Inbound 2: Attendance update
  console.log("   * Testing Inbound Attendance update...");
  const attendanceResult = await processInboundErpUpdate({
    organizationId: org.id,
    payload: {
      externalId: targetExternalId,
      attendance: {
        totalClasses: 72,
        attendedClasses: 68,
        percentage: 94.4,
        lastAttendedDate: "2026-09-12",
      },
    },
  });
  console.log(`[PASS] Attendance update result:`, attendanceResult.updatesApplied);

  const updatedStudentWithAttendance = await scopedDb.student.findFirst({
    where: { externalId: targetExternalId },
  });
  const att = updatedStudentWithAttendance?.attendance as any;
  if (att?.percentage !== 94.4 || att?.totalClasses !== 72) {
    throw new Error("Attendance metrics were not correctly stored on student.");
  }
  console.log(`[PASS] Verified Student Attendance: ${att.percentage}% (${att.attendedClasses}/${att.totalClasses} classes).`);

  // Inbound 3: Exam Results update
  console.log("   * Testing Inbound Exam Results update...");
  const examResult = await processInboundErpUpdate({
    organizationId: org.id,
    payload: {
      externalId: targetExternalId,
      examResults: [
        {
          subject: "Power Inverters & DC Converters",
          score: 91,
          maxScore: 100,
          grade: "A",
          status: "PASSED",
        },
        {
          subject: "Battery Management Systems (BMS)",
          score: 96,
          maxScore: 100,
          grade: "A+",
          status: "PASSED",
        },
      ],
    },
  });
  console.log(`[PASS] Exam result update:`, examResult.updatesApplied);

  const updatedStudentWithExams = await scopedDb.student.findFirst({
    where: { externalId: targetExternalId },
  });
  const exams = updatedStudentWithExams?.examResults as any[];
  if (!Array.isArray(exams) || exams.length < 2) {
    throw new Error("Exam results were not correctly stored on student.");
  }
  console.log(`[PASS] Verified Student Exam Results: ${exams.length} subjects recorded (Top grade: ${exams[1].grade}).\n`);

  // 5. Test Sync Log Table queries
  console.log("5. Testing Non-Technical Sync Log table queries...");
  const syncLogs = await scopedDb.erpSyncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`[PASS] Found ${syncLogs.length} sync log entries in tenant.`);
  const outboundLog = syncLogs.find((l) => l.direction === "OUTBOUND");
  const inboundLog = syncLogs.find((l) => l.direction === "INBOUND");

  if (!outboundLog || !inboundLog) {
    throw new Error("Expected both OUTBOUND and INBOUND sync logs to be recorded.");
  }
  console.log(`   * Outbound log: ${outboundLog.action} [${outboundLog.status}]`);
  console.log(`   * Inbound log: ${inboundLog.action} [${inboundLog.status}]`);
  console.log("[PASS] Sync Activity Log tracking verified.\n");

  // 6. Test RBAC Enforcement
  console.log("6. Testing RBAC enforcement for READONLY users...");
  const readonlySession = {
    user: {
      id: readonlyUser.id,
      email: readonlyUser.email,
      role: readonlyUser.role,
      organizationId: org.id,
    },
  };

  let caughtRbacError = false;
  try {
    assertCanMutate(readonlySession as any);
  } catch (err: any) {
    caughtRbacError = true;
    console.log(`   [PASS] assertCanMutate caught READONLY access as expected: "${err.message}"`);
  }

  if (!caughtRbacError) {
    throw new Error("RBAC failed: READONLY user was permitted mutation access.");
  }

  console.log("\n========================================================");
  console.log("ALL ERP SYNCHRONIZATION TESTS PASSED CLEANLY!");
  console.log("========================================================\n");
}

run()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
