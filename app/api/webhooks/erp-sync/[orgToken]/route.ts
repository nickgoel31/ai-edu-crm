import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntegrationType } from "@/types";
import { processInboundErpUpdate } from "@/lib/erp-sync";

export async function GET(
  req: Request,
  { params }: { params: { orgToken: string } }
) {
  const { orgToken } = params;

  const integration = await prisma.integration.findFirst({
    where: {
      webhookSecret: orgToken,
      type: IntegrationType.ERP,
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Invalid organization webhook token." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: "ACTIVE",
    service: "AI-Edu-CRM ERP Sync Inbound Webhook",
    organization: integration.organization.name,
    isEnabled: integration.isEnabled,
    supportedEvents: ["fee_update", "attendance_update", "exam_results_update"],
  });
}

import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(
  req: Request,
  { params }: { params: { orgToken: string } }
) {
  const { orgToken } = params;

  // Rate limit: 60 requests per minute per ERP token / IP
  const rl = await checkRateLimit(req, "webhook:erp-sync", {
    limit: 60,
    windowMs: 60000,
    identifier: orgToken,
  });
  if (!rl.allowed && rl.response) {
    return rl.response;
  }

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        webhookSecret: orgToken,
        type: IntegrationType.ERP,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid ERP webhook token." },
        { status: 401 }
      );
    }

    if (!integration.isEnabled) {
      return NextResponse.json(
        { error: "ERP synchronization is disabled for this organization." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON payload provided." },
        { status: 400 }
      );
    }

    // Support single update or batch array of updates
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        try {
          const res = await processInboundErpUpdate({
            organizationId: integration.organizationId,
            payload: item,
          });
          results.push(res);
        } catch (err: any) {
          results.push({ success: false, error: err.message, payload: item });
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: results.length,
        results,
      });
    }

    const result = await processInboundErpUpdate({
      organizationId: integration.organizationId,
      payload: body,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("ERP Inbound Webhook Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to process inbound ERP webhook update.",
      },
      { status: 400 }
    );
  }
}
