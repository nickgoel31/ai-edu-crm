import { prisma } from "@/lib/prisma";

/**
 * Resolves merge fields in a template body/subject string.
 * Standard fields:
 *   {{lead.name}}, {{lead.phone}}, {{lead.email}}, {{lead.program}},
 *   {{lead.source}}, {{lead.stage}}, {{lead.counselor}}
 *   {{student.name}}, {{student.phone}}, {{student.email}},
 *   {{student.program}}, {{student.cohort}}, {{student.counselor}}
 *   {{custom.fieldKey}} — from CustomFieldValue records
 */
export async function resolveTemplate(
  body: string,
  subject: string | null | undefined,
  entityType: "LEAD" | "STUDENT",
  entityId: string,
  organizationId: string
): Promise<{ body: string; subject: string | null }> {
  const context = await buildContext(entityType, entityId, organizationId);
  return {
    body: interpolate(body, context),
    subject: subject ? interpolate(subject, context) : null,
  };
}

export async function buildContext(
  entityType: "LEAD" | "STUDENT",
  entityId: string,
  organizationId: string
): Promise<Record<string, string>> {
  const ctx: Record<string, string> = {};

  if (entityType === "LEAD") {
    const lead = await prisma.lead.findFirst({
      where: { id: entityId, organizationId },
      include: { assignedTo: true },
    });
    if (lead) {
      const prefix = "lead";
      ctx[`${prefix}.name`] = lead.name ?? "";
      ctx[`${prefix}.phone`] = lead.phone ?? "";
      ctx[`${prefix}.email`] = (lead as any).email ?? "";
      ctx[`${prefix}.program`] = (lead as any).program ?? "";
      ctx[`${prefix}.source`] = lead.source ?? "";
      ctx[`${prefix}.stage`] = lead.stage ?? "";
      ctx[`${prefix}.counselor`] =
        (lead.assignedTo as any)?.name ?? (lead.assignedTo as any)?.email ?? "";
    }
    // Custom field values
    const cfvs = await prisma.customFieldValue.findMany({
      where: { organizationId, entityType: "LEAD", entityId },
      include: { fieldDefinition: true },
    });
    for (const cfv of cfvs) {
      const key = (cfv.fieldDefinition as any)?.fieldKey;
      if (key) ctx[`custom.${key}`] = cfv.value ?? "";
    }
  } else if (entityType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { id: entityId, organizationId },
    });
    if (student) {
      const prefix = "student";
      ctx[`${prefix}.name`] = student.name ?? "";
      ctx[`${prefix}.phone`] = student.phone ?? "";
      ctx[`${prefix}.email`] = student.email ?? "";
      ctx[`${prefix}.program`] = student.program ?? "";
      ctx[`${prefix}.cohort`] = student.cohort ?? "";
      ctx[`${prefix}.counselor`] = ""; // Student model has no direct counselor relation
    }
    // Custom field values
    const cfvs = await prisma.customFieldValue.findMany({
      where: { organizationId, entityType: "STUDENT", entityId },
      include: { fieldDefinition: true },
    });
    for (const cfv of cfvs) {
      const key = (cfv.fieldDefinition as any)?.fieldKey;
      if (key) ctx[`custom.${key}`] = cfv.value ?? "";
    }
  }

  return ctx;
}

function interpolate(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    return trimmed in ctx ? ctx[trimmed] : match;
  });
}

/** List of all standard merge field keys for a given entity type */
export function getMergeFields(entityType: "LEAD" | "STUDENT") {
  if (entityType === "LEAD") {
    return [
      { label: "Lead Name", key: "{{lead.name}}" },
      { label: "Lead Phone", key: "{{lead.phone}}" },
      { label: "Lead Email", key: "{{lead.email}}" },
      { label: "Lead Program", key: "{{lead.program}}" },
      { label: "Lead Source", key: "{{lead.source}}" },
      { label: "Lead Stage", key: "{{lead.stage}}" },
      { label: "Counselor Name", key: "{{lead.counselor}}" },
    ];
  }
  return [
    { label: "Student Name", key: "{{student.name}}" },
    { label: "Student Phone", key: "{{student.phone}}" },
    { label: "Student Email", key: "{{student.email}}" },
    { label: "Student Program", key: "{{student.program}}" },
    { label: "Student Cohort", key: "{{student.cohort}}" },
    { label: "Counselor Name", key: "{{student.counselor}}" },
  ];
}
