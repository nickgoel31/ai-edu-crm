import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertAdmin } from "@/lib/rbac";
import { StudentStage } from "@/types";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export async function GET(
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
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: "asc" },
        },
        payments: {
          orderBy: { installmentNumber: "asc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            source: true,
            stage: true,
            score: true,
            createdAt: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student record not found in this organization." },
        { status: 404 }
      );
    }

    // Fetch conversations related to this student (linked directly, or linked to originating lead)
    const conversationOr: any[] = [{ studentId: id }];
    if (student.leadId) {
      conversationOr.push({ leadId: student.leadId });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: conversationOr,
      },
      orderBy: { createdAt: "desc" },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            channel: true,
            role: true,
          },
        },
        claimedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Fetch audit logs for this specific student
    const auditLogs = await scopedDb.auditLog.findMany({
      where: {
        entityType: "Student",
        entityId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch document template for this program (if exists)
    const [documentTemplate, customFieldDefinitions, customFieldValues, entityTags, allTags] = await Promise.all([
      scopedDb.documentTemplate.findFirst({
        where: { program: student.program },
      }),
      scopedDb.customFieldDefinition.findMany({
        where: {
          entityType: "STUDENT",
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      scopedDb.customFieldValue.findMany({
        where: {
          entityType: "STUDENT",
          entityId: id,
        },
        include: {
          fieldDefinition: true,
        },
      }),
      scopedDb.entityTag.findMany({
        where: {
          entityType: "STUDENT",
          entityId: id,
        },
        include: {
          tag: true,
        },
      }),
      scopedDb.tag.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    const valuesByFieldKey: Record<string, any> = {};
    customFieldValues.forEach((v: any) => {
      let castValue: any = v.value;
      if (v.fieldDefinition?.fieldType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (v.fieldDefinition?.fieldType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        valuesByFieldKey[v.fieldDefinition.fieldKey] = castValue;
      }
    });

    const parsedDefinitions = customFieldDefinitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    const decryptedDocuments = (student.documents || []).map((doc: any) => ({
      ...doc,
      fileUrl: decryptField(doc.fileUrl),
    }));

    const tags = entityTags.map((et: any) => et.tag).filter(Boolean);

    return NextResponse.json({
      student: {
        ...student,
        customFields: valuesByFieldKey,
        documents: decryptedDocuments,
        tags,
      },
      tags,
      allTags,
      customFieldDefinitions: parsedDefinitions,
      customFieldValues: valuesByFieldKey,
      conversations,
      auditLogs,
      documentTemplate,
    });
  } catch (error: any) {
    console.error("Error fetching student details:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch student profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { id } = params;
    const body = await req.json();
    const { stage, cohort, branch, phone, email, name, program, customFields } = body;

    const scopedDb = getScopedPrismaClient(session);

    const existingStudent = await scopedDb.student.findUnique({
      where: { id },
    });

    if (!existingStudent) {
      return NextResponse.json(
        { error: "Student record not found." },
        { status: 404 }
      );
    }

    // Save custom fields if provided
    if (customFields && typeof customFields === "object") {
      const definitions = await scopedDb.customFieldDefinition.findMany({
        where: { entityType: "STUDENT" },
      });

      const defByKey = new Map<string, any>();
      const defById = new Map<string, any>();
      definitions.forEach((d) => {
        defByKey.set(d.fieldKey, d);
        defById.set(d.id, d);
      });

      for (const [key, val] of Object.entries(customFields)) {
        const def = defById.get(key) || defByKey.get(key);
        if (def) {
          const stringVal = val === null || val === undefined || val === "" ? null : String(val);
          const existingVal = await scopedDb.customFieldValue.findUnique({
            where: {
              fieldDefinitionId_entityId: {
                fieldDefinitionId: def.id,
                entityId: id,
              },
            },
          });

          if (existingVal) {
            await scopedDb.customFieldValue.update({
              where: { id: existingVal.id },
              data: { value: stringVal },
            });
          } else if (stringVal !== null) {
            await scopedDb.customFieldValue.create({
              data: {
                organizationId: session.user.organizationId,
                entityType: "STUDENT",
                entityId: id,
                fieldDefinitionId: def.id,
                value: stringVal,
              },
            });
          }
        }
      }
    }

    const updates: any = {};
    const auditChanges: Record<string, { from: any; to: any }> = {};

    if (stage && Object.values(StudentStage).includes(stage) && stage !== existingStudent.stage) {
      updates.stage = stage;
      auditChanges.stage = { from: existingStudent.stage, to: stage };
    }

    if (cohort && cohort.trim() !== existingStudent.cohort) {
      updates.cohort = cohort.trim();
      auditChanges.cohort = { from: existingStudent.cohort, to: cohort.trim() };
    }

    if (branch !== undefined && branch !== existingStudent.branch) {
      updates.branch = branch ? branch.trim() : null;
      auditChanges.branch = { from: existingStudent.branch, to: updates.branch };
    }

    if (phone && phone.trim() !== existingStudent.phone) {
      updates.phone = phone.trim();
      auditChanges.phone = { from: existingStudent.phone, to: phone.trim() };
    }

    if (email && email.trim().toLowerCase() !== existingStudent.email) {
      updates.email = email.trim().toLowerCase();
      auditChanges.email = { from: existingStudent.email, to: updates.email };
    }

    if (name && name.trim() !== existingStudent.name) {
      updates.name = name.trim();
      auditChanges.name = { from: existingStudent.name, to: name.trim() };
    }

    if (program && program.trim() !== existingStudent.program) {
      updates.program = program.trim();
      auditChanges.program = { from: existingStudent.program, to: program.trim() };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ student: existingStudent });
    }

    const updatedStudent = await scopedDb.student.update({
      where: { id },
      data: updates,
    });

    // If student stage changed to ENROLLED, dispatch outbound ERP sync
    if (updates.stage === StudentStage.ENROLLED) {
      const { syncStudentToErp } = await import("@/lib/erp-sync");
      syncStudentToErp({
        studentId: id,
        organizationId: session.user.organizationId,
      }).catch((err) => {
        console.error("Async ERP sync error on stage change:", err);
      });
    }

    // Write audit log if significant changes made
    if (Object.keys(auditChanges).length > 0) {
      await scopedDb.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: auditChanges.stage ? "STUDENT_STAGE_UPDATED" : "STUDENT_DETAILS_UPDATED",
          entityType: "Student",
          entityId: id,
          changesJson: JSON.stringify(auditChanges),
        },
      });
    }

    if (auditChanges.stage) {
      await logActivity({
        organizationId: session.user.organizationId,
        entityType: "STUDENT",
        entityId: id,
        type: "STAGE_CHANGE",
        metadata: {
          oldStage: auditChanges.stage.from,
          newStage: auditChanges.stage.to,
        },
      });
    }

    return NextResponse.json({ student: updatedStudent });
  } catch (error: any) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update student." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    assertAdmin(session);
    const { id } = params;
    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    await scopedDb.student.delete({
      where: { id },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "STUDENT_DELETED",
        entityType: "Student",
        entityId: id,
        changesJson: JSON.stringify({ deletedStudentName: student.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete student." },
      { status: 500 }
    );
  }
}
