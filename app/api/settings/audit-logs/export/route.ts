import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Exports the org's full audit trail as CSV — a hard requirement for most
// B2B/edu security reviews and for GDPR/DPDP "provide our processing
// records" requests. Bounded to the last 100k rows so this stays a single
// synchronous response rather than needing a background job.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Only Organization Administrators can export the Audit Log." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100_000,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
    });

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return new NextResponse(JSON.stringify(logs, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit-log-${timestamp}.json"`,
        },
      });
    }

    const header = ["Timestamp", "Action", "Entity Type", "Entity ID", "User Name", "User Email", "User Role", "Changes"];
    const rows = logs.map((l) =>
      [
        l.createdAt.toISOString(),
        l.action,
        l.entityType,
        l.entityId,
        l.user?.name || "",
        l.user?.email || "System",
        l.user?.role || "",
        l.changesJson || "",
      ]
        .map(csvEscape)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${timestamp}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting audit log:", error);
    return NextResponse.json({ error: error?.message || "Failed to export audit log." }, { status: 500 });
  }
}
