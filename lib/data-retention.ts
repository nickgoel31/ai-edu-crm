import { prisma } from "@/lib/prisma";

/**
 * Full personal-data export for an organization — the data-portability half
 * of a GDPR/DPDP request. Covers every entity that holds an individual's
 * (lead/student/alumni) personal data. Org settings, agents, and audit logs
 * are intentionally excluded: they're the institution's own operational and
 * compliance records, not the data subject's personal data.
 */
export async function exportOrganizationPersonalData(organizationId: string) {
  const [leads, students, conversations, activities, duplicateMatches] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId } }),
    prisma.student.findMany({
      where: { organizationId },
      include: { documents: true, payments: true },
    }),
    prisma.conversation.findMany({
      where: { agent: { organizationId } },
      select: {
        id: true,
        agentId: true,
        leadId: true,
        studentId: true,
        channel: true,
        transcript: true,
        outcome: true,
        createdAt: true,
      },
    }),
    prisma.activity.findMany({ where: { organizationId } }),
    prisma.duplicateMatch.findMany({ where: { organizationId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organizationId,
    counts: {
      leads: leads.length,
      students: students.length,
      conversations: conversations.length,
      activities: activities.length,
      duplicateMatches: duplicateMatches.length,
    },
    leads,
    students,
    conversations,
    activities,
    duplicateMatches,
  };
}

export interface ErasureResult {
  conversations: number;
  payments: number;
  documents: number;
  students: number;
  leads: number;
  activities: number;
  duplicateMatches: number;
}

/**
 * Permanently erases an organization's personal data (leads, students, and
 * every record derived from them — payments, documents, conversation
 * transcripts, activity timeline, duplicate matches). Irreversible.
 *
 * Intentionally NOT erased: Organization, Users, Agents, Integrations,
 * AuditLog. The org's own account/config isn't personal data, and audit
 * logs are the compliance record of what happened — including, after this
 * runs, the erasure itself — so they're kept regardless of a data-subject
 * erasure request, the same way most regulators expect a paper trail of
 * deletions to survive the deletion.
 */
export async function eraseOrganizationPersonalData(organizationId: string): Promise<ErasureResult> {
  const [conversations, payments, documents] = await prisma.$transaction([
    prisma.conversation.deleteMany({ where: { agent: { organizationId } } }),
    prisma.payment.deleteMany({ where: { student: { organizationId } } }),
    prisma.document.deleteMany({ where: { student: { organizationId } } }),
  ]);

  const [students, leads, activities, duplicateMatches] = await prisma.$transaction([
    prisma.student.deleteMany({ where: { organizationId } }),
    prisma.lead.deleteMany({ where: { organizationId } }),
    prisma.activity.deleteMany({ where: { organizationId } }),
    prisma.duplicateMatch.deleteMany({ where: { organizationId } }),
  ]);

  return {
    conversations: conversations.count,
    payments: payments.count,
    documents: documents.count,
    students: students.count,
    leads: leads.count,
    activities: activities.count,
    duplicateMatches: duplicateMatches.count,
  };
}
