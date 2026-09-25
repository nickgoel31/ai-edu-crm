import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptField } from "@/lib/crypto";
import { generateTotpSecret, buildOtpauthUri } from "@/lib/totp";

// Step 1 of 2: generates a new TOTP secret and stores it (encrypted) in a
// pending state — twoFactorEnabled stays false until the user proves they
// scanned it correctly via /2fa/enable. Calling this again before enabling
// just replaces the pending secret (e.g. the user re-scans).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpauthUri(secret, session.user.email || session.user.id);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encryptField(secret), twoFactorEnabled: false },
  });

  return NextResponse.json({ secret, otpauthUri, qrCodeDataUrl });
}
