import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertModuleAccess } from "@/lib/rbac";
import { StudentStage, DocumentStatus, PaymentStatus } from "@/types";
import { normalizePhoneNumber, checkAndCreateStudentDuplicateMatch } from "@/lib/dedup";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertModuleAccess(session, "students");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const stage = searchParams.get("stage") as StudentStage | null;
    const cohort = searchParams.get("cohort")?.trim();
    const branch = searchParams.get("branch")?.trim();
    const program = searchParams.get("program")?.trim();
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const scopedDb = getScopedPrismaClient(session);

    // Build filter where clause
    const where: any = { isArchived: false };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (stage && Object.values(StudentStage).includes(stage)) {
      where.stage = stage;
    }

    if (cohort && cohort !== "all") {
      where.cohort = cohort;
    }

    if (branch && branch !== "all") {
      where.branch = branch;
    }

    if (program && program !== "all") {
      where.program = program;
    }

    // Build order by
    const orderBy: any = {};
    if (sortBy === "name") {
      orderBy.name = sortOrder;
    } else if (sortBy === "program") {
      orderBy.program = sortOrder;
    } else if (sortBy === "cohort") {
      orderBy.cohort = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [students, totalCount, allStudentsMetadata, customFieldDefinitions, customFieldValues, entityTags, allTags] = await Promise.all([
      scopedDb.student.findMany({
        where,
        orderBy,
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              status: true,
              fileUrl: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              dueDate: true,
              status: true,
              installmentNumber: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
              source: true,
              score: true,
            },
          },
        },
      }),
      scopedDb.student.count({ where }),
      scopedDb.student.findMany({
        select: {
          stage: true,
          cohort: true,
          branch: true,
          program: true,
        },
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
        },
        include: {
          fieldDefinition: true,
        },
      }),
      scopedDb.entityTag.findMany({
        where: {
          entityType: "STUDENT",
        },
        include: {
          tag: true,
        },
      }),
      scopedDb.tag.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    // Build value map by studentId -> { fieldKey: castValue }
    const valuesByStudentId: Record<string, Record<string, any>> = {};
    customFieldValues.forEach((v: any) => {
      if (!valuesByStudentId[v.entityId]) {
        valuesByStudentId[v.entityId] = {};
      }
      let castValue: any = v.value;
      if (v.fieldDefinition?.fieldType === "BOOLEAN") {
        castValue = v.value === "true" || v.value === "1";
      } else if (v.fieldDefinition?.fieldType === "NUMBER") {
        castValue = v.value !== null && v.value !== "" ? Number(v.value) : null;
      }
      if (v.fieldDefinition?.fieldKey) {
        valuesByStudentId[v.entityId][v.fieldDefinition.fieldKey] = castValue;
      }
    });

    // Build tags map by studentId -> Tag[]
    const tagsByStudentId: Record<string, any[]> = {};
    entityTags.forEach((et: any) => {
      if (!tagsByStudentId[et.entityId]) {
        tagsByStudentId[et.entityId] = [];
      }
      if (et.tag) {
        tagsByStudentId[et.entityId].push(et.tag);
      }
    });

    // Calculate stage counts & filter options across tenant
    const stageCounts: Record<string, number> = {
      ALL: allStudentsMetadata.length,
      ENQUIRY: 0,
      ENROLLED: 0,
      ACTIVE: 0,
      ALUMNI: 0,
    };

    const cohortsSet = new Set<string>();
    const branchesSet = new Set<string>();
    const programsSet = new Set<string>();

    allStudentsMetadata.forEach((s) => {
      if (stageCounts[s.stage] !== undefined) {
        stageCounts[s.stage]++;
      }
      if (s.cohort) cohortsSet.add(s.cohort);
      if (s.branch) branchesSet.add(s.branch);
      if (s.program) programsSet.add(s.program);
    });

    // Augment students with computed verification & payment summaries and custom fields
    const enrichedStudents = students.map((student) => {
      const totalDocs = student.documents.length;
      const verifiedDocs = student.documents.filter(
        (d) => d.status === DocumentStatus.VERIFIED
      ).length;
      const receivedDocs = student.documents.filter(
        (d) => d.status === DocumentStatus.RECEIVED
      ).length;

      const totalPayments = student.payments.reduce((sum, p) => sum + p.amount, 0);
      const paidPayments = student.payments
        .filter((p) => p.status === PaymentStatus.PAID)
        .reduce((sum, p) => sum + p.amount, 0);
      const pendingPayments = totalPayments - paidPayments;

      return {
        ...student,
        customFields: valuesByStudentId[student.id] || {},
        tags: tagsByStudentId[student.id] || [],
        metrics: {
          totalDocs,
          verifiedDocs,
          receivedDocs,
          docPercent: totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0,
          totalPayments,
          paidPayments,
          pendingPayments,
          paymentPercent: totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0,
        },
      };
    });

    const parsedDefinitions = customFieldDefinitions.map((def: any) => ({
      ...def,
      options: def.options ? JSON.parse(def.options) : null,
    }));

    return NextResponse.json({
      students: enrichedStudents,
      totalCount,
      stageCounts,
      customFieldDefinitions: parsedDefinitions,
      tags: allTags,
      availableCohorts: Array.from(cohortsSet).sort(),
      availableBranches: Array.from(branchesSet).sort(),
      availablePrograms: Array.from(programsSet).sort(),
    });
  } catch (error: any) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch students." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
    assertModuleAccess(session, "students");
    const body = await req.json();
    const { name, phone, email, stage, program, cohort, branch, leadId, customFields } = body;

    if (!name?.trim() || !phone?.trim() || !email?.trim() || !program?.trim() || !cohort?.trim()) {
      return NextResponse.json(
        { error: "Name, phone, email, program, and cohort are required fields." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Look up document template for program
    const docTemplate = await scopedDb.documentTemplate.findFirst({
      where: { program: program.trim() },
    });

    const initialDocs: { name: string; status: DocumentStatus }[] = [];
    if (docTemplate?.requiredDocuments && Array.isArray(docTemplate.requiredDocuments)) {
      (docTemplate.requiredDocuments as string[]).forEach((docName) => {
        initialDocs.push({
          name: docName,
          status: DocumentStatus.PENDING,
        });
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone.trim());

    const student = await scopedDb.student.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim().toLowerCase(),
        stage: stage || StudentStage.ENQUIRY,
        program: program.trim(),
        cohort: cohort.trim(),
        branch: branch?.trim() || null,
        leadId: leadId || null,
        documents: {
          create: initialDocs,
        },
      },
      include: {
        documents: true,
        payments: true,
      },
    });

    // Run deduplication check against existing students in the organization
    const duplicateResult = await checkAndCreateStudentDuplicateMatch({
      organizationId: session.user.organizationId,
      newStudentId: student.id,
      phone: normalizedPhone,
      email: email.trim().toLowerCase(),
      client: scopedDb,
    });

    // Save custom fields if provided
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

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: duplicateResult ? "STUDENT_CREATED_WITH_DUPLICATE_FLAG" : "STUDENT_CREATED",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          studentName: student.name,
          program: student.program,
          cohort: student.cohort,
          stage: student.stage,
          duplicateMatchId: duplicateResult?.duplicateMatch?.id || null,
          primaryStudentId: duplicateResult?.primaryStudent?.id || null,
        }),
      },
    });

    return NextResponse.json(
      {
        student,
        duplicateMatch: duplicateResult?.duplicateMatch || null,
        primaryStudent: duplicateResult?.primaryStudent || null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create student." },
      { status: 500 }
    );
  }
}
