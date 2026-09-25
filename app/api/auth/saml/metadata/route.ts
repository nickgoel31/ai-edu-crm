import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSamlClientForOrg, SsoConfigError } from "@/lib/sso/saml";

// SP metadata document — give this URL to the customer's IdP admin so they
// can auto-configure the ACS URL, entity ID, and NameID format on their side.
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
    const xml = saml.generateServiceProviderMetadata(null, null);
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
  } catch (err: any) {
    if (err instanceof SsoConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Error generating SP metadata:", err);
    return NextResponse.json({ error: "Failed to generate metadata." }, { status: 500 });
  }
}
