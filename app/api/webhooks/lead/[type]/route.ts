import { NextResponse } from "next/server";
import { IntegrationType, INTEGRATION_TYPE_META } from "@/types";
import { ingestOrUpdateLead, resolveTenantFromWebhook } from "@/lib/lead-ingestion";
import { checkRateLimit } from "@/lib/rate-limiter";

// A single generic inbound-lead webhook shared by every "simple" channel —
// GOOGLE_ADS, WEBSITE_FORM, CALL_TRACKING, LINKEDIN_LEAD_GEN, ZAPIER,
// REFERRAL, INDIAMART, CUSTOM_API. Meta, WhatsApp, and Google Sheets keep
// their own dedicated routes because they need provider-specific payload
// parsing (Meta's field_data[], WhatsApp's contacts[]/messages[], Sheets'
// row batches) — this route only needs to understand a flat JSON object,
// which is what Zapier/Make/Pabbly and most native webhook connectors send.

const GENERIC_TYPES = new Set<string>([
  IntegrationType.GOOGLE_ADS,
  IntegrationType.WEBSITE_FORM,
  IntegrationType.CALL_TRACKING,
  IntegrationType.LINKEDIN_LEAD_GEN,
  IntegrationType.ZAPIER,
  IntegrationType.REFERRAL,
  IntegrationType.INDIAMART,
  IntegrationType.CUSTOM_API,
]);

function firstDefined(body: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

export async function GET(req: Request, { params }: { params: { type: string } }) {
  // Simple health-check / verification endpoint some connectors (e.g. LinkedIn) ping.
  const type = params.type?.toUpperCase();
  if (!GENERIC_TYPES.has(type)) {
    return NextResponse.json({ error: `Unknown or unsupported lead channel: ${params.type}` }, { status: 404 });
  }
  return NextResponse.json({ status: "OK", channel: type, meta: INTEGRATION_TYPE_META[type as IntegrationType] });
}

export async function POST(req: Request, { params }: { params: { type: string } }) {
  const type = params.type?.toUpperCase();
  if (!GENERIC_TYPES.has(type)) {
    return NextResponse.json({ error: `Unknown or unsupported lead channel: ${params.type}` }, { status: 404 });
  }

  const rate = checkRateLimit(req, `webhook:lead:${type}`, { limit: 120, windowMs: 60_000 });
  if (!rate.allowed) return rate.response!;

  try {
    const { organizationId } = await resolveTenantFromWebhook(type as IntegrationType, req);

    const body = await req.json().catch(() => ({}));

    const name = firstDefined(body, ["name", "fullName", "full_name", "contactName", "customerName"]) || "New Inbound Lead";
    const phone = firstDefined(body, ["phone", "phoneNumber", "phone_number", "mobile", "contactNumber", "senderPhone"]);
    const email = firstDefined(body, ["email", "emailAddress", "email_address"]);
    const message =
      firstDefined(body, ["message", "notes", "enquiry", "comments", "requirement"]) || undefined;
    const program = firstDefined(body, ["program", "course", "courseInterest", "product"]);

    if (!phone) {
      return NextResponse.json(
        { error: "Missing required field: phone (or phoneNumber/mobile/contactNumber)." },
        { status: 400 }
      );
    }

    const meta = INTEGRATION_TYPE_META[type as IntegrationType];

    const result = await ingestOrUpdateLead({
      organizationId,
      source: meta.leadSource!,
      name,
      phone,
      email,
      score: 55,
      metadata: { channel: type, program, raw: body },
      notes: message ? `${meta.label}: "${message}"` : `Inbound lead via ${meta.label}.`,
    });

    return NextResponse.json({
      success: true,
      leadId: result.lead.id,
      duplicateDetected: !!result.duplicateMatch,
      message: result.message,
    });
  } catch (error: any) {
    console.error(`Error processing ${params.type} webhook:`, error);
    const status = /token/i.test(error?.message || "") ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to process webhook." }, { status });
  }
}
