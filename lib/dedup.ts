import { prisma } from "@/lib/prisma";
import { DuplicateMatchStatus } from "@/types";

/**
 * Normalizes raw phone numbers for consistent deduplication.
 * e.g., "+91 98201-23456" -> "+919820123456"
 * "09820123456" -> "9820123456"
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Generate variations to match phone numbers with or without country code.
 */
export function getPhoneSearchVariations(phone: string): string[] {
  if (!phone) return [];
  const rawTrimmed = phone.trim();
  const cleaned = normalizePhoneNumber(phone);
  const digitsOnly = cleaned.replace(/\D/g, "");
  const variations = new Set<string>([rawTrimmed, cleaned, digitsOnly]);

  const local10 =
    digitsOnly.length === 12 && digitsOnly.startsWith("91")
      ? digitsOnly.slice(2)
      : digitsOnly.length === 10
      ? digitsOnly
      : null;

  if (local10) {
    variations.add(local10);
    variations.add("+91" + local10);
    variations.add("91" + local10);
    variations.add(`+91 ${local10.slice(0, 5)} ${local10.slice(5)}`);
    variations.add(`+91 ${local10}`);
    variations.add(`${local10.slice(0, 5)} ${local10.slice(5)}`);
    variations.add(`${local10.slice(0, 5)}-${local10.slice(5)}`);
  }

  return Array.from(variations).filter(Boolean);
}

/**
 * Find existing matching Lead in the same organization by phone or email.
 */
export async function findExistingLeadMatch(
  organizationId: string,
  phone: string,
  currentLeadId?: string,
  email?: string,
  client: any = prisma
) {
  const phoneVariations = getPhoneSearchVariations(phone);
  if (phoneVariations.length === 0 && !email) return null;

  const conditions: any[] = [];
  if (phoneVariations.length > 0) {
    conditions.push({ phone: { in: phoneVariations } });
  }
  if (email && email.trim()) {
    conditions.push({ email: { equals: email.trim() } });
  }

  const existing = await client.lead.findFirst({
    where: {
      organizationId,
      isArchived: false,
      ...(currentLeadId ? { id: { not: currentLeadId } } : {}),
      OR: conditions,
    },
    orderBy: { createdAt: "asc" }, // Primary is the earliest created record
  });

  return existing;
}

/**
 * Find existing matching Student in the same organization by phone or email.
 */
export async function findExistingStudentMatch(
  organizationId: string,
  phone: string,
  currentStudentId?: string,
  email?: string,
  client: any = prisma
) {
  const phoneVariations = getPhoneSearchVariations(phone);
  if (phoneVariations.length === 0 && !email) return null;

  const conditions: any[] = [];
  if (phoneVariations.length > 0) {
    conditions.push({ phone: { in: phoneVariations } });
  }
  if (email && email.trim()) {
    conditions.push({ email: { equals: email.trim() } });
  }

  const existing = await client.student.findFirst({
    where: {
      organizationId,
      isArchived: false,
      ...(currentStudentId ? { id: { not: currentStudentId } } : {}),
      OR: conditions,
    },
    orderBy: { createdAt: "asc" }, // Primary is the earliest created record
  });

  return existing;
}

/**
 * Checks for existing lead and creates a PENDING DuplicateMatch if found.
 */
export async function checkAndCreateLeadDuplicateMatch({
  organizationId,
  newLeadId,
  phone,
  email,
  client = prisma,
}: {
  organizationId: string;
  newLeadId: string;
  phone: string;
  email?: string;
  client?: any;
}) {
  const primaryLead = await findExistingLeadMatch(
    organizationId,
    phone,
    newLeadId,
    email,
    client
  );

  if (!primaryLead) return null;

  // Check matchedOn attribute
  const normalizedNewPhone = normalizePhoneNumber(phone);
  const normalizedPrimaryPhone = normalizePhoneNumber(primaryLead.phone);
  const phoneMatch =
    normalizedNewPhone &&
    normalizedPrimaryPhone &&
    (normalizedNewPhone === normalizedPrimaryPhone ||
      getPhoneSearchVariations(normalizedNewPhone).includes(primaryLead.phone));
  const matchedOn = phoneMatch ? "phone" : "email";

  // Upsert or create DuplicateMatch
  const duplicateMatch = await client.duplicateMatch.upsert({
    where: {
      organizationId_entityType_primaryEntityId_duplicateEntityId: {
        organizationId,
        entityType: "LEAD",
        primaryEntityId: primaryLead.id,
        duplicateEntityId: newLeadId,
      },
    },
    update: {
      status: DuplicateMatchStatus.PENDING,
      matchedOn,
    },
    create: {
      organizationId,
      entityType: "LEAD",
      primaryEntityId: primaryLead.id,
      duplicateEntityId: newLeadId,
      matchedOn,
      status: DuplicateMatchStatus.PENDING,
    },
  });

  return { duplicateMatch, primaryLead };
}

/**
 * Checks for existing student and creates a PENDING DuplicateMatch if found.
 */
export async function checkAndCreateStudentDuplicateMatch({
  organizationId,
  newStudentId,
  phone,
  email,
  client = prisma,
}: {
  organizationId: string;
  newStudentId: string;
  phone: string;
  email?: string;
  client?: any;
}) {
  const primaryStudent = await findExistingStudentMatch(
    organizationId,
    phone,
    newStudentId,
    email,
    client
  );

  if (!primaryStudent) return null;

  const normalizedNewPhone = normalizePhoneNumber(phone);
  const normalizedPrimaryPhone = normalizePhoneNumber(primaryStudent.phone);
  const phoneMatch =
    normalizedNewPhone &&
    normalizedPrimaryPhone &&
    (normalizedNewPhone === normalizedPrimaryPhone ||
      getPhoneSearchVariations(normalizedNewPhone).includes(primaryStudent.phone));
  const matchedOn = phoneMatch ? "phone" : "email";

  const duplicateMatch = await client.duplicateMatch.upsert({
    where: {
      organizationId_entityType_primaryEntityId_duplicateEntityId: {
        organizationId,
        entityType: "STUDENT",
        primaryEntityId: primaryStudent.id,
        duplicateEntityId: newStudentId,
      },
    },
    update: {
      status: DuplicateMatchStatus.PENDING,
      matchedOn,
    },
    create: {
      organizationId,
      entityType: "STUDENT",
      primaryEntityId: primaryStudent.id,
      duplicateEntityId: newStudentId,
      matchedOn,
      status: DuplicateMatchStatus.PENDING,
    },
  });

  return { duplicateMatch, primaryStudent };
}
