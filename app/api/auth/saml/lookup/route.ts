import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Email-domain-based IdP discovery for the login page's "Sign in with SSO"
// path: given a work email, is there an org with SSO enabled for that domain?
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const domain = email?.split("@")[1];

  if (!domain) {
    return NextResponse.json({ ssoAvailable: false });
  }

  const org = await prisma.organization.findFirst({
    where: { ssoEnabled: true, ssoDomain: domain },
    select: { slug: true, name: true },
  });

  if (!org) {
    return NextResponse.json({ ssoAvailable: false });
  }

  return NextResponse.json({ ssoAvailable: true, orgSlug: org.slug, orgName: org.name });
}
