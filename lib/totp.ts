import * as OTPAuth from "otpauth";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const ISSUER = "AI Edu CRM";

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildOtpauthUri(secretBase32: string, accountLabel: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

/** Verifies a 6-digit code, allowing one 30s step of clock drift either way. */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export interface BackupCodeSet {
  plaintext: string[]; // shown to the user once
  hashed: string[]; // stored
}

export async function generateBackupCodes(count = 10): Promise<BackupCodeSet> {
  const plaintext = Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  );
  const hashed = await Promise.all(plaintext.map((code) => bcrypt.hash(code, 10)));
  return { plaintext, hashed };
}

/** Checks a candidate backup code against stored hashes; returns the index consumed, or -1. */
export async function consumeBackupCode(hashedCodes: string[], candidate: string): Promise<number> {
  const normalized = candidate.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      return i;
    }
  }
  return -1;
}
