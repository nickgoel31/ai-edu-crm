import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TWO_FACTOR_DISABLED",
        entityType: "User",
        entityId: session.user.id,
        changesJson: JSON.stringify({ performedBy: session.user.email }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error disabling 2FA:", error);
    return NextResponse.json({ error: error?.message || "Failed to disable two-factor authentication." }, { status: 500 });
  }
}
