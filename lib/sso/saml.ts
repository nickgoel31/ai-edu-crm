import { SAML } from "@node-saml/node-saml";

export class SsoConfigError extends Error {}

export interface OrgSsoConfig {
  slug: string;
  ssoEnabled: boolean;
  ssoEntryPoint: string | null;
  ssoIssuer: string | null;
  ssoCert: string | null;
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

/** Where a customer's IdP posts the SAMLResponse back to (the ACS URL). */
export function callbackUrlFor(orgSlug: string): string {
  return `${appUrl()}/api/auth/saml/callback?org=${encodeURIComponent(orgSlug)}`;
}

/** Our SP entity ID for this org — the metadata document's own URL, a common convention. */
export function spEntityIdFor(orgSlug: string): string {
  return `${appUrl()}/api/auth/saml/metadata?org=${encodeURIComponent(orgSlug)}`;
}

/**
 * Builds a node-saml client for one org's configured IdP. Every org has its
 * own IdP (entryPoint/issuer/cert), so this is never a singleton — always
 * constructed per-request from that org's stored config.
 */
export function getSamlClientForOrg(org: OrgSsoConfig): SAML {
  if (!org.ssoEnabled) {
    throw new SsoConfigError("SSO is not enabled for this organization.");
  }
  if (!org.ssoEntryPoint || !org.ssoIssuer || !org.ssoCert) {
    throw new SsoConfigError("SSO is not fully configured for this organization (missing entry point, issuer, or certificate).");
  }

  return new SAML({
    callbackUrl: callbackUrlFor(org.slug),
    issuer: spEntityIdFor(org.slug),
    entryPoint: org.ssoEntryPoint,
    idpIssuer: org.ssoIssuer,
    idpCert: org.ssoCert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  });
}

/** Pulls the best email out of a validated SAML profile. */
export function extractEmailFromProfile(profile: Record<string, any>): string | null {
  const candidate = profile.email || profile.mail || profile.nameID;
  if (typeof candidate === "string" && candidate.includes("@")) {
    return candidate.trim().toLowerCase();
  }
  return null;
}
