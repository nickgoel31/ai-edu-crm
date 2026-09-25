import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { getStripe, isStripeConfigured, ensureStripeCustomer, PLAN_CONFIGS, type PlanId, BillingConfigError } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

// Creates a REAL Stripe Checkout Session and returns its hosted URL. The
// org's plan/subscriptionStatus is never set here — only the
// checkout.session.completed webhook (/api/billing/webhook) does that,
// because a client-reported "the payment worked" is not something the
// server can trust.
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
    return NextResponse.json(
      { error: "Billing is not configured yet. Set STRIPE_SECRET_KEY in the environment to enable checkout." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const plan: PlanId = PLAN_CONFIGS[body.plan as PlanId] ? body.plan : "SELF_SERVE_AGENTS";
    const planConfig = PLAN_CONFIGS[plan];

    const org = await prisma.organization.findUnique({ where: { id: session.user.organizationId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const customerId = await ensureStripeCustomer(org, session.user.email || "");
    const stripe = getStripe();

    const appUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "inr",
            unit_amount: planConfig.amountInInr * 100,
            recurring: { interval: "month" },
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { organizationId: org.id, plan },
      subscription_data: { metadata: { organizationId: org.id, plan } },
      success_url: `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
      plan,
      planName: planConfig.name,
      amount: planConfig.amountInInr,
      currency: "INR",
    });
  } catch (error: any) {
    if (error instanceof BillingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Checkout session creation error:", error);
    return NextResponse.json({ error: error?.message || "Failed to initialize checkout session." }, { status: 500 });
  }
}
