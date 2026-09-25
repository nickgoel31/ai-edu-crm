import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { callbackUrlFor, spEntityIdFor } from "@/lib/sso/saml";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden: Only organization admins can manage SSO." }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { slug: true, ssoEnabled: true, ssoDomain: true, ssoEntryPoint: true, ssoIssuer: true, ssoCert: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...org,
    acsUrl: callbackUrlFor(org.slug),
    spEntityId: spEntityIdFor(org.slug),
    metadataUrl: `${spEntityIdFor(org.slug)}`,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden: Only organization admins can manage SSO." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ssoEnabled, ssoDomain, ssoEntryPoint, ssoIssuer, ssoCert } = body;

    if (ssoEnabled && (!ssoDomain?.trim() || !ssoEntryPoint?.trim() || !ssoIssuer?.trim() || !ssoCert?.trim())) {
      return NextResponse.json(
        { error: "Domain, entry point, issuer, and certificate are all required to enable SSO." },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ssoEnabled: Boolean(ssoEnabled),
        ssoDomain: ssoDomain?.trim().toLowerCase() || null,
        ssoEntryPoint: ssoEntryPoint?.trim() || null,
        ssoIssuer: ssoIssuer?.trim() || null,
        ssoCert: ssoCert?.trim() || null,
      },
      select: { slug: true, ssoEnabled: true, ssoDomain: true, ssoEntryPoint: true, ssoIssuer: true, ssoCert: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "SSO_CONFIG_UPDATED",
        entityType: "Organization",
        entityId: session.user.organizationId,
        changesJson: JSON.stringify({ ssoEnabled: updated.ssoEnabled, ssoDomain: updated.ssoDomain }),
      },
    });

    return NextResponse.json({
      ...updated,
      acsUrl: callbackUrlFor(updated.slug),
      spEntityId: spEntityIdFor(updated.slug),
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "That domain is already configured for SSO on another organization." }, { status: 409 });
    }
    console.error("Error updating SSO config:", error);
    return NextResponse.json({ error: error?.message || "Failed to update SSO config." }, { status: 500 });
  }
}
