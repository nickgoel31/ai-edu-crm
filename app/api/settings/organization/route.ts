import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Org profile + white-label branding + franchise linking status.
 * Follows the same pattern as app/api/settings/sso/route.ts: admin-gated,
 * raw prisma client scoped explicitly to session.user.organizationId (never
 * a client-supplied id).
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can manage organization settings." },
      { status: 403 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      brandLogoUrl: true,
      brandPrimaryColor: true,
      upiVpa: true,
      parentOrganizationId: true,
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  let parent: { id: string; name: string; slug: string } | null = null;
  if (org.parentOrganizationId) {
    parent = await prisma.organization.findUnique({
      where: { id: org.parentOrganizationId },
      select: { id: true, name: true, slug: true },
    });
  }

  const branches = await prisma.organization.findMany({
    where: { parentOrganizationId: org.id },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    organization: org,
    parent,
    branches,
    isFranchiseHQ: branches.length > 0,
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
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can manage organization settings." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { name, brandLogoUrl, brandPrimaryColor, upiVpa } = body;

    if (brandPrimaryColor && !/^#[0-9a-fA-F]{6}$/.test(brandPrimaryColor)) {
      return NextResponse.json(
        { error: "brandPrimaryColor must be a hex color, e.g. #2563eb." },
        { status: 400 }
      );
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Organization name cannot be empty." }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (brandLogoUrl !== undefined) data.brandLogoUrl = brandLogoUrl?.trim() || null;
    if (brandPrimaryColor !== undefined) data.brandPrimaryColor = brandPrimaryColor?.trim() || null;
    if (upiVpa !== undefined) data.upiVpa = upiVpa?.trim() || null;

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
        upiVpa: true,
        parentOrganizationId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "ORGANIZATION_SETTINGS_UPDATED",
        entityType: "Organization",
        entityId: session.user.organizationId,
        changesJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    console.error("Error updating organization settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update organization settings." },
      { status: 500 }
    );
  }
}
