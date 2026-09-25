import Stripe from "stripe";

export class BillingConfigError extends Error {}

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new BillingConfigError(
      "STRIPE_SECRET_KEY is not configured. Add it to the environment to enable real billing."
    );
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

export type PlanId = "SELF_SERVE" | "SELF_SERVE_AGENTS" | "MANAGED";

export interface PlanConfig {
  name: string;
  amountInInr: number; // per month
  seatLimit: number; // null = unlimited, represented as Infinity
  description: string;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  SELF_SERVE: {
    name: "Self-Serve Core",
    amountInInr: 4999,
    seatLimit: 5,
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
    seatLimit: 15,
    description: "Full CRM platform plus Voice & WhatsApp AI agents with live escalation.",
    features: [
      "Everything in Self-Serve Core",
      "Voice & WhatsApp AI Agents",
      "Automated Conversation Ingestion",
      "Counselor Escalation Queue",
      "Lead Source ROI & Conversion Reports",
      "Up to 15 Counselor Seats",
    ],
  },
  MANAGED: {
    name: "Managed Enterprise",
    amountInInr: 39999,
    seatLimit: Infinity,
    description: "Dedicated AI tuning, custom two-way ERP sync, and priority SLA.",
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

export const TRIAL_DAYS = 14;

/** Creates (or reuses) the org's Stripe Customer. */
export async function ensureStripeCustomer(org: {
  id: string;
  name: string;
  stripeCustomerId: string | null;
}, email: string): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: org.name,
    email,
    metadata: { organizationId: org.id },
  });

  const { prisma } = await import("@/lib/prisma");
  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
