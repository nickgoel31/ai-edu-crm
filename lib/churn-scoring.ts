import { prisma } from "@/lib/prisma";
import { StudentStage, PaymentStatus } from "@/types";

/**
 * Dropout/churn-risk scoring for already-enrolled students. Same rule-based
 * shape/conventions as lib/lead-scoring.ts (a breakdown array summed into a
 * final score, written back via prisma.student.update), but with a fixed
 * set of hardcoded rules instead of org-configurable ScoringRule rows —
 * building a full custom-rule UI for churn is out of scope for this pass.
 *
 * Higher score = more likely to drop out. 0-100, clamped.
 */

export interface ChurnRiskFactor {
  factor: string;
  points: number;
  reason: string;
}

export interface ChurnRiskResult {
  score: number;
  factors: ChurnRiskFactor[];
}

const ENGAGEMENT_WINDOW_DAYS = 21;
const NEW_ENROLLMENT_GRACE_DAYS = 14;
const ATTENDANCE_WINDOW_DAYS = 30;

/**
 * Recalculates and persists the churn-risk score for a single student.
 * Returns null if the student doesn't exist or isn't in an
 * ENROLLED/ACTIVE stage (ENQUIRY/ALUMNI students aren't scored).
 */
export async function recalculateStudentChurnRisk(
  studentId: string
): Promise<ChurnRiskResult | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      stage: true,
      batchId: true,
      createdAt: true,
    },
  });

  if (!student) return null;

  const scorableStages: string[] = [StudentStage.ENROLLED, StudentStage.ACTIVE];
  if (!scorableStages.includes(student.stage)) {
    return null;
  }

  const factors: ChurnRiskFactor[] = [];
  const now = new Date();

  // ── Attendance: % present over the last 30 days ─────────────────────
  if (student.batchId) {
    const attendanceWindowStart = new Date(
      now.getTime() - ATTENDANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const attendanceRecords = await prisma.classAttendance.findMany({
      where: {
        studentId: student.id,
        date: { gte: attendanceWindowStart },
      },
      select: { status: true },
    });

    if (attendanceRecords.length > 0) {
      const presentCount = attendanceRecords.filter(
        (r) => r.status === "PRESENT"
      ).length;
      const attendancePercent = (presentCount / attendanceRecords.length) * 100;

      if (attendancePercent < 50) {
        factors.push({
          factor: "attendance",
          points: 35,
          reason: "Attendance below 50% in the last 30 days",
        });
      } else if (attendancePercent < 75) {
        factors.push({
          factor: "attendance",
          points: 15,
          reason: "Attendance between 50-75% in the last 30 days",
        });
      }
    }
    // No attendance data yet — skip the rule, don't penalize.
  }

  // ── Payments: overdue installments ──────────────────────────────────
  const overduePayments = await prisma.payment.count({
    where: { studentId: student.id, status: PaymentStatus.OVERDUE },
  });

  if (overduePayments > 0) {
    const rawPoints = overduePayments * 25;
    const points = Math.min(rawPoints, 40);
    factors.push({
      factor: "overdue_payments",
      points,
      reason: `${overduePayments} overdue fee installment(s)`,
    });
  }

  // ── Engagement: no recorded contact/activity in the last 21 days ────
  const engagementWindowStart = new Date(
    now.getTime() - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [conversationCount, activityCount] = await Promise.all([
    prisma.conversation.count({
      where: {
        studentId: student.id,
        createdAt: { gte: engagementWindowStart },
      },
    }),
    prisma.activity.count({
      where: {
        entityType: "STUDENT",
        entityId: student.id,
        createdAt: { gte: engagementWindowStart },
      },
    }),
  ]);

  if (conversationCount === 0 && activityCount === 0) {
    factors.push({
      factor: "no_engagement",
      points: 15,
      reason: "No recorded contact/activity in 21+ days",
    });
  }

  // ── Tenure protective factor: brand-new enrollments ─────────────────
  const daysSinceEnrollment = Math.floor(
    (now.getTime() - new Date(student.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceEnrollment < NEW_ENROLLMENT_GRACE_DAYS) {
    factors.push({
      factor: "recently_enrolled",
      points: -10,
      reason: "Recently enrolled — risk signal still developing",
    });
  }

  // ── Total, clamped to [0, 100] ───────────────────────────────────────
  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, rawTotal));

  await prisma.student.update({
    where: { id: student.id },
    data: {
      churnRiskScore: score,
      churnRiskFactors: JSON.stringify(factors),
      churnRiskUpdatedAt: now,
    },
  });

  return { score, factors };
}
