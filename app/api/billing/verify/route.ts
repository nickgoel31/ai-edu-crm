import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillingGate } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

// Read-only. The Stripe webhook (/api/billing/webhook) is the only thing
// that actually activates a plan — this just reports the org's current,
// already-persisted billing status, e.g. for a "confirming your payment…"
// spinner on the post-checkout redirect page.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  const gate = getBillingGate(org);

  return NextResponse.json({
    plan: org.plan,
    subscriptionStatus: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    ...gate,
  });
}
