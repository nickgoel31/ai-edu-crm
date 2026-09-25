// Real, provider-specific payload parsers for the "simple" lead webhooks.
// Each provider sends a genuinely different JSON shape; the previous
// implementation flattened all of them into one generic
// name/phone/email/message guesser, which silently drops most of what
// these providers actually send (call duration/recording, query type,
// campaign IDs, etc). These parsers understand the real, documented
// payload for each provider and normalize it into ParsedLead.

export interface ParsedLead {
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  program?: string;
  metadata: Record<string, any>;
}

function str(v: any): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

function firstDefined(body: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = str(body[key]);
    if (value) return value;
  }
  return undefined;
}

/**
 * Call tracking / telephony CDR webhooks. Covers the field-naming
 * conventions actually used by Exotel, Knowlarity, MyOperator, CloudTalk,
 * and Twilio-style CDR posts — they disagree on field names but describe
 * the same call: caller, callee, direction, duration, recording, status.
 */
export function parseCallTrackingPayload(body: Record<string, any>): ParsedLead {
  const callerPhone = firstDefined(body, [
    "CallFrom", "caller_id", "callerNumber", "caller_number", "from", "From",
    "customer_number", "customerNumber", "src", "ani",
  ]);
  const calledNumber = firstDefined(body, [
    "CallTo", "called_number", "calledNumber", "to", "To", "virtual_number", "dst",
  ]);
  const direction = (firstDefined(body, ["Direction", "direction", "call_type"]) || "inbound").toLowerCase();
  const status = firstDefined(body, ["Status", "DialCallStatus", "call_status", "status"]);
  const durationSeconds = firstDefined(body, ["CallDuration", "duration", "call_duration", "Duration"]);
  const recordingUrl = firstDefined(body, ["RecordingUrl", "recording_url", "recordingUrl", "CallRecordingURL"]);
  const callerName = firstDefined(body, ["caller_name", "callerName", "CallerName"]);

  return {
    name: callerName || `Caller (${(callerPhone || "").slice(-4) || "Unknown"})`,
    phone: callerPhone,
    message: recordingUrl ? `Call recording: ${recordingUrl}` : undefined,
    metadata: {
      provider: "call_tracking",
      direction,
      status,
      durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      recordingUrl,
      calledNumber,
    },
  };
}

/**
 * IndiaMART Lead Manager push API. Field names are fixed, ALL_CAPS with
 * underscores — this is IndiaMART's actual documented webhook contract,
 * not a generic form shape.
 * https://seller.indiamart.com (Lead Manager API push notification)
 */
export function parseIndiaMartPayload(body: Record<string, any>): ParsedLead {
  const name = firstDefined(body, ["SENDER_NAME", "senderName"]);
  const phone = firstDefined(body, ["SENDER_MOBILE", "SENDER_PHONE", "senderMobile"]);
  const email = firstDefined(body, ["SENDER_EMAIL", "senderEmail"]);
  const message = firstDefined(body, ["QUERY_MESSAGE", "queryMessage"]);
  const subject = firstDefined(body, ["SUBJECT", "subject"]);
  const company = firstDefined(body, ["SENDER_COMPANY", "senderCompany"]);
  const city = firstDefined(body, ["SENDER_CITY", "senderCity"]);
  const queryType = firstDefined(body, ["QUERY_TYPE", "queryType"]);
  const uniqueQueryId = firstDefined(body, ["UNIQUE_QUERY_ID", "uniqueQueryId"]);

  return {
    name: name || "IndiaMART Enquiry",
    phone,
    email,
    message: message || subject,
    program: subject,
    metadata: {
      provider: "indiamart",
      company,
      city,
      queryType,
      uniqueQueryId,
    },
  };
}

/**
 * LinkedIn Lead Gen Forms. LinkedIn's native Lead Sync webhook only sends
 * URNs (leadId/formId) that require a follow-up authenticated API call to
 * resolve into field values, so in practice this endpoint receives either
 * that raw notification shape, or the already-resolved field array a
 * relay (Zapier/Make/LeadsBridge) produces from it. This parser handles
 * both: LinkedIn's own `formResponse.answers[]` structure (question/answer
 * pairs keyed by field name) and a flat, already-resolved object.
 */
export function parseLinkedInLeadGenPayload(body: Record<string, any>): ParsedLead {
  const answers: Record<string, string> = {};

  const formResponse = body.formResponse || body.form_response;
  if (formResponse && Array.isArray(formResponse.answers)) {
    for (const a of formResponse.answers) {
      const key = (a.question || a.fieldName || a.field_name || "").toString().toLowerCase();
      const value = str(a.answer) || str(a.value);
      if (key && value) answers[key] = value;
    }
  }
  // Facebook/LinkedIn-style field_data[] fallback, as sent by several relays.
  if (Array.isArray(body.field_data)) {
    for (const f of body.field_data) {
      // field_data names are conventionally snake_case ("full_name"),
      // unlike formResponse.answers' human labels ("Full Name") — normalize
      // both to the same "space-separated lowercase" key shape.
      const key = (f.name || "").toString().toLowerCase().replace(/_/g, " ");
      const value = Array.isArray(f.values) ? str(f.values[0]) : str(f.value);
      if (key && value) answers[key] = value;
    }
  }

  const firstName = answers["first name"] || answers["firstname"] || firstDefined(body, ["firstName", "first_name"]);
  const lastName = answers["last name"] || answers["lastname"] || firstDefined(body, ["lastName", "last_name"]);
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const name = composedName || answers["full name"] || firstDefined(body, ["name", "fullName"]) || "LinkedIn Lead";
  const phone = answers["phone number"] || answers["phone"] || firstDefined(body, ["phoneNumber", "phone"]);
  const email = answers["email address"] || answers["email"] || firstDefined(body, ["email", "workEmail"]);
  const company = answers["company name"] || answers["company"] || firstDefined(body, ["companyName", "company"]);
  const jobTitle = answers["job title"] || answers["title"] || firstDefined(body, ["jobTitle", "title"]);

  return {
    name,
    phone,
    email,
    message: jobTitle && company ? `${jobTitle} at ${company}` : undefined,
    metadata: {
      provider: "linkedin_lead_gen",
      leadId: body.leadId || body.lead_id,
      formId: body.formId || body.form_id,
      campaignId: body.sponsoredCampaignId || body.campaignId,
      company,
      jobTitle,
    },
  };
}

/**
 * Google Ads Lead Form extensions webhook. Google's documented payload:
 * a flat "google_key" for source verification plus a `user_column_data`
 * array of {column_id, string_value} pairs (COLUMN_USER_INPUT ids like
 * FULL_NAME/PHONE_NUMBER/EMAIL, or CALL_TRACKING_ONLY_PHONE_CALL for
 * call-only forms).
 * https://developers.google.com/google-ads/webpush/docs/lead-form
 */
export function parseGoogleAdsLeadFormPayload(body: Record<string, any>): ParsedLead {
  const columns: Record<string, string> = {};
  const columnData = body.user_column_data || body.userColumnData;
  if (Array.isArray(columnData)) {
    for (const col of columnData) {
      const id = (col.column_id || col.columnId || "").toString().toUpperCase();
      const value = str(col.string_value) || str(col.stringValue);
      if (id && value) columns[id] = value;
    }
  }

  const name = columns["FULL_NAME"] || [columns["FIRST_NAME"], columns["LAST_NAME"]].filter(Boolean).join(" ") || "Google Ads Lead";
  const phone = columns["PHONE_NUMBER"] || columns["CALL_TRACKING_ONLY_PHONE_CALL"];
  const email = columns["EMAIL"];
  const city = columns["CITY"];
  const program = columns["POST_LEAD_FORM_QUESTION"] || columns["CUSTOM_QUESTION"];

  return {
    name: name.trim() || "Google Ads Lead",
    phone,
    email,
    program,
    metadata: {
      provider: "google_ads_lead_form",
      formId: body.form_id || body.formId,
      campaignId: body.campaign_id || body.campaignId,
      gclId: body.gcl_id || body.gclId,
      googleKey: body.google_key || body.googleKey,
      city,
      allColumns: columns,
    },
  };
}
