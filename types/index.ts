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
  INBOUND_CALL_RECEIVER: { label: "Inbound Call Receiver", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.VOICE },
  LEAD_TELECALLER: { label: "Lead Telecaller", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.VOICE },
  WHATSAPP_NURTURE: { label: "WhatsApp Nurture", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.WHATSAPP },
  EMAIL_NURTURE: { label: "Email Nurture", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.EMAIL },
  REENGAGEMENT: { label: "Re-engagement", category: AgentCategory.ACQUISITION_NURTURE, channel: AgentChannel.WHATSAPP },
  LEAD_QUALIFICATION: { label: "Lead Qualification", category: AgentCategory.CONVERSION, channel: AgentChannel.VOICE },
  COUNSELLOR: { label: "Counsellor", category: AgentCategory.CONVERSION, channel: AgentChannel.WEBSITE_CHAT },
  INTERVIEW_SCREENING: { label: "Interview Screening", category: AgentCategory.CONVERSION, channel: AgentChannel.VOICE },
  DOCUMENT_COLLECTION: { label: "Document Collection", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.WHATSAPP },
  PAYMENT_REMINDER: { label: "Payment Reminder", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.WHATSAPP },
  ONBOARDING: { label: "Onboarding", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.EMAIL },
  SUPPORT_ESCALATION: { label: "Support Escalation", category: AgentCategory.STUDENT_OPS, channel: AgentChannel.VOICE },
  FEEDBACK_NPS: { label: "Feedback & NPS", category: AgentCategory.GROWTH_RETENTION, channel: AgentChannel.EMAIL },
  ALUMNI_REFERRAL: { label: "Alumni Referral", category: AgentCategory.GROWTH_RETENTION, channel: AgentChannel.WHATSAPP },
};

export const AGENT_CATEGORY_LABELS: Record<AgentCategory, string> = {
  ACQUISITION_NURTURE: "Acquisition & Nurture",
  CONVERSION: "Conversion",
  STUDENT_OPS: "Student Ops",
  GROWTH_RETENTION: "Growth & Retention",
};

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
  ERP: "ERP",
} as const;
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType];

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
