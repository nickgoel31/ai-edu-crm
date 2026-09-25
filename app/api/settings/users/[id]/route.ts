import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin, APP_MODULES, type AppModule } from "@/lib/rbac";

// Per-user module access (Settings -> Users -> Permissions). ADMIN accounts
// are never restricted by this — ignored if the target user is an ADMIN.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden: Only organization admins can change permissions." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { moduleAccess } = body as { moduleAccess?: Record<string, boolean> };

    if (!moduleAccess || typeof moduleAccess !== "object") {
      return NextResponse.json({ error: "moduleAccess object is required." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);
    const target = await scopedDb.user.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "User not found in this organization." }, { status: 404 });
    }
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Admins always have full access — nothing to restrict." }, { status: 400 });
    }

    const sanitized: Partial<Record<AppModule, boolean>> = {};
    for (const mod of APP_MODULES) {
      if (typeof moduleAccess[mod] === "boolean") sanitized[mod] = moduleAccess[mod];
    }

    const updated = await scopedDb.user.update({
      where: { id: params.id },
      data: { moduleAccess: JSON.stringify(sanitized) },
      select: { id: true, name: true, email: true, role: true, moduleAccess: true },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "USER_PERMISSIONS_UPDATED",
        entityType: "User",
        entityId: target.id,
        changesJson: JSON.stringify({ targetEmail: target.email, moduleAccess: sanitized }),
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error: any) {
    console.error("Error updating user permissions:", error);
    return NextResponse.json({ error: error?.message || "Failed to update permissions." }, { status: 500 });
  }
}
