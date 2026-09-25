export type UserRole = "ADMIN" | "COUNSELOR" | "READONLY";

export const Role = {
  ADMIN: "ADMIN",
  COUNSELOR: "COUNSELOR",
  READONLY: "READONLY",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const LeadSource = {
  META_ADS: "META_ADS",
  WHATSAPP: "WHATSAPP",
  GOOGLE_SHEETS: "GOOGLE_SHEETS",
  GOOGLE_ADS: "GOOGLE_ADS",
  WEBSITE_FORM: "WEBSITE_FORM",
  CSV_IMPORT: "CSV_IMPORT",
  CALL_TRACKING: "CALL_TRACKING",
  REFERRAL: "REFERRAL",
  LINKEDIN_LEAD_GEN: "LINKEDIN_LEAD_GEN",
  ZAPIER: "ZAPIER",
  INDIAMART: "INDIAMART",
  CUSTOM_API: "CUSTOM_API",
  MANUAL: "MANUAL",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStage = {
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
  CONVERTING: "CONVERTING",
  LOST: "LOST",
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

export const StudentStage = {
  ENQUIRY: "ENQUIRY",
  ENROLLED: "ENROLLED",
  ACTIVE: "ACTIVE",
  ALUMNI: "ALUMNI",
} as const;
export type StudentStage = (typeof StudentStage)[keyof typeof StudentStage];

export const DocumentStatus = {
  PENDING: "PENDING",
  RECEIVED: "RECEIVED",
  VERIFIED: "VERIFIED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AgentChannel = {
  VOICE: "VOICE",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  WEBSITE_CHAT: "WEBSITE_CHAT",
} as const;
export type AgentChannel = (typeof AgentChannel)[keyof typeof AgentChannel];

export const AgentStatus = {
  LIVE: "LIVE",
  PAUSED: "PAUSED",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const AgentRole = {
  INBOUND_CALL_RECEIVER: "INBOUND_CALL_RECEIVER",
  LEAD_TELECALLER: "LEAD_TELECALLER",
  WHATSAPP_NURTURE: "WHATSAPP_NURTURE",
  EMAIL_NURTURE: "EMAIL_NURTURE",
  COUNSELLOR: "COUNSELLOR",
  LEAD_QUALIFICATION: "LEAD_QUALIFICATION",
  REENGAGEMENT: "REENGAGEMENT",
  INTERVIEW_SCREENING: "INTERVIEW_SCREENING",
  DOCUMENT_COLLECTION: "DOCUMENT_COLLECTION",
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  ONBOARDING: "ONBOARDING",
  SUPPORT_ESCALATION: "SUPPORT_ESCALATION",
  FEEDBACK_NPS: "FEEDBACK_NPS",
  ALUMNI_REFERRAL: "ALUMNI_REFERRAL",
} as const;
export type AgentRole = (typeof AgentRole)[keyof typeof AgentRole];

export const AgentCategory = {
  ACQUISITION_NURTURE: "ACQUISITION_NURTURE",
  CONVERSION: "CONVERSION",
  STUDENT_OPS: "STUDENT_OPS",
  GROWTH_RETENTION: "GROWTH_RETENTION",
} as const;
export type AgentCategory = (typeof AgentCategory)[keyof typeof AgentCategory];

// Maps each functional role to its default channel, category, and a
// human-readable label. Used for seeding and for grouping the dashboard.
export const AGENT_ROLE_META: Record<
  AgentRole,
  { label: string; category: AgentCategory; channel: AgentChannel }
> = {
  INBOUND_CALL_RECEIVER: { label: "Inbound AI Receptionist", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.VOICE },
  LEAD_TELECALLER: { label: "Lead Auto Caller", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.VOICE },
  WHATSAPP_NURTURE: { label: "WhatsApp Nurture", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.WHATSAPP },
  EMAIL_NURTURE: { label: "Email Nurture", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.EMAIL },
  REENGAGEMENT: { label: "Cold Lead Win-back Agent", category: AgentCategory.CONVERSION, channel: AgentChannel.WHATSAPP },
  LEAD_QUALIFICATION: { label: "WhatsApp Lead Qualification Agent", category: AgentCategory.CONVERSION, channel: AgentChannel.WHATSAPP },
  COUNSELLOR: { label: "Website Live Guide", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.WEBSITE_CHAT },
  INTERVIEW_SCREENING: { label: "Interview Screening", category: AgentCategory.CONVERSION, channel: AgentChannel.VOICE },
  DOCUMENT_COLLECTION: { label: "Document Collection Bot", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.WHATSAPP },
  PAYMENT_REMINDER: { label: "Fee Reminder Agent", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.WHATSAPP },
  ONBOARDING: { label: "Onboarding and Orientation Agent", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.WHATSAPP },
  SUPPORT_ESCALATION: { label: "Support Line Agent", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.VOICE },
  FEEDBACK_NPS: { label: "Feedback & NPS", category: AgentCategory.GROWTH_RETENTION, channel: AgentChannel.EMAIL },
  ALUMNI_REFERRAL: { label: "Alumni Referral Agent", category: AgentCategory.GROWTH_RETENTION, channel: AgentChannel.WHATSAPP },
};

export const AGENT_CATEGORY_LABELS: Record<AgentCategory, string> = {
  ACQUISITION_NURTURE: "Acquisition & Engagement",
  CONVERSION: "Conversion",
  STUDENT_OPS: "Student Operations",
  GROWTH_RETENTION: "Growth & Alumni",
};

// The curated set of 10 production-ready agent templates featured in the
// Agent Marketplace (app/agents/page.tsx). Older catalog roles (WHATSAPP_NURTURE,
// EMAIL_NURTURE, INTERVIEW_SCREENING, FEEDBACK_NPS) still work if an org already
// has one deployed, but are no longer offered as new marketplace listings.
export const AGENT_MARKETPLACE_ROLES: AgentRole[] = [
  AgentRole.INBOUND_CALL_RECEIVER,
  AgentRole.LEAD_TELECALLER,
  AgentRole.COUNSELLOR,
  AgentRole.LEAD_QUALIFICATION,
  AgentRole.REENGAGEMENT,
  AgentRole.DOCUMENT_COLLECTION,
  AgentRole.PAYMENT_REMINDER,
  AgentRole.ONBOARDING,
  AgentRole.SUPPORT_ESCALATION,
  AgentRole.ALUMNI_REFERRAL,
];

export const WhatsappProvider = {
  META_CLOUD_API: "META_CLOUD_API",
  THIRD_PARTY_BSP: "THIRD_PARTY_BSP",
} as const;
export type WhatsappProvider = (typeof WhatsappProvider)[keyof typeof WhatsappProvider];

export const VoiceProvider = {
  TWILIO: "TWILIO",
  EXOTEL: "EXOTEL",
  PLIVO: "PLIVO",
} as const;
export type VoiceProvider = (typeof VoiceProvider)[keyof typeof VoiceProvider];

export const AI_MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini (fast, low-cost)" },
  { value: "gpt-4o", label: "GPT-4o (higher quality)" },
  { value: "claude-3-5-haiku", label: "Claude 3.5 Haiku (fast, low-cost)" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (higher quality)" },
] as const;

export const AgentTriggerEvent = {
  LEAD_CREATED: "LEAD_CREATED",
  LEAD_STALE_NO_FOLLOWUP: "LEAD_STALE_NO_FOLLOWUP",
  LEAD_MARKED_LOST: "LEAD_MARKED_LOST",
  PAYMENT_DUE_SOON: "PAYMENT_DUE_SOON",
  PAYMENT_OVERDUE: "PAYMENT_OVERDUE",
  DOCUMENT_PENDING_STALE: "DOCUMENT_PENDING_STALE",
  STUDENT_ENROLLED: "STUDENT_ENROLLED",
  STUDENT_REACHED_ALUMNI: "STUDENT_REACHED_ALUMNI",
  CONVERSATION_ESCALATED_UNCLAIMED: "CONVERSATION_ESCALATED_UNCLAIMED",
} as const;
export type AgentTriggerEvent = (typeof AgentTriggerEvent)[keyof typeof AgentTriggerEvent];

// Which condition fields make sense for each event, and how to render/validate them.
// Events not listed here take no conditions (fires on every matching record).
export const AGENT_TRIGGER_EVENT_META: Record<
  AgentTriggerEvent,
  {
    label: string;
    description: string;
    entityType: "LEAD" | "STUDENT" | "CONVERSATION";
    conditionFields: Array<{ key: string; label: string; type: "number"; defaultValue: number; suffix?: string }>;
  }
> = {
  LEAD_CREATED: {
    label: "Lead Created",
    description: "Fires once when a new lead is added to the pipeline.",
    entityType: "LEAD",
    conditionFields: [],
  },
  LEAD_STALE_NO_FOLLOWUP: {
    label: "Lead Stale (No Follow-up)",
    description: "Fires when an assigned lead has had no activity for N+ days.",
    entityType: "LEAD",
    conditionFields: [{ key: "daysThreshold", label: "Days without follow-up", type: "number", defaultValue: 14, suffix: "days" }],
  },
  LEAD_MARKED_LOST: {
    label: "Lead Marked Lost",
    description: "Fires when a lead's stage changes to LOST.",
    entityType: "LEAD",
    conditionFields: [],
  },
  PAYMENT_DUE_SOON: {
    label: "Payment Due Soon",
    description: "Fires when a pending installment's due date is within N days.",
    entityType: "STUDENT",
    conditionFields: [{ key: "daysThreshold", label: "Days before due date", type: "number", defaultValue: 3, suffix: "days" }],
  },
  PAYMENT_OVERDUE: {
    label: "Payment Overdue",
    description: "Fires when an installment's status is OVERDUE.",
    entityType: "STUDENT",
    conditionFields: [],
  },
  DOCUMENT_PENDING_STALE: {
    label: "Document Pending (Stale)",
    description: "Fires when a required document has stayed PENDING for N+ days.",
    entityType: "STUDENT",
    conditionFields: [{ key: "daysThreshold", label: "Days pending", type: "number", defaultValue: 5, suffix: "days" }],
  },
  STUDENT_ENROLLED: {
    label: "Student Enrolled",
    description: "Fires when a student's stage changes to ENROLLED.",
    entityType: "STUDENT",
    conditionFields: [],
  },
  STUDENT_REACHED_ALUMNI: {
    label: "Student Reached Alumni",
    description: "Fires when a student's stage changes to ALUMNI.",
    entityType: "STUDENT",
    conditionFields: [],
  },
  CONVERSATION_ESCALATED_UNCLAIMED: {
    label: "Escalation Unclaimed",
    description: "Fires when an escalated conversation has stayed unclaimed for N+ minutes.",
    entityType: "CONVERSATION",
    conditionFields: [{ key: "minutesThreshold", label: "Minutes unclaimed", type: "number", defaultValue: 30, suffix: "min" }],
  },
};

// Suggested defaults shown to an admin on first visit to /settings/agent-triggers.
// Matched against seeded agents by role; the admin can accept as-is or edit before saving.
export const AGENT_TRIGGER_DEFAULT_SUGGESTIONS: Array<{
  role: AgentRole;
  triggerEvent: AgentTriggerEvent;
  conditions?: Record<string, number>;
}> = [
  { role: AgentRole.PAYMENT_REMINDER, triggerEvent: AgentTriggerEvent.PAYMENT_OVERDUE },
  { role: AgentRole.PAYMENT_REMINDER, triggerEvent: AgentTriggerEvent.PAYMENT_DUE_SOON, conditions: { daysThreshold: 3 } },
  { role: AgentRole.DOCUMENT_COLLECTION, triggerEvent: AgentTriggerEvent.DOCUMENT_PENDING_STALE, conditions: { daysThreshold: 5 } },
  { role: AgentRole.REENGAGEMENT, triggerEvent: AgentTriggerEvent.LEAD_STALE_NO_FOLLOWUP, conditions: { daysThreshold: 14 } },
  { role: AgentRole.ONBOARDING, triggerEvent: AgentTriggerEvent.STUDENT_ENROLLED },
  { role: AgentRole.ALUMNI_REFERRAL, triggerEvent: AgentTriggerEvent.STUDENT_REACHED_ALUMNI },
  { role: AgentRole.SUPPORT_ESCALATION, triggerEvent: AgentTriggerEvent.CONVERSATION_ESCALATED_UNCLAIMED, conditions: { minutesThreshold: 30 } },
];

export const ConversationOutcome = {
  CONTINUED: "CONTINUED",
  ESCALATED: "ESCALATED",
  CONVERTED: "CONVERTED",
  NO_RESPONSE: "NO_RESPONSE",
} as const;
export type ConversationOutcome = (typeof ConversationOutcome)[keyof typeof ConversationOutcome];

export const ActivityEntityType = {
  LEAD: "LEAD",
  STUDENT: "STUDENT",
} as const;
export type ActivityEntityType = (typeof ActivityEntityType)[keyof typeof ActivityEntityType];

export const ActivityType = {
  NOTE: "NOTE",
  CALL: "CALL",
  EMAIL: "EMAIL",
  STAGE_CHANGE: "STAGE_CHANGE",
  ASSIGNMENT_CHANGE: "ASSIGNMENT_CHANGE",
  DOCUMENT_UPDATE: "DOCUMENT_UPDATE",
  PAYMENT_UPDATE: "PAYMENT_UPDATE",
  AGENT_CONVERSATION: "AGENT_CONVERSATION",
  AGENT_TRIGGERED: "AGENT_TRIGGERED",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const IntegrationType = {
  META_ADS: "META_ADS",
  WHATSAPP: "WHATSAPP",
  GOOGLE_SHEETS: "GOOGLE_SHEETS",
  GOOGLE_ADS: "GOOGLE_ADS",
  WEBSITE_FORM: "WEBSITE_FORM",
  CSV_IMPORT: "CSV_IMPORT",
  CALL_TRACKING: "CALL_TRACKING",
  REFERRAL: "REFERRAL",
  LINKEDIN_LEAD_GEN: "LINKEDIN_LEAD_GEN",
  ZAPIER: "ZAPIER",
  INDIAMART: "INDIAMART",
  CUSTOM_API: "CUSTOM_API",
  ERP: "ERP",
} as const;
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType];

// A lead-ingestion channel is any IntegrationType except ERP (which syncs
// Student fee/attendance/exam data, not inbound leads).
export const LEAD_CHANNEL_TYPES: IntegrationType[] = [
  IntegrationType.META_ADS,
  IntegrationType.WHATSAPP,
  IntegrationType.GOOGLE_SHEETS,
  IntegrationType.GOOGLE_ADS,
  IntegrationType.WEBSITE_FORM,
  IntegrationType.CSV_IMPORT,
  IntegrationType.CALL_TRACKING,
  IntegrationType.REFERRAL,
  IntegrationType.LINKEDIN_LEAD_GEN,
  IntegrationType.ZAPIER,
  IntegrationType.INDIAMART,
  IntegrationType.CUSTOM_API,
];

export const IntegrationCategory = {
  AD_PLATFORMS: "AD_PLATFORMS",
  MESSAGING: "MESSAGING",
  FORMS_AND_REFERRAL: "FORMS_AND_REFERRAL",
  DATA_IMPORT: "DATA_IMPORT",
  AUTOMATION: "AUTOMATION",
} as const;
export type IntegrationCategory = (typeof IntegrationCategory)[keyof typeof IntegrationCategory];

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  AD_PLATFORMS: "Ad Platforms",
  MESSAGING: "Messaging",
  FORMS_AND_REFERRAL: "Forms & Referral",
  DATA_IMPORT: "Data Import",
  AUTOMATION: "Automation & Custom",
};

export const INTEGRATION_TYPE_META: Record<
  IntegrationType,
  { label: string; description: string; category: IntegrationCategory; leadSource: LeadSource | null }
> = {
  META_ADS: {
    label: "Meta Lead Ads",
    description: "Facebook & Instagram Lead Ads forms, pushed in real time via the Meta webhook.",
    category: IntegrationCategory.AD_PLATFORMS,
    leadSource: LeadSource.META_ADS,
  },
  GOOGLE_ADS: {
    label: "Google Ads Lead Forms",
    description: "Google Ads lead form extensions, forwarded via Zapier/Make or Google's own webhook connector.",
    category: IntegrationCategory.AD_PLATFORMS,
    leadSource: LeadSource.GOOGLE_ADS,
  },
  WHATSAPP: {
    label: "WhatsApp Business",
    description: "Inbound WhatsApp Business Cloud API messages captured as new leads.",
    category: IntegrationCategory.MESSAGING,
    leadSource: LeadSource.WHATSAPP,
  },
  CALL_TRACKING: {
    label: "Call Tracking",
    description: "Missed-call and IVR lead capture from providers like Exotel, Knowlarity, or CloudTalk.",
    category: IntegrationCategory.MESSAGING,
    leadSource: LeadSource.CALL_TRACKING,
  },
  WEBSITE_FORM: {
    label: "Website Forms",
    description: "Contact/enquiry forms on your website (Webflow, WordPress, custom HTML) via webhook.",
    category: IntegrationCategory.FORMS_AND_REFERRAL,
    leadSource: LeadSource.WEBSITE_FORM,
  },
  LINKEDIN_LEAD_GEN: {
    label: "LinkedIn Lead Gen Forms",
    description: "LinkedIn native lead generation forms, forwarded via Zapier/Make.",
    category: IntegrationCategory.FORMS_AND_REFERRAL,
    leadSource: LeadSource.LINKEDIN_LEAD_GEN,
  },
  REFERRAL: {
    label: "Referral Program",
    description: "Student/alumni referral links and forms — track who referred each new lead.",
    category: IntegrationCategory.FORMS_AND_REFERRAL,
    leadSource: LeadSource.REFERRAL,
  },
  INDIAMART: {
    label: "IndiaMART",
    description: "Inbound buy-leads from your IndiaMART seller account.",
    category: IntegrationCategory.FORMS_AND_REFERRAL,
    leadSource: LeadSource.INDIAMART,
  },
  GOOGLE_SHEETS: {
    label: "Google Sheets",
    description: "Scheduled sync from a shared Google Sheet of enquiries.",
    category: IntegrationCategory.DATA_IMPORT,
    leadSource: LeadSource.GOOGLE_SHEETS,
  },
  CSV_IMPORT: {
    label: "CSV Import",
    description: "One-off or recurring bulk upload of leads from a CSV file.",
    category: IntegrationCategory.DATA_IMPORT,
    leadSource: LeadSource.CSV_IMPORT,
  },
  ZAPIER: {
    label: "Zapier / Make",
    description: "A generic inbound webhook for any of the 6000+ apps on Zapier, Make, or Pabbly Connect.",
    category: IntegrationCategory.AUTOMATION,
    leadSource: LeadSource.ZAPIER,
  },
  CUSTOM_API: {
    label: "Custom API",
    description: "A generic authenticated webhook for any other source not listed here.",
    category: IntegrationCategory.AUTOMATION,
    leadSource: LeadSource.CUSTOM_API,
  },
  ERP: {
    label: "Enterprise ERP Sync",
    description: "Bi-directional student fee/attendance/exam sync with your campus ERP.",
    category: IntegrationCategory.AUTOMATION,
    leadSource: null,
  },
};

export const ErpSyncDirection = {
  OUTBOUND: "OUTBOUND",
  INBOUND: "INBOUND",
} as const;
export type ErpSyncDirection = (typeof ErpSyncDirection)[keyof typeof ErpSyncDirection];

export const ErpSyncStatus = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;
export type ErpSyncStatus = (typeof ErpSyncStatus)[keyof typeof ErpSyncStatus];

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface CurrentOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
}

export const CustomFieldEntityType = {
  LEAD: "LEAD",
  STUDENT: "STUDENT",
} as const;
export type CustomFieldEntityType = (typeof CustomFieldEntityType)[keyof typeof CustomFieldEntityType];

export const CustomFieldType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  DATE: "DATE",
  SELECT: "SELECT",
  BOOLEAN: "BOOLEAN",
} as const;
export type CustomFieldType = (typeof CustomFieldType)[keyof typeof CustomFieldType];

export interface CustomFieldDefinition {
  id: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null; // parsed options for SELECT
  required: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    values: number;
  };
}

export interface CustomFieldValue {
  id: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  entityId: string;
  fieldDefinitionId: string;
  value: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  fieldDefinition?: CustomFieldDefinition;
}

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    entityTags: number;
  };
}

export interface EntityTag {
  id: string;
  organizationId: string;
  entityType: "LEAD" | "STUDENT";
  entityId: string;
  tagId: string;
  createdAt: string | Date;
  tag?: Tag;
}

export const DuplicateMatchStatus = {
  PENDING: "PENDING",
  MERGED: "MERGED",
  DISMISSED: "DISMISSED",
} as const;
export type DuplicateMatchStatus = (typeof DuplicateMatchStatus)[keyof typeof DuplicateMatchStatus];

export interface DuplicateMatch {
  id: string;
  organizationId: string;
  entityType: "LEAD" | "STUDENT";
  primaryEntityId: string;
  duplicateEntityId: string;
  matchedOn: string;
  status: DuplicateMatchStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface HydratedDuplicateMatch extends DuplicateMatch {
  primaryEntity: any;
  duplicateEntity: any;
  primaryCustomFields?: Record<string, any>;
  duplicateCustomFields?: Record<string, any>;
  primaryTags?: Tag[];
  duplicateTags?: Tag[];
  customFieldDefinitions?: CustomFieldDefinition[];
}

export const ScoringOperator = {
  EQUALS: "EQUALS",
  NOT_EQUALS: "NOT_EQUALS",
  GREATER_THAN: "GREATER_THAN",
  LESS_THAN: "LESS_THAN",
  CONTAINS: "CONTAINS",
} as const;
export type ScoringOperator = (typeof ScoringOperator)[keyof typeof ScoringOperator];

export interface ScoringRule {
  id: string;
  organizationId: string;
  name: string;
  field: string;
  operator: ScoringOperator;
  value: string;
  points: number;
  enabled: boolean;
  displayOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  matchedCount?: number;
}

export interface ScoreBreakdownItem {
  ruleId: string;
  ruleName: string;
  field: string;
  points: number;
  matchedValue?: string | number | boolean;
  reason?: string;
}

export interface SLAPolicy {
  id: string;
  organizationId: string;
  source: string | null; // null represents default org-wide fallback
  respondWithinMinutes: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SLAComplianceSummary {
  totalLeadsWithSla: number;
  respondedWithinSlaCount: number;
  breachedSlaCount: number;
  pendingSlaCount: number;
  complianceRate: number; // 0 - 100 percentage
  avgFirstResponseMinutes: number | null;
  sourceBreakdown: Array<{
    source: string;
    total: number;
    respondedOnTime: number;
    breached: number;
    pending: number;
    complianceRate: number;
    respondWithinMinutes: number;
  }>;
}

export const PipelineStageBucket = {
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
  CONVERTING: "CONVERTING",
  LOST: "LOST",
} as const;
export type PipelineStageBucket = (typeof PipelineStageBucket)[keyof typeof PipelineStageBucket];

export interface PipelineStage {
  id: string;
  pipelineTemplateId: string;
  name: string;
  displayOrder: number;
  color: string;
  requiresReasonOnExit: boolean;
  mapsToBucket: PipelineStageBucket;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    leads: number;
  };
}

export interface PipelineTemplate {
  id: string;
  organizationId: string;
  name: string;
  program: string | null;
  isDefault: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  stages?: PipelineStage[];
  _count?: {
    stages: number;
  };
}

export const MessageTemplateChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
} as const;
export type MessageTemplateChannel = (typeof MessageTemplateChannel)[keyof typeof MessageTemplateChannel];

export interface MessageTemplate {
  id: string;
  organizationId: string;
  name: string;
  channel: MessageTemplateChannel;
  subject: string | null;
  body: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}
