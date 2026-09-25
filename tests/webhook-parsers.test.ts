import { describe, it, expect } from "vitest";
import {
  parseCallTrackingPayload,
  parseIndiaMartPayload,
  parseLinkedInLeadGenPayload,
  parseGoogleAdsLeadFormPayload,
} from "@/lib/webhook-parsers";

describe("parseCallTrackingPayload", () => {
  it("extracts caller number and call metadata from a Twilio/Exotel-style CDR", () => {
    const parsed = parseCallTrackingPayload({
      CallFrom: "+919820123456",
      CallTo: "+912233445566",
      Direction: "inbound",
      DialCallStatus: "completed",
      CallDuration: "125",
      RecordingUrl: "https://recordings.example.com/abc.mp3",
    });
    expect(parsed.phone).toBe("+919820123456");
    expect(parsed.metadata.durationSeconds).toBe(125);
    expect(parsed.metadata.status).toBe("completed");
    expect(parsed.message).toContain("https://recordings.example.com/abc.mp3");
  });

  it("falls back to a generic caller name when none is given", () => {
    const parsed = parseCallTrackingPayload({ caller_number: "9876543210" });
    expect(parsed.name).toContain("3210");
  });
});

describe("parseIndiaMartPayload", () => {
  it("maps IndiaMART's real SENDER_*/QUERY_* field names", () => {
    const parsed = parseIndiaMartPayload({
      SENDER_NAME: "Rohit Kumar",
      SENDER_MOBILE: "9876543210",
      SENDER_EMAIL: "rohit@example.com",
      QUERY_MESSAGE: "Interested in Full Stack course",
      SENDER_COMPANY: "Acme Corp",
      UNIQUE_QUERY_ID: "Q123",
    });
    expect(parsed.name).toBe("Rohit Kumar");
    expect(parsed.phone).toBe("9876543210");
    expect(parsed.email).toBe("rohit@example.com");
    expect(parsed.message).toBe("Interested in Full Stack course");
    expect(parsed.metadata.uniqueQueryId).toBe("Q123");
  });
});

describe("parseLinkedInLeadGenPayload", () => {
  it("resolves formResponse.answers[] question/answer pairs", () => {
    const parsed = parseLinkedInLeadGenPayload({
      leadId: "lead_1",
      formId: "form_1",
      formResponse: {
        answers: [
          { question: "First Name", answer: "Priya" },
          { question: "Last Name", answer: "Singh" },
          { question: "Email Address", answer: "priya@example.com" },
          { question: "Phone Number", answer: "9123456780" },
        ],
      },
    });
    expect(parsed.name).toBe("Priya Singh");
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.phone).toBe("9123456780");
  });

  it("also handles a Facebook-style field_data[] relay shape", () => {
    const parsed = parseLinkedInLeadGenPayload({
      field_data: [
        { name: "full_name", values: ["Amit Shah"] },
        { name: "email", values: ["amit@example.com"] },
      ],
    });
    expect(parsed.name).toBe("Amit Shah");
    expect(parsed.email).toBe("amit@example.com");
  });
});

describe("parseGoogleAdsLeadFormPayload", () => {
  it("resolves user_column_data[] by column_id", () => {
    const parsed = parseGoogleAdsLeadFormPayload({
      google_key: "abc",
      form_id: "f1",
      campaign_id: "c1",
      user_column_data: [
        { column_id: "FULL_NAME", string_value: "Neha Verma" },
        { column_id: "PHONE_NUMBER", string_value: "9988776655" },
        { column_id: "EMAIL", string_value: "neha@example.com" },
      ],
    });
    expect(parsed.name).toBe("Neha Verma");
    expect(parsed.phone).toBe("9988776655");
    expect(parsed.email).toBe("neha@example.com");
    expect(parsed.metadata.formId).toBe("f1");
  });

  it("falls back to FIRST_NAME + LAST_NAME when FULL_NAME is absent", () => {
    const parsed = parseGoogleAdsLeadFormPayload({
      user_column_data: [
        { column_id: "FIRST_NAME", string_value: "Arjun" },
        { column_id: "LAST_NAME", string_value: "Mehta" },
      ],
    });
    expect(parsed.name).toBe("Arjun Mehta");
  });
});
