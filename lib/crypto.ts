import crypto from "crypto";

// Sentinel a client sends back unchanged when a secret field was already set
// and the user didn't retype it — never a real secret value, so it's safe
// to compare against literally. Shared across agent config and integration
// config so both masking flows behave identically.
export const SECRET_SET_SENTINEL = "__secret_already_set__";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = "enc:v1:";

/**
 * Returns a 32-byte (256-bit) encryption key from the environment.
 * Uses ENCRYPTION_KEY if provided; otherwise derives a deterministic key from NEXTAUTH_SECRET.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // If hexadecimal 64 chars
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    // If base64 44 chars
    if (envKey.length === 44) {
      return Buffer.from(envKey, "base64");
    }
    // Otherwise hash to 32 bytes
    return crypto.createHash("sha256").update(envKey).digest();
  }

  // Fallback to hashing NEXTAUTH_SECRET or a default dev seed
  const seed = process.env.NEXTAUTH_SECRET || "default-dev-encryption-key-for-edu-crm-2026";
  return crypto.createHash("sha256").update(seed).digest();
}

/**
 * Encrypts a sensitive string value using AES-256-GCM.
 * Output format: "enc:v1:<hex-iv>:<hex-auth-tag>:<hex-ciphertext>"
 */
export function encryptField(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // Already encrypted

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypts a sensitive string value using AES-256-GCM.
 * If the value is not prefixed with "enc:v1:", it is treated as legacy unencrypted plaintext.
 */
export function decryptField(ciphertext: string | null | undefined): string | null | undefined {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // Return plaintext as-is (backwards compatible)

  try {
    const key = getEncryptionKey();
    const parts = ciphertext.slice(PREFIX.length).split(":");

    if (parts.length !== 3) {
      console.warn("Invalid encrypted format, returning value as-is");
      return ciphertext;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // Return original string if decryption fails (e.g. key mismatch in dev)
    return ciphertext;
  }
}

/**
 * Checks if a string is encrypted at rest
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(PREFIX);
}
