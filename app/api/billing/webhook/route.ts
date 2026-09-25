import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

// The actual source of truth for plan activation. Stripe signs every
// delivery with STRIPE_WEBHOOK_SECRET, so — unlike the old client-called
// /api/billing/verify — nothing here can be spoofed by a browser claiming
// "the payment worked."
export async function POST(req: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing webhooks are not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature || "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        const plan = session.metadata?.plan;
        if (organizationId) {
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: plan || undefined,
              subscriptionStatus: "ACTIVE",
              stripeSubscriptionId:
                typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
              trialEndsAt: null,
            },
          });
          await prisma.auditLog.create({
            data: {
              organizationId,
              action: "SUBSCRIPTION_ACTIVATED",
              entityType: "Organization",
              entityId: organizationId,
              changesJson: JSON.stringify({ plan, stripeSessionId: session.id, source: "stripe_webhook" }),
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        const statusMap: Record<string, string> = {
          active: "ACTIVE",
          trialing: "TRIALING",
          past_due: "PAST_DUE",
          unpaid: "PAST_DUE",
          canceled: "CANCELED",
          incomplete: "INCOMPLETE",
          incomplete_expired: "CANCELED",
        };
        const mappedStatus = statusMap[subscription.status] || subscription.status.toUpperCase();

        const where = organizationId ? { id: organizationId } : undefined;
        if (where) {
          await prisma.organization.update({ where, data: { subscriptionStatus: mappedStatus } });
        } else {
          await prisma.organization.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: { subscriptionStatus: mappedStatus },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { subscriptionStatus: "CANCELED" },
        });
        break;
      }

      default:
        break; // ignore events we don't act on
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error handling Stripe webhook:", error);
    // Still 200 unless we want Stripe to retry — retry is actually useful
    // here since this is likely a transient DB error, so surface 500.
    return NextResponse.json({ error: error?.message || "Webhook handler error." }, { status: 500 });
  }
}
