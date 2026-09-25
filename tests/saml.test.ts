import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXTAUTH_URL = "https://crm.example.com";
});

describe("lib/sso/saml URL helpers", () => {
  it("builds the ACS callback URL scoped to the org slug", async () => {
    const { callbackUrlFor } = await import("@/lib/sso/saml");
    expect(callbackUrlFor("acme-coaching")).toBe(
      "https://crm.example.com/api/auth/saml/callback?org=acme-coaching"
    );
  });

  it("builds the SP entity ID from the metadata URL", async () => {
    const { spEntityIdFor } = await import("@/lib/sso/saml");
    expect(spEntityIdFor("acme-coaching")).toBe(
      "https://crm.example.com/api/auth/saml/metadata?org=acme-coaching"
    );
  });
});

describe("extractEmailFromProfile", () => {
  it("prefers profile.email", async () => {
    const { extractEmailFromProfile } = await import("@/lib/sso/saml");
    expect(extractEmailFromProfile({ email: "a@b.com", mail: "c@d.com", nameID: "e@f.com" })).toBe("a@b.com");
  });

  it("falls back to profile.mail, then nameID", async () => {
    const { extractEmailFromProfile } = await import("@/lib/sso/saml");
    expect(extractEmailFromProfile({ mail: "c@d.com", nameID: "e@f.com" })).toBe("c@d.com");
    expect(extractEmailFromProfile({ nameID: "e@f.com" })).toBe("e@f.com");
  });

  it("normalizes case and whitespace", async () => {
    const { extractEmailFromProfile } = await import("@/lib/sso/saml");
    expect(extractEmailFromProfile({ email: "  Someone@Example.COM  " })).toBe("someone@example.com");
  });

  it("returns null when nothing looks like an email (e.g. a non-email NameID)", async () => {
    const { extractEmailFromProfile } = await import("@/lib/sso/saml");
    expect(extractEmailFromProfile({ nameID: "opaque-id-1234" })).toBe(null);
    expect(extractEmailFromProfile({})).toBe(null);
  });
});

describe("getSamlClientForOrg config validation", () => {
  it("throws SsoConfigError when SSO isn't enabled", async () => {
    const { getSamlClientForOrg, SsoConfigError } = await import("@/lib/sso/saml");
    expect(() =>
      getSamlClientForOrg({ slug: "x", ssoEnabled: false, ssoEntryPoint: null, ssoIssuer: null, ssoCert: null })
    ).toThrow(SsoConfigError);
  });

  it("throws SsoConfigError when enabled but incomplete", async () => {
    const { getSamlClientForOrg, SsoConfigError } = await import("@/lib/sso/saml");
    expect(() =>
      getSamlClientForOrg({
        slug: "x",
        ssoEnabled: true,
        ssoEntryPoint: "https://idp.example.com/sso",
        ssoIssuer: null,
        ssoCert: null,
      })
    ).toThrow(SsoConfigError);
  });

  it("builds a client when fully configured", async () => {
    const { getSamlClientForOrg } = await import("@/lib/sso/saml");
    const client = getSamlClientForOrg({
      slug: "acme",
      ssoEnabled: true,
      ssoEntryPoint: "https://idp.example.com/sso",
      ssoIssuer: "https://idp.example.com/metadata",
      ssoCert: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
    });
    expect(client).toBeTruthy();
  });
});
