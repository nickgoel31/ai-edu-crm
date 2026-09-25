import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-only";
});

describe("lib/crypto", () => {
  it("round-trips a plaintext value through encrypt/decrypt", async () => {
    const { encryptField, decryptField } = await import("@/lib/crypto");
    const encrypted = encryptField("Bearer sk_live_super_secret");
    expect(encrypted).not.toBe("Bearer sk_live_super_secret");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptField(encrypted)).toBe("Bearer sk_live_super_secret");
  });

  it("never leaks the plaintext inside the ciphertext", async () => {
    const { encryptField } = await import("@/lib/crypto");
    const encrypted = encryptField("sk_live_abc123") as string;
    expect(encrypted.includes("sk_live_abc123")).toBe(false);
  });

  it("produces a different ciphertext for the same plaintext each time (random IV)", async () => {
    const { encryptField } = await import("@/lib/crypto");
    const a = encryptField("same-value");
    const b = encryptField("same-value");
    expect(a).not.toBe(b);
  });

  it("treats legacy unprefixed values as already-plaintext on decrypt", async () => {
    const { decryptField } = await import("@/lib/crypto");
    expect(decryptField("legacy-plaintext-value")).toBe("legacy-plaintext-value");
  });

  it("is idempotent: encrypting an already-encrypted value is a no-op", async () => {
    const { encryptField } = await import("@/lib/crypto");
    const once = encryptField("value") as string;
    const twice = encryptField(once);
    expect(twice).toBe(once);
  });

  it("passes through null/undefined/empty unchanged", async () => {
    const { encryptField, decryptField } = await import("@/lib/crypto");
    expect(encryptField(null)).toBe(null);
    expect(encryptField(undefined)).toBe(undefined);
    expect(encryptField("")).toBe("");
    expect(decryptField(null)).toBe(null);
  });
});
