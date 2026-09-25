import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getErpIntegration,
  DEFAULT_FIELD_MAPPING,
  AVAILABLE_CRM_FIELDS,
  syncStudentToErp,
  maskErpConfigForClient,
  resolveErpAuthHeaderForStorage,
} from "@/lib/erp-sync";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);

    const { integration, config } = await getErpIntegration(orgId);

    // Fetch recent sync logs
    const recentLogs = await scopedDb.erpSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Fetch a sample student for live payload preview
    const sampleStudent = await scopedDb.student.findFirst({
      include: { payments: true, documents: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      integration: {
        id: integration.id,
        isEnabled: integration.isEnabled,
        webhookSecret: integration.webhookSecret,
        lastSyncAt: integration.lastSyncAt,
        lastSyncStatus: integration.lastSyncStatus,
        lastError: integration.lastError,
        config: maskErpConfigForClient(config),
      },
      availableFields: AVAILABLE_CRM_FIELDS,
      defaultMapping: DEFAULT_FIELD_MAPPING,
      recentLogs,
      sampleStudent: sampleStudent || {
        id: "sample_std_101",
        name: "Aarav Sharma",
        email: "aarav.sharma@example.edu",
        phone: "+91 98200 12345",
        program: "Full Stack AI Engineering",
        cohort: "Batch-2026-Q1",
        branch: "Main Campus",
        stage: "ENROLLED",
        externalId: "ERP-2026-9901",
        createdAt: new Date().toISOString(),
        payments: [{ amount: 45000, status: "PAID" }],
      },
    });
  } catch (error: any) {
    console.error("Error fetching ERP integration settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch ERP settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);

    const body = await req.json();
    const {
      isEnabled,
      endpointUrl,
      authHeader,
      externalIdField,
      fieldMapping,
      regenerateToken,
    } = body;

    const { integration, config } = await getErpIntegration(orgId);

    let rawStoredConfig: any = {};
    try {
      rawStoredConfig = typeof integration.config === "string" ? JSON.parse(integration.config) : integration.config || {};
    } catch {
      rawStoredConfig = {};
    }

    const updatedConfig = {
      ...config,
      ...(endpointUrl !== undefined ? { endpointUrl: endpointUrl.trim() } : {}),
      authHeader: resolveErpAuthHeaderForStorage(rawStoredConfig.authHeader, authHeader),
      ...(externalIdField !== undefined ? { externalIdField: externalIdField.trim() || "externalId" } : {}),
      ...(fieldMapping !== undefined ? { fieldMapping } : {}),
    };

    let newSecret = integration.webhookSecret;
    if (regenerateToken) {
      newSecret = `erp_tok_${crypto.randomBytes(18).toString("base64url")}`;
    }

    const updatedIntegration = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        ...(isEnabled !== undefined ? { isEnabled: Boolean(isEnabled) } : {}),
        webhookSecret: newSecret,
        config: JSON.stringify(updatedConfig),
      },
    });

    // Audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action: "ERP_INTEGRATION_UPDATED",
        entityType: "Integration",
        entityId: updatedIntegration.id,
        changesJson: JSON.stringify({
          isEnabled,
          endpointUrl,
          externalIdField,
          fieldMappingKeysCount: fieldMapping ? Object.keys(fieldMapping).length : undefined,
          tokenRegenerated: Boolean(regenerateToken),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      integration: {
        ...updatedIntegration,
        config: maskErpConfigForClient(updatedConfig),
      },
    });
  } catch (error: any) {
    console.error("Error updating ERP integration settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update ERP integration settings." },
      { status: 400 }
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
    assertCanMutate(session);
    const orgId = session.user.organizationId;
    const scopedDb = getScopedPrismaClient(session);

    const body = await req.json().catch(() => ({}));
    let targetStudentId = body?.studentId;

    if (!targetStudentId) {
      const student = await scopedDb.student.findFirst({
        where: { stage: "ENROLLED" },
        orderBy: { createdAt: "desc" },
      });

      if (!student) {
        const anyStudent = await scopedDb.student.findFirst({
          orderBy: { createdAt: "desc" },
        });

        if (!anyStudent) {
          return NextResponse.json(
            { error: "No student records found in organization to test ERP push." },
            { status: 404 }
          );
        }
        targetStudentId = anyStudent.id;
      } else {
        targetStudentId = student.id;
      }
    }

    const testResult = await syncStudentToErp({
      studentId: targetStudentId,
      organizationId: orgId,
      isTest: true,
    });

    return NextResponse.json({
      success: testResult.synced,
      testResult,
    });
  } catch (error: any) {
    console.error("Error running ERP test push:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute ERP outbound test push." },
      { status: 400 }
    );
  }
}
