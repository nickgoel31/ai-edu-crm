import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { exportOrganizationPersonalData } from "@/lib/data-retention";

export const dynamic = "force-dynamic";

// Data portability: a full JSON dump of every individual's (lead/student)
// personal data held by this org, for a GDPR Art. 20 / DPDP data-portability
// request, or simply so the org can hand a departing customer their record.
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Only Organization Administrators can export org data." },
      { status: 403 }
    );
  }

  try {
    const data = await exportOrganizationPersonalData(session.user.organizationId);
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="org-data-export-${timestamp}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting organization data:", error);
    return NextResponse.json({ error: error?.message || "Failed to export organization data." }, { status: 500 });
  }
}
