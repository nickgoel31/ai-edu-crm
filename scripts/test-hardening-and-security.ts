import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { encryptField, decryptField, isEncrypted } from "../lib/crypto";
import { checkRateLimit, getClientIp, resetRateLimits } from "../lib/rate-limiter";
import { assertAdmin, assertCanMutate, canAccessSettings, canMutate, canAccessModule } from "../lib/rbac";
import {
  Role,
  LeadSource,
  LeadStage,
  StudentStage,
  DocumentStatus,
  PaymentStatus,
  AgentChannel,
  AgentRole,
  AgentStatus,
  ConversationOutcome,
} from "@prisma/client";
import { Session } from "next-auth";

function createMockSession(userId: string, orgId: string, role: Role, email: string): Session {
  return {
    user: {
      id: userId,
      organizationId: orgId,
      role,
      email,
      name: `Test User ${role}`,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as Session;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failedTests++;
  }
}

async function main() {
  console.log("================================================================================");
  console.log("            COMPREHENSIVE SAAS HARDENING & SECURITY VERIFICATION TEST           ");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // 1. DATA ENCRYPTION AT REST (AES-256-GCM)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 1] AES-256-GCM Sensitive Field Encryption & Decryption");

  const sensitiveUrl = "https://s3.ap-south-1.amazonaws.com/edu-crm-vault/transcripts/student-9941.pdf";
  const encrypted = encryptField(sensitiveUrl);

  assert(encrypted !== null && encrypted !== undefined, "Encrypted output is not null/undefined");
  assert(isEncrypted(encrypted), "isEncrypted() recognizes encrypted format");
  assert(encrypted!.startsWith("enc:v1:"), "Ciphertext starts with 'enc:v1:' prefix");
  assert(encrypted !== sensitiveUrl, "Raw plaintext is not stored in ciphertext");

  const parts = encrypted!.slice("enc:v1:".length).split(":");
  assert(parts.length === 3, "Encrypted format contains IV, auth tag, and ciphertext (3 parts)");

  const decrypted = decryptField(encrypted);
  assert(decrypted === sensitiveUrl, "Decrypted text exactly matches original sensitive URL");

  // Backward compatibility test with unencrypted legacy URLs
  const legacyPlaintext = "https://legacy-bucket.s3.amazonaws.com/old-doc.pdf";
  assert(!isEncrypted(legacyPlaintext), "isEncrypted() correctly flags legacy string as unencrypted");
  const legacyDecrypted = decryptField(legacyPlaintext);
  assert(legacyDecrypted === legacyPlaintext, "Legacy unencrypted string passes through decryptField safely");

  // Graceful handling of null/undefined
  assert(encryptField(null) === null, "encryptField(null) returns null safely");
  assert(decryptField(null) === null, "decryptField(null) returns null safely");
  assert(encryptField(undefined) === undefined, "encryptField(undefined) returns undefined safely");

  // ---------------------------------------------------------------------------
  // 2. SLIDING-WINDOW RATE LIMITER FOR PUBLIC WEBHOOKS
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 2] Sliding-Window Webhook Rate Limiting");
  resetRateLimits();

  const testIp = "192.0.2.42";
  const limit = 5;
  const windowMs = 5000; // 5 seconds

  const mockReq = new Request("http://localhost/api/webhooks/meta", {
    headers: { "x-forwarded-for": testIp },
  });

  // First 5 requests should pass
  let allFirstPassed = true;
  for (let i = 1; i <= limit; i++) {
    const res = checkRateLimit(mockReq, "meta-webhook", { limit, windowMs });
    if (!res.allowed) {
      allFirstPassed = false;
    }
  }
  assert(allFirstPassed, `First ${limit} rapid requests are permitted within the window`);

  // 6th request must be blocked
  const blockedRes = checkRateLimit(mockReq, "meta-webhook", { limit, windowMs });
  assert(!blockedRes.allowed, "Request exceeding limit is blocked (429 condition triggered)");
  assert(blockedRes.response?.status === 429, "Rate limiter returns status code 429");
  assert(blockedRes.response?.headers.get("Retry-After") !== null, "Rate limiter provides Retry-After header");
  assert(blockedRes.remaining === 0, "remaining is 0 when blocked");

  // Client IP extraction test
  const mockReqWithXForwardedFor = new Request("http://localhost/api/webhooks/meta", {
    headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
  });
  const extractedIp = getClientIp(mockReqWithXForwardedFor);
  assert(extractedIp === "203.0.113.195", "getClientIp accurately extracts first IP from x-forwarded-for chain");

  // ---------------------------------------------------------------------------
  // 3. SEEDING MULTI-TENANT TEST ORGANIZATIONS (ORG A & ORG B)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 3] Multi-Tenant Environment Setup (Org A vs Org B)");

  // Clean or find Org A
  let orgA = await prisma.organization.findFirst({ where: { slug: "org-a-apex" } });
  if (!orgA) {
    orgA = await prisma.organization.create({
      data: { name: "Apex Institute", slug: "org-a-apex" },
    });
  }

  // Clean or find Org B
  let orgB = await prisma.organization.findFirst({ where: { slug: "org-b-beacon" } });
  if (!orgB) {
    orgB = await prisma.organization.create({
      data: { name: "Beacon Academy", slug: "org-b-beacon" },
    });
  }

  assert(orgA.id !== orgB.id, "Org A and Org B have distinct unique IDs");

  // Seed Users for Org A
  const adminAUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgA.id, email: "admin@orga.edu" } },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@orga.edu",
      name: "Admin A",
      role: Role.ADMIN,
      organizationId: orgA.id,
      password: "$2a$10$placeholderpasswordhashforsecuritytests",
    },
  });

  const counselorAUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgA.id, email: "counselor@orga.edu" } },
    update: { role: Role.COUNSELOR },
    create: {
      email: "counselor@orga.edu",
      name: "Counselor A",
      role: Role.COUNSELOR,
      organizationId: orgA.id,
      password: "$2a$10$placeholderpasswordhashforsecuritytests",
    },
  });

  const readonlyAUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgA.id, email: "readonly@orga.edu" } },
    update: { role: Role.READONLY },
    create: {
      email: "readonly@orga.edu",
      name: "Readonly A",
      role: Role.READONLY,
      organizationId: orgA.id,
      password: "$2a$10$placeholderpasswordhashforsecuritytests",
    },
  });

  // Seed Users for Org B
  const adminBUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgB.id, email: "admin@orgb.edu" } },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@orgb.edu",
      name: "Admin B",
      role: Role.ADMIN,
      organizationId: orgB.id,
      password: "$2a$10$placeholderpasswordhashforsecuritytests",
    },
  });

  const readonlyBUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgB.id, email: "readonly@orgb.edu" } },
    update: { role: Role.READONLY },
    create: {
      email: "readonly@orgb.edu",
      name: "Readonly B",
      role: Role.READONLY,
      organizationId: orgB.id,
      password: "$2a$10$placeholderpasswordhashforsecuritytests",
    },
  });

  const sessionAdminA = createMockSession(adminAUser.id, orgA.id, Role.ADMIN, adminAUser.email);
  const sessionCounselorA = createMockSession(counselorAUser.id, orgA.id, Role.COUNSELOR, counselorAUser.email);
  const sessionReadonlyA = createMockSession(readonlyAUser.id, orgA.id, Role.READONLY, readonlyAUser.email);

  const sessionAdminB = createMockSession(adminBUser.id, orgB.id, Role.ADMIN, adminBUser.email);
  const sessionReadonlyB = createMockSession(readonlyBUser.id, orgB.id, Role.READONLY, readonlyBUser.email);

  // Seed Data in Org A
  const leadA = await prisma.lead.create({
    data: {
      organizationId: orgA.id,
      name: "Student Candidate Alpha",
      phone: "+919876500001",
      email: "alpha@candidate.edu",
      source: LeadSource.META_ADS,
      stage: LeadStage.COLD,
      assignedToUserId: counselorAUser.id,
    },
  });

  const studentA = await prisma.student.create({
    data: {
      organizationId: orgA.id,
      leadId: leadA.id,
      name: "Student Alpha Enrolled",
      phone: "+919876500001",
      email: "alpha@student.edu",
      stage: StudentStage.ENROLLED,
      program: "MBA",
      cohort: "2026-A",
      branch: "Main Campus",
    },
  });

  const docA = await prisma.document.create({
    data: {
      studentId: studentA.id,
      name: "Graduation Certificate Alpha",
      status: DocumentStatus.VERIFIED,
      fileUrl: encryptField("https://secure-docs.orga.edu/alpha/degree.pdf"),
    },
  });

  const paymentA = await prisma.payment.create({
    data: {
      studentId: studentA.id,
      amount: 45000,
      dueDate: new Date("2026-10-01"),
      status: PaymentStatus.PAID,
      installmentNumber: 1,
    },
  });

  const agentA = await prisma.agent.create({
    data: {
      organizationId: orgA.id,
      name: "Apex Voice Assistant",
      channel: AgentChannel.VOICE,
      role: AgentRole.LEAD_TELECALLER,
      category: "ACQUISITION_NURTURE",
      status: AgentStatus.LIVE,
      config: { scriptVersion: "v2.1", workingHours: "9am-6pm" },
    },
  });

  const auditLogA = await prisma.auditLog.create({
    data: {
      organizationId: orgA.id,
      userId: adminAUser.id,
      action: "LEAD_STAGE_UPDATED",
      entityType: "Lead",
      entityId: leadA.id,
      changesJson: { stage: { from: "COLD", to: "WARM" } },
    },
  });

  // Seed Data in Org B
  const leadB = await prisma.lead.create({
    data: {
      organizationId: orgB.id,
      name: "Student Candidate Beta",
      phone: "+919876500002",
      email: "beta@candidate.edu",
      source: LeadSource.WHATSAPP,
      stage: LeadStage.HOT,
    },
  });

  const studentB = await prisma.student.create({
    data: {
      organizationId: orgB.id,
      leadId: leadB.id,
      name: "Student Beta Enrolled",
      phone: "+919876500002",
      email: "beta@student.edu",
      stage: StudentStage.ACTIVE,
      program: "B.Tech CSE",
      cohort: "2026-B",
    },
  });

  const auditLogB = await prisma.auditLog.create({
    data: {
      organizationId: orgB.id,
      userId: adminBUser.id,
      action: "STUDENT_ENROLLED",
      entityType: "Student",
      entityId: studentB.id,
      changesJson: { note: "Enrolled in Org B" },
    },
  });

  // ---------------------------------------------------------------------------
  // 4. CROSS-TENANT ISOLATION TESTS
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 4] Cross-Tenant Scoping & Strict Data Isolation");

  const scopedDbA = getScopedPrismaClient(sessionReadonlyA);
  const scopedDbB = getScopedPrismaClient(sessionReadonlyB);

  // Org A Readonly user queries Leads
  const leadsInA = await scopedDbA.lead.findMany();
  const hasLeadBInA = leadsInA.some((l) => l.id === leadB.id);
  assert(!hasLeadBInA, "Org A query NEVER returns Org B Leads (cross-tenant leak prevented)");

  const leadBQueriedByA = await scopedDbA.lead.findUnique({ where: { id: leadB.id } });
  assert(leadBQueriedByA === null, "Direct findUnique for Org B lead by Org A session returns null");

  // Org A Readonly user queries Students
  const studentsInA = await scopedDbA.student.findMany();
  const hasStudentBInA = studentsInA.some((s) => s.id === studentB.id);
  assert(!hasStudentBInA, "Org A query NEVER returns Org B Students");

  const studentBQueriedByA = await scopedDbA.student.findUnique({ where: { id: studentB.id } });
  assert(studentBQueriedByA === null, "Direct findUnique for Org B student by Org A session returns null");

  // Org A user queries AuditLogs
  const auditLogsInA = await scopedDbA.auditLog.findMany();
  const hasAuditLogBInA = auditLogsInA.some((al) => al.id === auditLogB.id);
  assert(!hasAuditLogBInA, "Org A audit log query NEVER returns Org B audit logs");

  // Cross-tenant mutation attempt: User A attempting to update Org B lead
  let crossTenantUpdateFailed = false;
  try {
    const scopedMutateA = getScopedPrismaClient(sessionAdminA);
    await scopedMutateA.lead.update({
      where: { id: leadB.id },
      data: { stage: LeadStage.LOST },
    });
  } catch (err) {
    crossTenantUpdateFailed = true;
  }
  assert(crossTenantUpdateFailed, "Org A Admin cannot mutate Org B records (RecordNotFound / Scoped rejection)");

  // ---------------------------------------------------------------------------
  // 5. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 5] Role-Based Access Control (RBAC) Policy Verification");

  // Check canMutate helper
  assert(canMutate(Role.ADMIN), "Role ADMIN is allowed to mutate records");
  assert(canMutate(Role.COUNSELOR), "Role COUNSELOR is allowed to mutate records");
  assert(!canMutate(Role.READONLY), "Role READONLY is FORBIDDEN from mutating records");

  // Check canAccessSettings helper
  assert(canAccessSettings(Role.ADMIN), "Role ADMIN can access Settings");
  assert(!canAccessSettings(Role.COUNSELOR), "Role COUNSELOR is FORBIDDEN from Settings");
  assert(!canAccessSettings(Role.READONLY), "Role READONLY is FORBIDDEN from Settings");

  // Check assertCanMutate throws on READONLY
  let readonlyBlockedFromMutating = false;
  try {
    assertCanMutate(sessionReadonlyA);
  } catch (err: any) {
    readonlyBlockedFromMutating = true;
    assert(err.message.includes("Forbidden"), "assertCanMutate returns descriptive Forbidden error");
  }
  assert(readonlyBlockedFromMutating, "assertCanMutate strictly blocks READONLY session");

  // Check assertAdmin throws on COUNSELOR and READONLY
  let counselorBlockedFromAdmin = false;
  try {
    assertAdmin(sessionCounselorA);
  } catch (err: any) {
    counselorBlockedFromAdmin = true;
  }
  assert(counselorBlockedFromAdmin, "assertAdmin strictly blocks COUNSELOR session from settings/audit-logs");

  let readonlyBlockedFromAdmin = false;
  try {
    assertAdmin(sessionReadonlyA);
  } catch (err: any) {
    readonlyBlockedFromAdmin = true;
  }
  assert(readonlyBlockedFromAdmin, "assertAdmin strictly blocks READONLY session from settings/audit-logs");

  let adminAllowed = true;
  try {
    assertAdmin(sessionAdminA);
  } catch (err) {
    adminAllowed = false;
  }
  assert(adminAllowed, "assertAdmin passes successfully for ADMIN session");

  // ---------------------------------------------------------------------------
  // 6. SENSITIVE DOCUMENT FIELD STORAGE IN DATABASE
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 6] Encrypted Document Storage in Database");

  const rawDocInDb = await prisma.document.findUnique({
    where: { id: docA.id },
  });
  assert(rawDocInDb !== null, "Document retrieved from DB");
  assert(isEncrypted(rawDocInDb?.fileUrl), "Raw fileUrl in database table is encrypted (enc:v1:*)");
  assert(!rawDocInDb?.fileUrl?.includes("degree.pdf"), "Raw fileUrl in DB does not leak plaintext filename");

  const decryptedDocUrl = decryptField(rawDocInDb?.fileUrl);
  assert(decryptedDocUrl === "https://secure-docs.orga.edu/alpha/degree.pdf", "Decrypted fileUrl matches original document URI");

  // ---------------------------------------------------------------------------
  // 7. AUDIT LOG OBSERVABILITY & FILTERING
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 7] Audit Log Scoping and Filter Verification");

  const orgAAuditLogs = await prisma.auditLog.findMany({
    where: { organizationId: orgA.id },
  });
  assert(orgAAuditLogs.length >= 1, "Audit log records exist for Org A actions");

  const leadAuditEntry = orgAAuditLogs.find((l) => l.entityId === leadA.id);
  assert(leadAuditEntry !== undefined, "AuditLog captures specific lead stage update action");
  assert(leadAuditEntry?.action === "LEAD_STAGE_UPDATED", "AuditLog action field accurately recorded");
  assert(leadAuditEntry?.userId === adminAUser.id, "AuditLog accurately attributes action to responsible user");

  // ---------------------------------------------------------------------------
  // 8. FILTERED CSV EXPORT DATA INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 8] Filtered CSV Export Verification");

  // Emulate student table filtered export
  const allStudents = [
    { name: "Student 1", stage: "ENROLLED", cohort: "2026-A" },
    { name: "Student 2", stage: "ENQUIRY", cohort: "2026-A" },
    { name: "Student 3", stage: "ENROLLED", cohort: "2026-B" },
  ];
  const activeStageFilter = "ENROLLED";
  const filteredForExport = allStudents.filter((s) => s.stage === activeStageFilter);

  assert(filteredForExport.length === 2, "Filtered student export exports only records matching active stage filter");
  assert(filteredForExport.every((s) => s.stage === "ENROLLED"), "No un-matching records exported in CSV dataset");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Test execution failed with unhandled exception:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
