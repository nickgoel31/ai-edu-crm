import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { StudentStage, LeadStage, DocumentStatus } from "@/types";
import { checkAndCreateStudentDuplicateMatch } from "@/lib/dedup";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
    const { id: leadId } = params;
    const body = await req.json();
    const { program, cohort, branch, stage, initialPaymentAmount, paymentDueDate, customFields } = body;

    if (!program?.trim()) {
      return NextResponse.json(
        { error: "Program is required for conversion." },
        { status: 400 }
      );
    }

    if (!cohort?.trim()) {
      return NextResponse.json(
        { error: "Cohort is required for conversion." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Fetch the lead
    const lead = await scopedDb.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    // Look up document template requirements for this program if configured
    const template = await scopedDb.documentTemplate.findUnique({
      where: {
        organizationId_program: {
          organizationId: session.user.organizationId,
          program: program.trim(),
        },
      },
    });

    const initialDocs: { name: string; status: string }[] = [];
    if (template && template.requiredDocuments) {
      let docNames: string[] = [];
      try {
        docNames = typeof template.requiredDocuments === "string" ? JSON.parse(template.requiredDocuments) : (Array.isArray(template.requiredDocuments) ? template.requiredDocuments : []);
      } catch {
        docNames = [];
      }
      for (const docName of docNames) {
        initialDocs.push({
          name: docName,
          status: DocumentStatus.PENDING,
        });
      }
    }

    // Default required documents if no template matches
    if (initialDocs.length === 0) {
      initialDocs.push(
        { name: "Aadhaar Card / ID Proof", status: DocumentStatus.PENDING },
        { name: "Academic Marksheet / Degree", status: DocumentStatus.PENDING },
        { name: "Passport Photo", status: DocumentStatus.PENDING }
      );
    }

    // Create student
    const student = await scopedDb.student.create({
      data: {
        organizationId: session.user.organizationId,
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        program: program.trim(),
        cohort: cohort.trim(),
        branch: branch?.trim() || null,
        stage: stage || StudentStage.ENROLLED,
        documents: {
          create: initialDocs,
        },
        ...(initialPaymentAmount && Number(initialPaymentAmount) > 0
          ? {
              payments: {
                create: [
                  {
                    installmentNumber: 1,
                    amount: Number(initialPaymentAmount),
                    status: "PENDING",
                    dueDate: paymentDueDate ? new Date(paymentDueDate) : new Date(),
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        documents: true,
        payments: true,
      },
    });

    // Run deduplication check against existing students
    const duplicateResult = await checkAndCreateStudentDuplicateMatch({
      organizationId: session.user.organizationId,
      newStudentId: student.id,
      phone: student.phone,
      email: student.email,
      client: scopedDb,
    });

    // Save student custom fields if provided
    if (customFields && typeof customFields === "object") {
      const definitions = await scopedDb.customFieldDefinition.findMany({
        where: { entityType: "STUDENT" },
      });

      const defByKey = new Map<string, any>();
      definitions.forEach((d) => defByKey.set(d.fieldKey, d));

      for (const [key, val] of Object.entries(customFields)) {
        const def = defByKey.get(key);
        if (def && val !== undefined && val !== null && val !== "") {
          await scopedDb.customFieldValue.create({
            data: {
              organizationId: session.user.organizationId,
              entityType: "STUDENT",
              entityId: student.id,
              fieldDefinitionId: def.id,
              value: String(val),
            },
          });
        }
      }
    }

    // Update Lead stage to CONVERTING
    await scopedDb.lead.update({
      where: { id: lead.id },
      data: {
        stage: LeadStage.CONVERTING,
      },
    });

    // Audit logs for both lead and student
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "LEAD_CONVERTED_TO_STUDENT",
        entityType: "Lead",
        entityId: lead.id,
        changesJson: JSON.stringify({
          convertedToStudentId: student.id,
          program: student.program,
          cohort: student.cohort,
          branch: student.branch,
        }),
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "STUDENT_ENROLLED_FROM_LEAD",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          originatingLeadId: lead.id,
          leadName: lead.name,
          program: student.program,
          cohort: student.cohort,
          initialDocumentsCount: initialDocs.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      studentId: student.id,
      student,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error converting lead to student:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to convert lead to student." },
      { status: 500 }
    );
  }
}
