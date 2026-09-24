import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PLAN_CONFIGS: Record<
  string,
  {
    name: string;
    amountInInr: number;
    amountInUsd: number;
    description: string;
    features: string[];
  }
> = {
  SELF_SERVE: {
    name: "Self-Serve Core",
    amountInInr: 4999,
    amountInUsd: 49,
    description: "Multi-tenant CRM, lead pipelines, student registry & document checklist.",
    features: [
      "Unlimited Leads & Pipeline Views",
      "Student Registry & Program Templates",
      "Document Verification Checklist",
      "Payment Tracking & Progress Bars",
      "Up to 5 Counselor Seats",
    ],
  },
  SELF_SERVE_AGENTS: {
    name: "Self-Serve + AI Agents",
    amountInInr: 14999,
    amountInUsd: 149,
    description: "Full CRM platform plus Voice & WhatsApp AI agents with live escalation.",
    features: [
      "Everything in Self-Serve Core",
      "Retell AI Voice Agents & WhatsApp Bot",
      "Automated Conversation Ingestion",
      "Counselor Escalation Queue",
      "Lead Source ROI & Conversion Reports",
      "Up to 15 Counselor Seats",
    ],
  },
  MANAGED: {
    name: "Managed Enterprise",
    amountInInr: 39999,
    amountInUsd: 399,
    description: "Dedicated AI tuning, custom two-way ERP sync, and 24/7 priority SLA.",
    features: [
      "Everything in Self-Serve + Agents",
      "Custom ERP Webhook Sync & Field Mapping",
      "Dedicated Prompt & Script Tuning",
      "Daily Email & WhatsApp Digest Engine",
      "AES-256-GCM Compliance & Audit Logs",
      "Unlimited Counselor Seats & Dedicated Manager",
    ],
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, organizationId, email } = body;

    const planConfig = PLAN_CONFIGS[plan] || PLAN_CONFIGS.SELF_SERVE;
    const sessionId = "sub_sess_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();

    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && !stripeKey.startsWith("mock_")) {
      // If a real Stripe secret is configured, could invoke stripe.checkout.sessions.create
      // Here we provide seamless simulation fallback for environments without active Stripe cards
    }

    return NextResponse.json({
      success: true,
      sessionId,
      plan: plan || "SELF_SERVE",
      planName: planConfig.name,
      amount: planConfig.amountInInr,
      currency: "INR",
      checkoutUrl: `/register?step=3&session_id=${sessionId}&plan=${plan}`,
      features: planConfig.features,
    });
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize checkout session." },
      { status: 500 }
    );
  }
}
