import { redirect } from "next/navigation";
import {
  GraduationCap,
  CalendarCheck2,
  Wallet,
  FileCheck2,
  Building2,
  Clock,
} from "lucide-react";
import { getGuardianFromRequest } from "@/lib/guardian-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    date
  );
}

const PAYMENT_BADGE_VARIANT: Record<string, "outline" | "destructive" | "secondary"> = {
  PAID: "secondary",
  PENDING: "outline",
  OVERDUE: "destructive",
};

const DOCUMENT_BADGE_VARIANT: Record<string, "outline" | "secondary" | "destructive"> = {
  VERIFIED: "secondary",
  RECEIVED: "outline",
  PENDING: "destructive",
};

export default async function PortalDashboardPage() {
  // This is a server component: it can call getGuardianFromRequest() and
  // Prisma directly, so the page renders in one pass without a client-side
  // round trip through the /api/portal/* routes (those routes still exist
  // for a future mobile client / external integrations).
  const guardian = await getGuardianFromRequest();
  if (!guardian) {
    redirect("/portal/login");
  }

  const student = await prisma.student.findFirst({
    where: { id: guardian.studentId, organizationId: guardian.organizationId },
    select: {
      id: true,
      name: true,
      program: true,
      cohort: true,
      branch: true,
      stage: true,
      batchId: true,
    },
  });

  if (!student) {
    // Guardian account exists but its linked student is gone (e.g.
    // archived/deleted) — fail closed rather than showing stale data.
    redirect("/portal/login");
  }

  const [batch, attendanceRecords, documents, payments] = await Promise.all([
    student.batchId
      ? prisma.batch.findFirst({
          where: { id: student.batchId, organizationId: guardian.organizationId },
          select: { name: true, scheduleDays: true, scheduleTime: true },
        })
      : Promise.resolve(null),
    prisma.classAttendance.findMany({
      where: {
        organizationId: guardian.organizationId,
        studentId: guardian.studentId,
        date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: "desc" },
      select: { id: true, date: true, status: true },
    }),
    prisma.document.findMany({
      where: { studentId: guardian.studentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.payment.findMany({
      where: { studentId: guardian.studentId },
      orderBy: { dueDate: "asc" },
      select: { id: true, amount: true, dueDate: true, status: true, installmentNumber: true },
    }),
  ]);

  const presentOrLate = attendanceRecords.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;
  const attendancePercentage =
    attendanceRecords.length > 0
      ? Math.round((presentOrLate / attendanceRecords.length) * 1000) / 10
      : null;

  const dueAmount = payments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .reduce((sum, p) => sum + p.amount, 0);
  const overdueCount = payments.filter((p) => p.status === "OVERDUE").length;

  let scheduleDays: string[] = [];
  if (batch?.scheduleDays) {
    try {
      scheduleDays = JSON.parse(batch.scheduleDays);
    } catch {
      scheduleDays = [];
    }
  }

  return (
    <div className="space-y-6">
      {/* Student header */}
      <Card className="bg-gradient-to-br from-primary/10 via-card to-card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{student.name}</CardTitle>
                <CardDescription>
                  {student.program} &middot; Cohort {student.cohort}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">{student.stage}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {student.branch && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {student.branch}
              </span>
            )}
            {batch && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {batch.name}
                {scheduleDays.length > 0 && ` · ${scheduleDays.join("/")}`}
                {batch.scheduleTime && ` · ${batch.scheduleTime}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Attendance summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarCheck2 className="h-4 w-4 text-blue-400" />
              Attendance (last 90 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attendancePercentage === null ? (
              <p className="text-xs text-muted-foreground">
                No attendance records yet for this period.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-foreground">
                    {attendancePercentage}%
                  </span>
                  <span className="text-xs text-muted-foreground">present</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
                  />
                </div>
              </>
            )}

            {attendanceRecords.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {attendanceRecords.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatDate(r.date)}</span>
                    <Badge
                      variant={
                        r.status === "PRESENT"
                          ? "secondary"
                          : r.status === "LATE"
                          ? "outline"
                          : "destructive"
                      }
                    >
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Fee status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-emerald-400" />
              Fee status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-foreground">
                {formatCurrency(dueAmount)}
              </span>
              <span className="text-xs text-muted-foreground">
                {overdueCount > 0 ? `due (${overdueCount} overdue)` : "due"}
              </span>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fee installments on record.</p>
            ) : (
              <ul className="space-y-1.5">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Installment {p.installmentNumber} &middot; {formatDate(p.dueDate)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {formatCurrency(p.amount)}
                      </span>
                      <Badge variant={PAYMENT_BADGE_VARIANT[p.status] || "outline"}>
                        {p.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileCheck2 className="h-4 w-4 text-violet-400" />
            Document checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents on record yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="text-foreground">{d.name}</span>
                  <Badge variant={DOCUMENT_BADGE_VARIANT[d.status] || "outline"}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
