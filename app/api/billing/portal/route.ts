import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { getStripe, isStripeConfigured, BillingConfigError } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

// Hands off plan upgrade/downgrade/cancel/invoice history to Stripe's own
// hosted Billing Portal instead of us re-building that UI — the org must
// already have a Stripe customer (i.e. have checked out at least once).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden: Only organization admins can manage billing." }, { status: 403 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  try {
    const org = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });
    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet — subscribe to a plan first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    if (error instanceof BillingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Error creating billing portal session:", error);
    return NextResponse.json({ error: error?.message || "Failed to open billing portal." }, { status: 500 });
  }
}
