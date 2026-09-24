import { NextResponse } from "next/server";
import { LeadSource, IntegrationType } from "@/types";
import {
  resolveTenantFromWebhook,
  ingestOrUpdateLead,
} from "@/lib/lead-ingestion";
import { prisma } from "@/lib/prisma";

/**
 * Meta Lead Ads Webhook Endpoint
 * Supports verification challenge (GET) and lead receipt (POST)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken) {
    // Check if verify token matches any active Meta integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: IntegrationType.META_ADS,
        OR: [
          { webhookSecret: verifyToken },
          // Also check config verifyToken
        ],
      },
    });

    if (integration || verifyToken === "meta_verify_token") {
      return new Response(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  // Rate limit: 60 requests per minute
  const rl = checkRateLimit(req, "webhook:meta", { limit: 60, windowMs: 60000 });
  if (!rl.allowed && rl.response) {
    return rl.response;
  }

  try {
    const { organizationId, integration } = await resolveTenantFromWebhook(
      IntegrationType.META_ADS,
      req
    );

    const body = await req.json();

    let name = "Meta Lead Applicant";
    let phone = "";
    let email = "";
    let adMetadata: Record<string, any> = {};

    // 1. Standard Meta LeadGen Webhook Payload Format
    if (body?.entry && Array.isArray(body.entry)) {
      for (const entryItem of body.entry) {
        if (entryItem.changes && Array.isArray(entryItem.changes)) {
          for (const change of entryItem.changes) {
            const val = change.value;
            adMetadata = {
              ad_id: val?.ad_id,
              form_id: val?.form_id,
              leadgen_id: val?.leadgen_id,
              created_time: val?.created_time,
            };

            if (val?.field_data && Array.isArray(val.field_data)) {
              for (const field of val.field_data) {
                const fname = field.name.toLowerCase();
                const fval = field.values?.[0];

                if (fname.includes("name") || fname === "full_name") {
                  name = fval;
                } else if (fname.includes("phone") || fname === "phone_number") {
                  phone = fval;
                } else if (fname.includes("email")) {
                  email = fval;
                }
              }
            }
          }
        }
      }
    }
    // 2. Direct simulation payload format for partner/testing APIs
    else if (body.phone || body.phoneNumber) {
      name = body.name || body.fullName || "Meta Ads Lead";
      phone = body.phone || body.phoneNumber;
      email = body.email || "";
      adMetadata = {
        adCampaign: body.adCampaign || "Vocational Diploma Campaign 2026",
        adSet: body.adSet || "Meta Feed Ads",
      };
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Invalid payload: Phone number could not be extracted from Meta webhook." },
        { status: 400 }
      );
    }

    const result = await ingestOrUpdateLead({
      organizationId,
      source: LeadSource.META_ADS,
      name,
      phone,
      email,
      score: 75, // Higher initial score for direct Meta lead forms
      metadata: adMetadata,
      notes: `Ingested via Meta Lead Ads integration (${integration.id})`,
    });

    return NextResponse.json({
      status: "success",
      result: result.message,
      isNew: result.isNew,
      leadId: result.lead.id,
    });
  } catch (error: any) {
    console.error("Meta Webhook Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process Meta webhook." },
      { status: error?.message?.includes("token") ? 401 : 500 }
    );
  }
}
