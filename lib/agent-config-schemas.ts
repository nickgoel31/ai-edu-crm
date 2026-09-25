import { AgentRole, WhatsappProvider, VoiceProvider } from "@/types";

export type AgentFieldType =
  | "text"
  | "textarea"
  | "password"
  | "select"
  | "tel"
  | "url"
  | "email"
  | "number"
  | "kb-select";

export interface AgentConfigField {
  key: string;
  label: string;
  type: AgentFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  // Field is only shown/required when `values[showIf.field]` is in `showIf.equals`.
  showIf?: { field: string; equals: string[] };
  defaultValue?: string | number;
  // Encrypted at rest via lib/crypto.ts and masked on read.
  secret?: boolean;
}

export interface AgentConfigSection {
  id: string;
  title: string;
  description?: string;
  fields: AgentConfigField[];
}

const WHATSAPP_CHANNEL_SECTION: AgentConfigSection = {
  id: "channel",
  title: "WhatsApp Channel",
  description: "Choose how this agent sends and receives WhatsApp messages.",
  fields: [
    {
      key: "whatsappProvider",
      label: "Connection method",
      type: "select",
      required: true,
      defaultValue: WhatsappProvider.META_CLOUD_API,
      options: [
        { value: WhatsappProvider.META_CLOUD_API, label: "Meta WhatsApp Cloud API (direct)" },
        { value: WhatsappProvider.THIRD_PARTY_BSP, label: "3rd-party BSP (Gupshup, Interakt, WATI, etc.)" },
      ],
    },
    {
      key: "metaPhoneNumberId",
      label: "Phone Number ID",
      type: "text",
      required: true,
      placeholder: "e.g. 109876543210123",
      helpText: "From Meta Business Manager → WhatsApp → API Setup.",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.META_CLOUD_API] },
    },
    {
      key: "metaAppSecret",
      label: "App Secret",
      type: "password",
      required: true,
      secret: true,
      placeholder: "App secret from Meta App Dashboard",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.META_CLOUD_API] },
    },
    {
      key: "metaAccessToken",
      label: "Permanent Access Token",
      type: "password",
      required: true,
      secret: true,
      placeholder: "EAAG...",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.META_CLOUD_API] },
    },
    {
      key: "metaVerifyToken",
      label: "Webhook Verify Token",
      type: "text",
      required: true,
      placeholder: "A string you choose, used to verify the webhook",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.META_CLOUD_API] },
    },
    {
      key: "bspName",
      label: "BSP Provider",
      type: "text",
      required: true,
      placeholder: "e.g. Gupshup, Interakt, WATI",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.THIRD_PARTY_BSP] },
    },
    {
      key: "bspApiEndpoint",
      label: "BSP API Endpoint",
      type: "url",
      required: true,
      placeholder: "https://api.yourbsp.com/v1/messages",
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.THIRD_PARTY_BSP] },
    },
    {
      key: "bspApiKey",
      label: "BSP API Key",
      type: "password",
      required: true,
      secret: true,
      showIf: { field: "whatsappProvider", equals: [WhatsappProvider.THIRD_PARTY_BSP] },
    },
  ],
};

const VOICE_CHANNEL_SECTION: AgentConfigSection = {
  id: "channel",
  title: "Telephony Channel",
  description: "Connect the calling infrastructure this agent will use.",
  fields: [
    {
      key: "voiceProvider",
      label: "Telephony provider",
      type: "select",
      required: true,
      defaultValue: VoiceProvider.TWILIO,
      options: [
        { value: VoiceProvider.TWILIO, label: "Twilio" },
        { value: VoiceProvider.EXOTEL, label: "Exotel" },
        { value: VoiceProvider.PLIVO, label: "Plivo" },
      ],
    },
    {
      key: "callerIdNumber",
      label: "Caller ID number",
      type: "tel",
      required: true,
      placeholder: "+91XXXXXXXXXX",
      helpText: "The number this agent calls from / answers on.",
    },
    {
      key: "twilioAccountSid",
      label: "Account SID",
      type: "text",
      required: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.TWILIO] },
    },
    {
      key: "twilioAuthToken",
      label: "Auth Token",
      type: "password",
      required: true,
      secret: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.TWILIO] },
    },
    {
      key: "exotelApiKey",
      label: "API Key",
      type: "text",
      required: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.EXOTEL] },
    },
    {
      key: "exotelApiToken",
      label: "API Token",
      type: "password",
      required: true,
      secret: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.EXOTEL] },
    },
    {
      key: "exotelSubdomain",
      label: "Subdomain",
      type: "text",
      placeholder: "yourorg.exotel.com",
      showIf: { field: "voiceProvider", equals: [VoiceProvider.EXOTEL] },
    },
    {
      key: "plivoAuthId",
      label: "Auth ID",
      type: "text",
      required: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.PLIVO] },
    },
    {
      key: "plivoAuthToken",
      label: "Auth Token",
      type: "password",
      required: true,
      secret: true,
      showIf: { field: "voiceProvider", equals: [VoiceProvider.PLIVO] },
    },
  ],
};

const WEBSITE_CHAT_CHANNEL_SECTION: AgentConfigSection = {
  id: "channel",
  title: "Website Widget",
  description: "Where this live-chat guide is allowed to run.",
  fields: [
    {
      key: "allowedDomains",
      label: "Allowed domains",
      type: "text",
      required: true,
      placeholder: "yourcollege.edu, apply.yourcollege.edu",
      helpText: "Comma-separated list of domains the embed script is allowed to load on.",
    },
    {
      key: "widgetColor",
      label: "Widget accent color",
      type: "text",
      defaultValue: "#2563eb",
      placeholder: "#2563eb",
    },
    {
      key: "welcomeMessage",
      label: "Welcome message",
      type: "textarea",
      placeholder: "Hi! Ask me anything about our programs, fees, or admissions process.",
    },
    {
      key: "handoffEmail",
      label: "Human hand-off email",
      type: "email",
      placeholder: "admissions@yourcollege.edu",
      helpText: "Notified when a visitor asks to speak with a human.",
    },
  ],
};

// Fields common to every agent, appended after the channel section.
const BEHAVIOR_SECTION: AgentConfigSection = {
  id: "behavior",
  title: "Behavior & Prompting",
  description: "How the agent should think, sound, and when it should run.",
  fields: [
    {
      key: "systemPrompt",
      label: "System Prompt / Instructions",
      type: "textarea",
      required: true,
      placeholder: "You are an admissions assistant for ... Always ask for ... Never promise ...",
      helpText: "The core instructions the AI follows for every conversation.",
    },
    {
      key: "aiModel",
      label: "AI model",
      type: "select",
      required: true,
      defaultValue: "gpt-4o-mini",
      options: [
        { value: "gpt-4o-mini", label: "GPT-4o mini (fast, low-cost)" },
        { value: "gpt-4o", label: "GPT-4o (higher quality)" },
        { value: "claude-3-5-haiku", label: "Claude 3.5 Haiku (fast, low-cost)" },
        { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (higher quality)" },
      ],
    },
    {
      key: "workingHours",
      label: "Working hours",
      type: "text",
      defaultValue: "09:00 - 20:00 IST",
      placeholder: "e.g. 09:00 - 20:00 IST",
    },
    {
      key: "language",
      label: "Primary language",
      type: "select",
      defaultValue: "en-IN",
      options: [
        { value: "en-IN", label: "English (India)" },
        { value: "hi-IN", label: "Hindi" },
        { value: "hi-Latn", label: "Hinglish (colloquial)" },
        { value: "mr-IN", label: "Marathi" },
        { value: "ta-IN", label: "Tamil" },
        { value: "te-IN", label: "Telugu" },
        { value: "kn-IN", label: "Kannada" },
      ],
    },
  ],
};

const KNOWLEDGE_BASE_SECTION: AgentConfigSection = {
  id: "knowledge",
  title: "Knowledge Base",
  description: "Attach shared knowledge sources this agent can answer from. Knowledge bases are global — the same one can back multiple agents.",
  fields: [
    {
      key: "knowledgeBaseIds",
      label: "Knowledge bases",
      type: "kb-select",
      helpText: "Select any existing knowledge bases, or create a new one from the Knowledge Base page.",
    },
  ],
};

// Role-specific extra fields, inserted as their own section after Behavior.
const ROLE_SPECIFIC_SECTIONS: Partial<Record<AgentRole, AgentConfigSection>> = {
  LEAD_QUALIFICATION: {
    id: "qualification",
    title: "Qualification Rules",
    fields: [
      {
        key: "qualificationCriteria",
        label: "Qualification questions / criteria",
        type: "textarea",
        required: true,
        placeholder: "Ask for: budget range, preferred program, city, highest qualification. Disqualify if under 17 years old.",
      },
      {
        key: "minQualificationScore",
        label: "Minimum score to mark as qualified",
        type: "number",
        defaultValue: 60,
      },
      {
        key: "handoffOnQualified",
        label: "Notify email on qualified lead",
        type: "email",
        placeholder: "counselors@yourcollege.edu",
      },
    ],
  },
  LEAD_TELECALLER: {
    id: "calling",
    title: "Calling Rules",
    fields: [
      {
        key: "maxCallAttempts",
        label: "Max call attempts per lead",
        type: "number",
        defaultValue: 3,
      },
      {
        key: "callScript",
        label: "Call opening script",
        type: "textarea",
        placeholder: "Hi, this is {{agent_name}} calling from {{org_name}} regarding your enquiry about {{program}}...",
      },
      {
        key: "bookingCalendarLink",
        label: "Demo/visit booking link",
        type: "url",
        placeholder: "https://cal.com/yourcollege/campus-visit",
      },
    ],
  },
  DOCUMENT_COLLECTION: {
    id: "documents",
    title: "Document Collection Rules",
    fields: [
      {
        key: "requiredDocumentTypes",
        label: "Required document types",
        type: "textarea",
        required: true,
        placeholder: "Aadhaar Card, 10th Marksheet, 12th Marksheet, Passport Photo",
      },
      {
        key: "reminderFrequencyDays",
        label: "Remind every (days) while pending",
        type: "number",
        defaultValue: 3,
      },
      {
        key: "uploadLinkTemplate",
        label: "Upload link template",
        type: "url",
        placeholder: "https://portal.yourcollege.edu/upload/{{student_id}}",
      },
    ],
  },
  PAYMENT_REMINDER: {
    id: "payments",
    title: "Reminder Schedule",
    fields: [
      {
        key: "reminderDaysBeforeDue",
        label: "Remind N days before due date",
        type: "number",
        defaultValue: 3,
      },
      {
        key: "reminderDaysAfterOverdue",
        label: "Follow up every N days once overdue",
        type: "number",
        defaultValue: 2,
      },
      {
        key: "escalateAfterDaysOverdue",
        label: "Escalate to staff after N days overdue",
        type: "number",
        defaultValue: 7,
      },
      {
        key: "paymentLinkTemplate",
        label: "Payment link template",
        type: "url",
        placeholder: "https://pay.yourcollege.edu/{{student_id}}/{{installment_id}}",
      },
    ],
  },
  INBOUND_CALL_RECEIVER: {
    id: "receptionist",
    title: "Reception Rules",
    fields: [
      {
        key: "greetingScript",
        label: "Greeting script",
        type: "textarea",
        placeholder: "Thank you for calling {{org_name}}, this is your admissions assistant...",
      },
      {
        key: "routingRules",
        label: "Call routing rules",
        type: "textarea",
        placeholder: "Admissions queries -> counselor team. Fee queries -> accounts. Everything else -> voicemail.",
      },
      {
        key: "fallbackTransferNumber",
        label: "Fallback transfer number",
        type: "tel",
        placeholder: "+91XXXXXXXXXX",
      },
    ],
  },
  REENGAGEMENT: {
    id: "winback",
    title: "Win-back Rules",
    fields: [
      {
        key: "reengageAfterDaysCold",
        label: "Re-engage after N days cold/inactive",
        type: "number",
        defaultValue: 14,
      },
      {
        key: "winBackOfferDetails",
        label: "Offer / scholarship to mention",
        type: "textarea",
        placeholder: "Early-bird scholarship of 10% if they enroll this month...",
      },
      {
        key: "maxWinBackAttempts",
        label: "Max win-back attempts",
        type: "number",
        defaultValue: 2,
      },
    ],
  },
  ONBOARDING: {
    id: "onboarding",
    title: "Orientation Details",
    fields: [
      {
        key: "orientationDetails",
        label: "Orientation schedule / details",
        type: "textarea",
        placeholder: "Orientation on {{orientation_date}} at {{campus_name}}, Block A, 9 AM.",
      },
      {
        key: "campusMapUrl",
        label: "Campus map link",
        type: "url",
      },
      {
        key: "cohortGroupInviteLink",
        label: "Cohort group invite link",
        type: "url",
        placeholder: "https://chat.whatsapp.com/...",
      },
    ],
  },
  SUPPORT_ESCALATION: {
    id: "support",
    title: "Escalation Routing",
    fields: [
      {
        key: "escalationDepartments",
        label: "Escalation contacts",
        type: "textarea",
        placeholder: "Accounts: accounts@yourcollege.edu\nAcademics: academics@yourcollege.edu",
      },
      {
        key: "escalationSlaMinutes",
        label: "Escalation SLA (minutes)",
        type: "number",
        defaultValue: 30,
      },
    ],
  },
  ALUMNI_REFERRAL: {
    id: "referral",
    title: "Referral Program",
    fields: [
      {
        key: "referralIncentiveAmount",
        label: "Referral incentive (₹)",
        type: "number",
        defaultValue: 2000,
      },
      {
        key: "referralTrackingLinkTemplate",
        label: "Referral tracking link template",
        type: "url",
        placeholder: "https://refer.yourcollege.edu/{{alumni_id}}",
      },
      {
        key: "campaignMessage",
        label: "Campaign message",
        type: "textarea",
        placeholder: "Know someone who'd love our {{program}} program? Refer them and earn ₹{{amount}}!",
      },
    ],
  },
};

function channelSectionFor(role: AgentRole): AgentConfigSection {
  switch (role) {
    case "LEAD_QUALIFICATION":
    case "DOCUMENT_COLLECTION":
    case "PAYMENT_REMINDER":
    case "REENGAGEMENT":
    case "ONBOARDING":
    case "ALUMNI_REFERRAL":
    case "WHATSAPP_NURTURE":
      return WHATSAPP_CHANNEL_SECTION;
    case "LEAD_TELECALLER":
    case "INBOUND_CALL_RECEIVER":
    case "SUPPORT_ESCALATION":
    case "INTERVIEW_SCREENING":
      return VOICE_CHANNEL_SECTION;
    case "COUNSELLOR":
      return WEBSITE_CHAT_CHANNEL_SECTION;
    default:
      return WHATSAPP_CHANNEL_SECTION;
  }
}

export function getAgentConfigSchema(role: AgentRole): AgentConfigSection[] {
  const sections: AgentConfigSection[] = [channelSectionFor(role), BEHAVIOR_SECTION];
  const roleSpecific = ROLE_SPECIFIC_SECTIONS[role];
  if (roleSpecific) sections.push(roleSpecific);
  sections.push(KNOWLEDGE_BASE_SECTION);
  return sections;
}

// Every field key across every section that should be encrypted at rest.
export function getSecretFieldKeys(role: AgentRole): string[] {
  return getAgentConfigSchema(role)
    .flatMap((s) => s.fields)
    .filter((f) => f.secret)
    .map((f) => f.key);
}
