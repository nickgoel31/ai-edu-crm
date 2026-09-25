import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { generateTotpSecret, verifyTotpCode, generateBackupCodes, consumeBackupCode } from "@/lib/totp";

describe("TOTP secret + verification", () => {
  it("generates a valid base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("verifies a code actually generated from the secret", () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({
      issuer: "AI Edu CRM",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const code = totp.generate();
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "not-a-code")).toBe(false);
    expect(verifyTotpCode(secret, "123")).toBe(false);
  });
});

describe("backup codes", () => {
  it("generates 10 unique codes and matching bcrypt hashes", async () => {
    const { plaintext, hashed } = await generateBackupCodes();
    expect(plaintext).toHaveLength(10);
    expect(new Set(plaintext).size).toBe(10);
    expect(hashed).toHaveLength(10);
  });

  it("consumes a valid backup code case-insensitively and returns its index", async () => {
    const { plaintext, hashed } = await generateBackupCodes(3);
    const idx = await consumeBackupCode(hashed, plaintext[1].toLowerCase());
    expect(idx).toBe(1);
  });

  it("returns -1 for a code that isn't in the set", async () => {
    const { hashed } = await generateBackupCodes(3);
    const idx = await consumeBackupCode(hashed, "ZZZZZ-ZZZZZ");
    expect(idx).toBe(-1);
  });
});
