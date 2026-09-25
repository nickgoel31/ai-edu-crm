import { AgentRole } from "@/types";
import { getSecretFieldKeys } from "@/lib/agent-config-schemas";
import { encryptField, decryptField, SECRET_SET_SENTINEL } from "@/lib/crypto";

export { SECRET_SET_SENTINEL };

export function parseAgentConfig(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Merges incoming form values into the existing stored config, encrypting
 * any field the schema marks as `secret`. If a secret field arrives as the
 * "already set" sentinel (unchanged in the UI) or blank, the previously
 * stored encrypted value is preserved instead of being wiped.
 */
export function buildAgentConfigJson(
  role: AgentRole,
  existingConfig: Record<string, any>,
  incomingValues: Record<string, any>
): string {
  const secretKeys = new Set(getSecretFieldKeys(role));
  const merged: Record<string, any> = { ...existingConfig };

  for (const [key, value] of Object.entries(incomingValues || {})) {
    if (secretKeys.has(key)) {
      if (value === SECRET_SET_SENTINEL || value === "" || value === undefined || value === null) {
        continue; // keep existing encrypted value
      }
      merged[key] = encryptField(String(value));
    } else {
      merged[key] = value;
    }
  }

  return JSON.stringify(merged);
}

/**
 * Returns config safe to send to the client: secret fields are replaced
 * with a sentinel (if set) so the UI can show "already configured" without
 * ever exposing the decrypted value over the wire.
 */
export function maskAgentConfigForClient(role: AgentRole, config: Record<string, any>): Record<string, any> {
  const secretKeys = getSecretFieldKeys(role);
  const masked: Record<string, any> = { ...config };
  for (const key of secretKeys) {
    if (masked[key]) {
      masked[key] = SECRET_SET_SENTINEL;
    }
  }
  return masked;
}

/** Decrypts a single stored secret field for server-side use only (never send to the client). */
export function readAgentSecret(config: Record<string, any>, key: string): string | undefined {
  const value = config?.[key];
  if (!value) return undefined;
  return decryptField(value) || undefined;
}
