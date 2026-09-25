import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { recalculateStudentChurnRisk } from "@/lib/churn-scoring";

/**
 * Read/refresh a single student's churn-risk score. Kept out of the
 * app/api/students/** tree (owned by another engineer) — same student, a
 * different route. Scoped via getScopedPrismaClient so we verify the
 * student belongs to the caller's org before returning or recomputing
 * anything.
 */

export async function GET(
  req: Request,
  { params }: { params: { studentId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const { studentId } = params;
    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        stage: true,
        churnRiskScore: true,
        churnRiskFactors: true,
        churnRiskUpdatedAt: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      studentId: student.id,
      stage: student.stage,
      churnRiskScore: student.churnRiskScore,
      churnRiskFactors: student.churnRiskFactors
        ? JSON.parse(student.churnRiskFactors)
        : [],
      churnRiskUpdatedAt: student.churnRiskUpdatedAt,
    });
  } catch (error: any) {
    console.error("Error fetching churn risk:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch churn risk." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { studentId: string } }
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
    const { studentId } = params;
    const scopedDb = getScopedPrismaClient(session);

    // Verify the student belongs to the caller's org before recomputing —
    // recalculateStudentChurnRisk itself uses the raw prisma client (it's a
    // shared library function also called cross-tenant by the cron sweep),
    // so the org-ownership check has to happen here.
    const existing = await scopedDb.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    const result = await recalculateStudentChurnRisk(studentId);

    if (!result) {
      return NextResponse.json({
        studentId,
        churnRiskScore: null,
        churnRiskFactors: [],
        message:
          "Student is not in an ENROLLED/ACTIVE stage — churn risk is not scored for this stage.",
      });
    }

    return NextResponse.json({
      studentId,
      churnRiskScore: result.score,
      churnRiskFactors: result.factors,
    });
  } catch (error: any) {
    console.error("Error recalculating churn risk:", error);
    const status = error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to recalculate churn risk." },
      { status }
    );
  }
}
