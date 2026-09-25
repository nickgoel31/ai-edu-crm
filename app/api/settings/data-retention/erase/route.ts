import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { eraseOrganizationPersonalData } from "@/lib/data-retention";
import { checkRateLimit } from "@/lib/rate-limiter";

// GDPR Art. 17 / DPDP "right to erasure": permanently deletes every lead
// and student's personal data for this org (and everything derived from
// it — payments, documents, conversation transcripts, activity timeline).
// Irreversible, so it requires the admin to type the org's slug back
// exactly, on top of the ADMIN-only session check and a tight rate limit.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Only Organization Administrators can erase org data." },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(req, "data-retention:erase", { limit: 3, windowMs: 60 * 60 * 1000, identifier: session.user.organizationId });
  if (!rl.allowed && rl.response) return rl.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { confirmSlug } = body as { confirmSlug?: string };

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, slug: true, name: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    if (!confirmSlug || confirmSlug.trim() !== organization.slug) {
      return NextResponse.json(
        { error: `Confirmation failed. Type your organization's slug ("${organization.slug}") exactly to proceed.` },
        { status: 400 }
      );
    }

    const result = await eraseOrganizationPersonalData(organization.id);

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        action: "ORG_DATA_ERASED",
        entityType: "Organization",
        entityId: organization.id,
        changesJson: JSON.stringify({
          performedBy: session.user.email,
          deletedCounts: result,
          reason: "GDPR/DPDP data erasure request",
        }),
      },
    });

    return NextResponse.json({ success: true, deletedCounts: result });
  } catch (error: any) {
    console.error("Error erasing organization data:", error);
    return NextResponse.json({ error: error?.message || "Failed to erase organization data." }, { status: 500 });
  }
}
