import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getSamlClientForOrg, extractEmailFromProfile, appUrl, SsoConfigError } from "@/lib/sso/saml";
import { parseModuleAccess } from "@/lib/rbac";

// Assertion Consumer Service (ACS): the IdP POSTs the SAMLResponse here
// after the user authenticates. On success this mints our own NextAuth
// session cookie directly (via next-auth/jwt's encode) rather than going
// through the credentials provider, since there's no password here — the
// IdP has already done the authenticating.
//
// SSO never auto-provisions a user or an org: the email in the assertion
// must already match an existing User in that org (invited the normal way
// via Settings -> Users first). This is a deliberate, conservative choice —
// silently creating accounts from an assertion is how you end up with
// surprise seats.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "Missing org parameter." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  let saml;
  try {
    saml = getSamlClientForOrg(org);
  } catch (err: any) {
    if (err instanceof SsoConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const formData = await req.formData().catch(() => null);
  const samlResponse = formData?.get("SAMLResponse");
  if (typeof samlResponse !== "string") {
    return NextResponse.json({ error: "Missing SAMLResponse in IdP callback." }, { status: 400 });
  }

  let profile: Record<string, any> | null = null;
  try {
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile as any;
  } catch (err: any) {
    console.error(`SAML assertion validation failed for org ${orgSlug}:`, err);
    return NextResponse.redirect(new URL("/login?sso_error=invalid_assertion", appUrl()));
  }

  const email = profile ? extractEmailFromProfile(profile) : null;
  if (!email) {
    return NextResponse.redirect(new URL("/login?sso_error=no_email_in_assertion", appUrl()));
  }

  const user = await prisma.user.findFirst({ where: { organizationId: org.id, email } });
  if (!user) {
    return NextResponse.redirect(new URL("/login?sso_error=no_matching_account", appUrl()));
  }

  const secret = process.env.NEXTAUTH_SECRET || "dev-only-insecure-fallback-secret-32ch";
  const token = await encode({
    secret,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      organizationId: user.organizationId,
      organizationName: org.name,
      moduleAccess: parseModuleAccess(user.moduleAccess),
    },
  });

  const isSecure = appUrl().startsWith("https://");
  const cookieName = isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  const response = NextResponse.redirect(new URL("/", appUrl()));
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "SSO_LOGIN",
      entityType: "User",
      entityId: user.id,
      changesJson: JSON.stringify({ email: user.email }),
    },
  });

  return response;
}
