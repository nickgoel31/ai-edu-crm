import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Links another organization as a branch of the caller's org by setting
 * THAT org's parentOrganizationId to the caller's id. This deliberately
 * mutates a different tenant's row, which getScopedPrismaClient can't do
 * (it's single-tenant by design) — so this route uses the raw prisma
 * client directly, gated to ADMIN, and only ever touches the org looked
 * up by the slug the caller typed (never a client-supplied id).
 *
 * v1 simplification: a direct admin-initiated link by slug, with no
 * invite/accept step on the branch side. In a real product this should be
 * a two-sided flow (the branch org confirms it wants to be linked) — noted
 * here rather than built, given time constraints.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can link a branch." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const branchSlug = (body?.slug || "").trim().toLowerCase();

    if (!branchSlug) {
      return NextResponse.json({ error: "A branch organization slug is required." }, { status: 400 });
    }

    const hqOrgId = session.user.organizationId;
    const hqOrg = await prisma.organization.findUnique({
      where: { id: hqOrgId },
      select: { id: true, slug: true, parentOrganizationId: true },
    });

    if (!hqOrg) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    if (hqOrg.slug.toLowerCase() === branchSlug) {
      return NextResponse.json({ error: "An organization cannot be linked as its own branch." }, { status: 400 });
    }

    const branchOrg = await prisma.organization.findUnique({
      where: { slug: branchSlug },
      select: { id: true, name: true, slug: true, parentOrganizationId: true },
    });

    if (!branchOrg) {
      return NextResponse.json({ error: `No organization found with slug "${branchSlug}".` }, { status: 404 });
    }

    if (branchOrg.parentOrganizationId) {
      return NextResponse.json(
        {
          error:
            branchOrg.parentOrganizationId === hqOrgId
              ? "That organization is already linked as one of your branches."
              : "That organization is already linked as a branch of a different franchise HQ.",
        },
        { status: 409 }
      );
    }

    // A branch org, by definition, doesn't itself have branches — avoid
    // creating a multi-level hierarchy the roll-up logic doesn't support.
    const branchHasOwnBranches = await prisma.organization.count({
      where: { parentOrganizationId: branchOrg.id },
    });
    if (branchHasOwnBranches > 0) {
      return NextResponse.json(
        { error: "That organization already has its own branches linked to it and cannot become a branch itself." },
        { status: 409 }
      );
    }

    const updatedBranch = await prisma.organization.update({
      where: { id: branchOrg.id },
      data: { parentOrganizationId: hqOrgId },
      select: { id: true, name: true, slug: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: hqOrgId,
        userId: session.user.id,
        action: "FRANCHISE_BRANCH_LINKED",
        entityType: "Organization",
        entityId: updatedBranch.id,
        changesJson: JSON.stringify({ branchSlug: updatedBranch.slug, hqOrgId }),
      },
    });

    return NextResponse.json({ branch: updatedBranch });
  } catch (error: any) {
    console.error("Error linking branch organization:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to link branch organization." },
      { status: 500 }
    );
  }
}
