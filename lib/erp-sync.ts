import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ErpSyncDirection,
  ErpSyncStatus,
  IntegrationType,
  PaymentStatus,
  StudentStage,
} from "@/types";
import { encryptField, decryptField, SECRET_SET_SENTINEL } from "@/lib/crypto";

function generateWebhookToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(18).toString("base64url")}`;
}

export interface ErpIntegrationConfig {
  endpointUrl: string;
  authHeader?: string;
  externalIdField?: string;
  fieldMapping?: Record<string, string>;
  syncOnEnrolled?: boolean;
}

export const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  id: "crm_student_id",
  externalId: "student_id",
  name: "student_name",
  email: "email_address",
  phone: "contact_number",
  program: "enrolled_program",
  cohort: "batch_cohort",
  branch: "campus_branch",
  stage: "enrollment_status",
  createdAt: "crm_enrolled_at",
  totalPaid: "total_fee_paid",
  totalDue: "total_fee_due",
};

export const AVAILABLE_CRM_FIELDS = [
  { key: "id", label: "CRM Student ID", type: "string" },
  { key: "externalId", label: "External ERP ID", type: "string" },
  { key: "name", label: "Student Full Name", type: "string" },
  { key: "email", label: "Email Address", type: "string" },
  { key: "phone", label: "Phone Number", type: "string" },
  { key: "program", label: "Enrolled Program / Course", type: "string" },
  { key: "cohort", label: "Cohort / Batch", type: "string" },
  { key: "branch", label: "Branch / Campus", type: "string" },
  { key: "stage", label: "Current Stage (ENROLLED)", type: "string" },
  { key: "createdAt", label: "Enrollment Date & Time", type: "date" },
  { key: "totalPaid", label: "Total Fee Paid (₹)", type: "number" },
  { key: "totalDue", label: "Total Fee Due (₹)", type: "number" },
  { key: "leadId", label: "Originating Lead ID", type: "string" },
];

/**
 * Retrieve or auto-provision the ERP integration for an organization
 */
export async function getErpIntegration(organizationId: string) {
  let integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      type: IntegrationType.ERP,
    },
  });

  if (!integration) {
    // Generate a default webhook secret/token for inbound sync
    const token = generateWebhookToken("erp_tok");
    integration = await prisma.integration.create({
      data: {
        organizationId,
        type: IntegrationType.ERP,
        isEnabled: false,
        webhookSecret: token,
        config: JSON.stringify({
          endpointUrl: "",
          authHeader: "",
          externalIdField: "externalId",
          fieldMapping: DEFAULT_FIELD_MAPPING,
          syncOnEnrolled: true,
        }),
      },
    });
  }

  let rawConfig: any = {};
  try {
    rawConfig = typeof integration.config === "string" ? JSON.parse(integration.config) : integration.config || {};
  } catch {
    rawConfig = {};
  }

  // authHeader carries an outbound Authorization value (e.g. "Bearer sk_live_...")
  // for the org's ERP API — encrypted at rest via lib/crypto.ts, same as agent
  // secrets. decryptField transparently passes through legacy plaintext rows.
  const config: ErpIntegrationConfig = {
    endpointUrl: rawConfig.endpointUrl || "",
    authHeader: decryptField(rawConfig.authHeader) || "",
    externalIdField: rawConfig.externalIdField || "externalId",
    fieldMapping: rawConfig.fieldMapping || DEFAULT_FIELD_MAPPING,
    syncOnEnrolled: rawConfig.syncOnEnrolled !== false,
  };

  return {
    integration,
    config,
  };
}

/** Config safe to send to the client: authHeader is replaced with a sentinel if set. */
export function maskErpConfigForClient(config: ErpIntegrationConfig): ErpIntegrationConfig {
  return {
    ...config,
    authHeader: config.authHeader ? SECRET_SET_SENTINEL : "",
  };
}

/**
 * Resolves the authHeader value to persist: encrypts a freshly-typed value,
 * or keeps the existing raw (still-encrypted) stored value when the client
 * sent the sentinel back unchanged or nothing at all. `rawStoredAuthHeader`
 * must come from the *raw* integration.config JSON, not the decrypted
 * config `getErpIntegration` returns.
 */
export function resolveErpAuthHeaderForStorage(
  rawStoredAuthHeader: string | undefined,
  incoming: string | undefined
): string | undefined {
  if (incoming === undefined || incoming === SECRET_SET_SENTINEL || incoming.trim() === "") {
    return rawStoredAuthHeader;
  }
  return encryptField(incoming.trim()) || undefined;
}

/**
 * Transforms a CRM Student record according to the organization's ERP field mapping
 */
export function transformStudentForErp(student: any, fieldMapping: Record<string, string>) {
  const payments = student.payments || [];
  const totalPaid = payments
    .filter((p: any) => p.status === PaymentStatus.PAID)
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const totalDue = payments
    .filter((p: any) => p.status !== PaymentStatus.PAID)
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const dataContext: Record<string, any> = {
    id: student.id,
    externalId: student.externalId || "",
    name: student.name,
    email: student.email,
    phone: student.phone,
    program: student.program,
    cohort: student.cohort,
    branch: student.branch || "",
    stage: student.stage,
    createdAt: student.createdAt instanceof Date ? student.createdAt.toISOString() : student.createdAt,
    totalPaid,
    totalDue,
    leadId: student.leadId || "",
  };

  const mappedPayload: Record<string, any> = {};

  for (const [crmField, erpKey] of Object.entries(fieldMapping)) {
    if (!erpKey || !erpKey.trim()) continue;
    mappedPayload[erpKey.trim()] = dataContext[crmField] !== undefined ? dataContext[crmField] : null;
  }

  // Include metadata context
  mappedPayload._syncMetadata = {
    source: "AI_EDU_CRM",
    event: "STUDENT_ENROLLED",
    timestamp: new Date().toISOString(),
    organizationId: student.organizationId,
  };

  return mappedPayload;
}

/**
 * Outbound: Dispatches an enrolled student to the client's ERP endpoint
 */
export async function syncStudentToErp({
  studentId,
  organizationId,
  isTest = false,
}: {
  studentId: string;
  organizationId: string;
  isTest?: boolean;
}) {
  const { integration, config } = await getErpIntegration(organizationId);

  if (!integration.isEnabled && !isTest) {
    return {
      synced: false,
      reason: "ERP integration is disabled.",
    };
  }

  if (!config.endpointUrl || !config.endpointUrl.trim()) {
    return {
      synced: false,
      reason: "No ERP webhook endpoint URL configured.",
    };
  }

  // Query student details
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      payments: true,
      documents: true,
      lead: true,
    },
  });

  if (!student) {
    throw new Error(`Student ${studentId} not found for ERP sync.`);
  }

  const payload = transformStudentForErp(student, config.fieldMapping || DEFAULT_FIELD_MAPPING);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AI-Edu-CRM-ErpSync/1.0",
  };

  if (config.authHeader && config.authHeader.trim()) {
    headers["Authorization"] = config.authHeader.trim();
  }

  let responseData: any = null;
  let responseStatus = 0;
  let errorMessage: string | null = null;
  let syncSuccess = false;

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(config.endpointUrl.trim(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    responseStatus = res.status;

    const text = await res.text();
    try {
      responseData = JSON.parse(text);
    } catch {
      responseData = { rawResponse: text };
    }

    if (res.ok) {
      syncSuccess = true;

      // Check if ERP returned an external ID to link back to Student
      const returnedExternalId =
        responseData?.externalId ||
        responseData?.student_id ||
        responseData?.studentId ||
        responseData?.id;

      if (returnedExternalId && typeof returnedExternalId === "string" && !student.externalId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { externalId: returnedExternalId.trim() },
        });
      }
    } else {
      errorMessage = `ERP returned HTTP ${res.status}: ${JSON.stringify(responseData)}`;
    }
  } catch (err: any) {
    errorMessage = err?.message || "Failed to reach ERP endpoint.";
  }

  // Record audit log in ErpSyncLog
  const syncLog = await prisma.erpSyncLog.create({
    data: {
      organizationId,
      direction: ErpSyncDirection.OUTBOUND,
      action: isTest ? "TEST_OUTBOUND_PUSH" : "STUDENT_ENROLLED_PUSH",
      status: syncSuccess ? ErpSyncStatus.SUCCESS : ErpSyncStatus.FAILED,
      entityId: student.id,
      payload: payload ? JSON.stringify(payload) : null,
      response: responseData ? JSON.stringify(responseData) : null,
      errorMessage,
    },
  });

  // Update Integration status
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: syncSuccess ? "SUCCESS" : "FAILED",
      lastError: errorMessage,
    },
  });

  return {
    synced: syncSuccess,
    syncLogId: syncLog.id,
    status: responseStatus,
    durationMs: Date.now() - startTime,
    payload,
    response: responseData,
    error: errorMessage,
  };
}

/**
 * Inbound: Processes fee/attendance/exam updates received from client's ERP
 */
export async function processInboundErpUpdate({
  organizationId,
  payload,
}: {
  organizationId: string;
  payload: any;
}) {
  const { integration, config } = await getErpIntegration(organizationId);

  const extKey = config.externalIdField || "externalId";
  const rawIdentifier =
    payload[extKey] ||
    payload.externalId ||
    payload.student_id ||
    payload.studentId ||
    payload.rollNumber ||
    payload.rollNo ||
    payload.id ||
    payload.crm_student_id;

  if (!rawIdentifier) {
    const errorMsg = `Inbound payload missing required student identifier (expected field: '${extKey}' or 'externalId').`;
    await prisma.erpSyncLog.create({
      data: {
        organizationId,
        direction: ErpSyncDirection.INBOUND,
        action: "INBOUND_UPDATE_FAILED",
        status: ErpSyncStatus.FAILED,
        payload: payload ? JSON.stringify(payload) : null,
        errorMessage: errorMsg,
      },
    });

    throw new Error(errorMsg);
  }

  const strIdentifier = String(rawIdentifier).trim();

  // Look up student by externalId, id, phone, or email within organization
  const student = await prisma.student.findFirst({
    where: {
      organizationId,
      OR: [
        { externalId: strIdentifier },
        { id: strIdentifier },
        { email: strIdentifier },
        { phone: strIdentifier },
      ],
    },
    include: {
      payments: true,
    },
  });

  if (!student) {
    const errorMsg = `No student found matching external identifier '${strIdentifier}' in this organization.`;
    await prisma.erpSyncLog.create({
      data: {
        organizationId,
        direction: ErpSyncDirection.INBOUND,
        action: "INBOUND_STUDENT_NOT_FOUND",
        status: ErpSyncStatus.FAILED,
        entityId: strIdentifier,
        payload: payload ? JSON.stringify(payload) : null,
        errorMessage: errorMsg,
      },
    });

    throw new Error(errorMsg);
  }

  const updatesApplied: string[] = [];
  const updatedData: any = {};

  // 1. Fee / Payment update
  const feeData = payload.fee || payload.payment || payload.fees;
  if (feeData) {
    const installmentNumber = Number(feeData.installmentNumber || feeData.installment || 1);
    const amount = feeData.amount !== undefined ? Number(feeData.amount) : undefined;
    const statusRaw = feeData.status?.toString().toUpperCase();
    const status =
      statusRaw === "PAID"
        ? PaymentStatus.PAID
        : statusRaw === "OVERDUE"
        ? PaymentStatus.OVERDUE
        : PaymentStatus.PENDING;

    // Find existing installment or create
    const existingPayment = student.payments.find(
      (p) => p.installmentNumber === installmentNumber
    );

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status,
          ...(amount !== undefined ? { amount } : {}),
        },
      });
      updatesApplied.push(`Payment #${installmentNumber} updated to ${status}`);
    } else {
      await prisma.payment.create({
        data: {
          studentId: student.id,
          installmentNumber,
          amount: amount || 0,
          status,
          dueDate: feeData.dueDate ? new Date(feeData.dueDate) : new Date(),
        },
      });
      updatesApplied.push(`Payment #${installmentNumber} created with status ${status}`);
    }
  }

  // 2. Attendance update
  const attendanceData = payload.attendance;
  if (attendanceData) {
    let currentAttendance = {};
    try {
      currentAttendance = typeof student.attendance === "string" ? JSON.parse(student.attendance) : (student.attendance || {});
    } catch {
      currentAttendance = {};
    }
    const mergedAttendance = {
      ...currentAttendance,
      ...attendanceData,
      lastSyncedAt: new Date().toISOString(),
    };
    updatedData.attendance = JSON.stringify(mergedAttendance);
    updatesApplied.push("Attendance statistics updated");
  }

  // 3. Exam Results update
  const examData = payload.examResults || payload.examResult || payload.exams || payload.marks;
  if (examData) {
    let mergedExams: any[] = [];
    if (Array.isArray(examData)) {
      mergedExams = examData;
    } else if (typeof examData === "object") {
      let existingExams: any[] = [];
      try {
        existingExams = typeof student.examResults === "string" ? JSON.parse(student.examResults) : (Array.isArray(student.examResults) ? student.examResults : []);
      } catch {
        existingExams = [];
      }
      mergedExams = [...existingExams, examData];
    }
    updatedData.examResults = JSON.stringify(mergedExams);
    updatesApplied.push("Exam performance records updated");
  }

  // 4. Update externalId if provided and not yet set
  if (!student.externalId && (payload.externalId || payload.student_id)) {
    updatedData.externalId = String(payload.externalId || payload.student_id).trim();
    updatesApplied.push(`Assigned external ID: ${updatedData.externalId}`);
  }

  // 5. Stage update if specified
  if (payload.stage && Object.values(StudentStage).includes(payload.stage as any)) {
    updatedData.stage = payload.stage;
    updatesApplied.push(`Stage updated to ${payload.stage}`);
  }

  if (Object.keys(updatedData).length > 0) {
    await prisma.student.update({
      where: { id: student.id },
      data: updatedData,
    });
  }

  // Create Inbound ErpSyncLog
  const actionSummary = updatesApplied.join(", ") || "INBOUND_SYNC_NOOP";
  const syncLog = await prisma.erpSyncLog.create({
    data: {
      organizationId,
      direction: ErpSyncDirection.INBOUND,
      action: actionSummary,
      status: ErpSyncStatus.SUCCESS,
      entityId: student.id,
      payload: payload ? JSON.stringify(payload) : null,
      response: JSON.stringify({
        success: true,
        studentId: student.id,
        externalId: student.externalId || updatedData.externalId,
        updatesApplied,
      }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      entityType: "Student",
      entityId: student.id,
      action: "ERP_INBOUND_UPDATE",
      changesJson: JSON.stringify({
        updatesApplied,
        receivedPayload: payload,
      }),
    },
  });

  // Update integration last sync
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: "SUCCESS",
      lastError: null,
    },
  });

  return {
    success: true,
    studentId: student.id,
    studentName: student.name,
    updatesApplied,
    syncLogId: syncLog.id,
  };
}
