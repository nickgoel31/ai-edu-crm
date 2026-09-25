import { AgentRole, AGENT_ROLE_META } from "@/types";

export interface AgentCatalogEntry {
  role: AgentRole;
  name: string;
  description: string;
}

// Static catalog of every agent role this platform supports. Does not vary
// per-organization — which entries are "available" vs already deployed is
// determined by cross-referencing this list against the org's Agent records
// by role (see app/agents/page.tsx).
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    role: AgentRole.INBOUND_CALL_RECEIVER,
    name: "Inbound AI Receptionist",
    description: "Answers every inbound call to the org's main number, greets the caller, routes to the right department, and logs the inquiry — the AI front desk for your admissions line.",
  },
  {
    role: AgentRole.LEAD_TELECALLER,
    name: "Lead Auto Caller",
    description: "Automatically calls new inbound leads, runs a qualification script, and books a campus demo visit.",
  },
  {
    role: AgentRole.WHATSAPP_NURTURE,
    name: "WhatsApp Nurture",
    description: "Answers syllabus/fee questions over WhatsApp and shares brochures & application links.",
  },
  {
    role: AgentRole.EMAIL_NURTURE,
    name: "Email Nurture",
    description: "Runs a drip email sequence to keep cold leads warm until they're ready to talk.",
  },
  {
    role: AgentRole.COUNSELLOR,
    name: "Website Live Guide",
    description: "Embeddable website chatbot that answers admissions FAQs in real time and hands off to a human counselor when needed.",
  },
  {
    role: AgentRole.LEAD_QUALIFICATION,
    name: "WhatsApp Lead Qualification Agent",
    description: "Chats with every new lead over WhatsApp, scores them on budget, eligibility, and intent, and hands off qualified leads to a counselor.",
  },
  {
    role: AgentRole.REENGAGEMENT,
    name: "Cold Lead Win-back Agent",
    description: "Pings stale or lost leads on WhatsApp with new scholarships/offers to win them back into the pipeline.",
  },
  {
    role: AgentRole.INTERVIEW_SCREENING,
    name: "Interview Screening",
    description: "Confirms applicant availability and books technical screening interview slots.",
  },
  {
    role: AgentRole.DOCUMENT_COLLECTION,
    name: "Document Collection Bot",
    description: "Chases students over WhatsApp for pending required documents and collects uploads until their file is complete.",
  },
  {
    role: AgentRole.PAYMENT_REMINDER,
    name: "Fee Reminder Agent",
    description: "Reminds students of upcoming and overdue fee installments over WhatsApp before escalating to staff.",
  },
  {
    role: AgentRole.ONBOARDING,
    name: "Onboarding and Orientation Agent",
    description: "Sends orientation schedule, campus map, and cohort group invite to newly enrolled students.",
  },
  {
    role: AgentRole.SUPPORT_ESCALATION,
    name: "Support Line Agent",
    description: "Answers student support calls, resolves common questions, and escalates unresolved issues to the right campus department.",
  },
  {
    role: AgentRole.FEEDBACK_NPS,
    name: "Feedback & NPS",
    description: "Surveys students after cohort completion and captures an NPS score.",
  },
  {
    role: AgentRole.ALUMNI_REFERRAL,
    name: "Alumni Referral Agent",
    description: "Asks alumni for referrals over WhatsApp and tracks incentive payouts for successful admissions.",
  },
];

export function getCatalogEntry(role: string): AgentCatalogEntry | undefined {
  return AGENT_CATALOG.find((c) => c.role === role);
}

export function isValidAgentRole(role: string): role is AgentRole {
  return Object.values(AgentRole).includes(role as AgentRole);
}
