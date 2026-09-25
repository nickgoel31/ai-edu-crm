import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSamlClientForOrg, SsoConfigError } from "@/lib/sso/saml";

// SP-initiated login: redirects the browser to the org's IdP with a SAML
// AuthnRequest. The IdP posts back to /api/auth/saml/callback.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "Missing org parameter." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  try {
    const saml = getSamlClientForOrg(org);
    const authorizeUrl = await saml.getAuthorizeUrlAsync("", req.headers.get("host") || undefined, {});
    return NextResponse.redirect(authorizeUrl);
  } catch (err: any) {
    if (err instanceof SsoConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Error building SAML authorize URL:", err);
    return NextResponse.json({ error: "Failed to start SSO login." }, { status: 500 });
  }
}
