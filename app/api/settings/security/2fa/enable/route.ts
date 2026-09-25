import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { verifyTotpCode, generateBackupCodes } from "@/lib/totp";
import { checkRateLimit } from "@/lib/rate-limiter";

// Step 2 of 2: confirms the user actually scanned the QR code from /2fa/setup
// by verifying a live code, then flips twoFactorEnabled on and issues
// one-time backup codes (returned in plaintext exactly once).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  const rl = await checkRateLimit(req, "2fa:enable", { limit: 10, windowMs: 60_000, identifier: session.user.id });
  if (!rl.allowed && rl.response) return rl.response;

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true },
    });

    const secret = decryptField(user?.twoFactorSecret);
    if (!secret) {
      return NextResponse.json({ error: "Start two-factor setup first (no pending secret found)." }, { status: 400 });
    }

    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json({ error: "Invalid code. Check your authenticator app and try again." }, { status: 400 });
    }

    const { plaintext, hashed } = await generateBackupCodes();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashed),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "TWO_FACTOR_ENABLED",
        entityType: "User",
        entityId: session.user.id,
        changesJson: JSON.stringify({ performedBy: session.user.email }),
      },
    });

    return NextResponse.json({ success: true, backupCodes: plaintext });
  } catch (error: any) {
    console.error("Error enabling 2FA:", error);
    return NextResponse.json({ error: error?.message || "Failed to enable two-factor authentication." }, { status: 500 });
  }
}
