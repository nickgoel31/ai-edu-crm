import { prisma } from "@/lib/prisma";
import { LeadSource, LeadStage, IntegrationType, INTEGRATION_TYPE_META } from "@/types";

// Reverse lookup built from INTEGRATION_TYPE_META so every current and future
// lead channel updates its own Integration row's sync stats correctly,
// instead of falling back to the wrong channel.
const LEAD_SOURCE_TO_INTEGRATION_TYPE: Partial<Record<LeadSource, IntegrationType>> = Object.fromEntries(
  Object.entries(INTEGRATION_TYPE_META)
    .filter(([, meta]) => meta.leadSource)
    .map(([type, meta]) => [meta.leadSource as LeadSource, type as IntegrationType])
);
import {
  normalizePhoneNumber,
  getPhoneSearchVariations,
  checkAndCreateLeadDuplicateMatch,
} from "@/lib/dedup";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { computeLeadSlaDueBy } from "@/lib/sla";

export { normalizePhoneNumber, getPhoneSearchVariations };

export interface IngestLeadParams {
  organizationId: string;
  source: LeadSource;
  name: string;
  phone: string;
  email?: string | null;
  score?: number;
  metadata?: Record<string, any>;
  notes?: string;
}

/**
 * Core lead ingestion engine.
 * Always provisions the new inbound Lead scoped to organizationId, and checks
 * for existing active leads with matching phone/email in the same organization.
 * If found, creates a PENDING DuplicateMatch for side-by-side review in /leads/duplicates.
 */
export async function ingestOrUpdateLead({
  organizationId,
  source,
  name,
  phone,
  email,
  score = 60,
  metadata = {},
  notes,
}: IngestLeadParams) {
  const normalizedPhone = normalizePhoneNumber(phone);

  // Compute SLA target deadline based on source policy or org default
  const { dueBy } = await computeLeadSlaDueBy({
    organizationId,
    source,
  });

  // 1. Create the new lead record
  const newLead = await prisma.lead.create({
    data: {
      organizationId,
      name: name || "New Inbound Lead",
      phone: normalizedPhone,
      email: email || `${normalizedPhone.replace(/\D/g, "")}@inbound.edu`,
      source,
      stage: LeadStage.WARM,
      score,
      slaDueBy: dueBy,
    },
  });

  // 2. Check for existing duplicate lead in the organization
  const duplicateResult = await checkAndCreateLeadDuplicateMatch({
    organizationId,
    newLeadId: newLead.id,
    phone: normalizedPhone,
    email: email || undefined,
  });

  // 2.5 Recalculate score based on organization scoring rules
  let finalLead = newLead;
  try {
    const scored = await recalculateLeadScore(newLead.id, organizationId);
    if (scored) {
      finalLead = scored.lead;
    }
  } catch (err) {
    console.error("Error scoring ingested lead:", err);
  }

  // 3. Write AuditLog
  await prisma.auditLog.create({
    data: {
      organizationId,
      action: duplicateResult ? "LEAD_INGESTED_WITH_DUPLICATE_DETECTED" : "LEAD_CREATED_FROM_WEBHOOK",
      entityType: "Lead",
      entityId: newLead.id,
      changesJson: JSON.stringify({
        source,
        phone: normalizedPhone,
        metadata,
        notes,
        duplicateMatchId: duplicateResult?.duplicateMatch?.id || null,
        primaryLeadId: duplicateResult?.primaryLead?.id || null,
      }),
    },
  });

  // 4. Update integration last sync stats (only when this source maps to a channel)
  const integrationType = LEAD_SOURCE_TO_INTEGRATION_TYPE[source];
  if (integrationType) {
    await prisma.integration.updateMany({
      where: { organizationId, type: integrationType },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        leadsImported: { increment: 1 },
      },
    });
  }

  return {
    isNew: true,
    lead: newLead,
    duplicateMatch: duplicateResult?.duplicateMatch || null,
    primaryLead: duplicateResult?.primaryLead || null,
    message: duplicateResult
      ? `New lead created from ${source}. Potential duplicate flagged with existing lead ${duplicateResult.primaryLead.name} (${duplicateResult.primaryLead.id}).`
      : `New lead created from ${source} for organization ${organizationId}.`,
  };
}

/**
 * Resolves the target tenant (organizationId) from the incoming webhook request
 * using the secret token passed via URL query `?token=...` or `x-webhook-token` header.
 */
export async function resolveTenantFromWebhook(
  type: IntegrationType,
  req: Request
) {
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get("token") || url.searchParams.get("secret");
  const tokenFromHeader = req.headers.get("x-webhook-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  const token = tokenFromQuery || tokenFromHeader;

  if (!token) {
    throw new Error(
      `Missing webhook secret token. Please provide token via ?token=... or x-webhook-token header.`
    );
  }

  const integration = await prisma.integration.findFirst({
    where: {
      type,
      webhookSecret: token,
      isEnabled: true,
    },
    include: {
      organization: true,
    },
  });

  if (!integration) {
    throw new Error(
      `Invalid or disabled webhook secret token for ${type}. Check integration settings.`
    );
  }

  return {
    integration,
    organization: integration.organization,
    organizationId: integration.organizationId,
  };
}
