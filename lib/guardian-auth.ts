import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Self-contained parent/guardian authentication.
 *
 * IMPORTANT: this is intentionally NOT wired into NextAuth (lib/auth.ts /
 * middleware.ts). Staff auth and guardian auth are two completely separate
 * mechanisms with separate cookies, so a guardian session can never be
 * mistaken for (or escalate into) a staff session and vice versa. Do not
 * import anything from lib/auth.ts here, and do not add a guardian
 * provider to authOptions.
 */

const GUARDIAN_SESSION_COOKIE = "guardian_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSigningSecret(): Buffer {
  // Reuse the existing NEXTAUTH_SECRET env var (so no new secret needs to
  // be provisioned), but hash it first so the guardian token signature is
  // derived from, not identical to, the raw NextAuth secret.
  const raw = process.env.NEXTAUTH_SECRET || "insecure-dev-only-fallback-secret";
  return crypto.createHash("sha256").update(raw).digest();
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, "base64").toString("utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export async function hashGuardianPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyGuardianPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a signed, expiring session token: base64url(JSON payload) + "." + hex HMAC signature.
 * Not a JWT (no external dependency needed) but the same tamper-evident shape.
 */
export function createGuardianSessionToken(guardianId: string): string {
  const payload = JSON.stringify({ guardianId, exp: Date.now() + SESSION_TTL_MS });
  const encodedPayload = base64UrlEncode(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyGuardianSessionToken(token: string): { guardianId: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as {
      guardianId?: string;
      exp?: number;
    };
    if (!payload.guardianId || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { guardianId: payload.guardianId };
  } catch {
    return null;
  }
}

export async function setGuardianSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUARDIAN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearGuardianSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUARDIAN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export interface GuardianIdentity {
  id: string;
  organizationId: string;
  studentId: string;
  name: string;
  email: string;
}

/**
 * Reads the guardian_session cookie, verifies it, and loads the scoped
 * Guardian identity. Every portal page/API route should call this first
 * and treat `null` as "not authenticated" (redirect to /portal/login in
 * pages, 401 in API routes). Never trust a studentId/organizationId that
 * didn't come from this function.
 */
export async function getGuardianFromRequest(): Promise<GuardianIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUARDIAN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const verified = verifyGuardianSessionToken(token);
  if (!verified) return null;

  const guardian = await prisma.guardian.findUnique({
    where: { id: verified.guardianId },
    select: {
      id: true,
      organizationId: true,
      studentId: true,
      name: true,
      email: true,
    },
  });

  if (!guardian) return null;

  return guardian;
}
