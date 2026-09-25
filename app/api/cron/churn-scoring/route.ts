import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateStudentChurnRisk } from "@/lib/churn-scoring";
import { StudentStage } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Nightly cron sweep for student dropout/churn-risk scoring. Re-evaluates
 * every ENROLLED/ACTIVE student across all tenants — mirrors the shape of
 * /api/cron/lead-scoring, just for lib/churn-scoring.ts instead.
 */
export async function GET(req: NextRequest) {
  try {
    const students = await prisma.student.findMany({
      where: {
        stage: { in: [StudentStage.ENROLLED, StudentStage.ACTIVE] },
        isArchived: false,
      },
      select: { id: true },
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let scoreSum = 0;

    for (const student of students) {
      const result = await recalculateStudentChurnRisk(student.id);
      if (result) {
        updatedCount += 1;
        scoreSum += result.score;
      } else {
        skippedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      studentsConsidered: students.length,
      updatedCount,
      skippedCount,
      averageScore: updatedCount > 0 ? scoreSum / updatedCount : 0,
    });
  } catch (error: any) {
    console.error("Cron /api/cron/churn-scoring error:", error);
    return NextResponse.json(
      { error: error?.message || "Nightly churn-risk scoring sweep failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
