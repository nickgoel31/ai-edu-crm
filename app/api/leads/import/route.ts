import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertCanMutate } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { ingestOrUpdateLead } from "@/lib/lead-ingestion";
import { LeadSource } from "@/types";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

const MAX_ROWS = 2000;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    const body = await req.json();
    const { csvText } = body;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "csvText (raw CSV file contents) is required." }, { status: 400 });
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in the CSV." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `CSV has ${rows.length} rows; the limit is ${MAX_ROWS} per import.` }, { status: 400 });
    }

    const firstRow = rows[0];
    const hasPhoneColumn = ["phone", "phone number", "mobile", "phonenumber"].some((k) => k in firstRow);
    if (!hasPhoneColumn) {
      return NextResponse.json(
        { error: "CSV must include a 'phone' (or 'mobile'/'phone number') column." },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;
    let created = 0;
    let duplicates = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = row.phone || row["phone number"] || row.mobile || row.phonenumber;
      if (!phone) {
        skipped++;
        errors.push({ row: i + 2, reason: "Missing phone number" });
        continue;
      }

      try {
        const result = await ingestOrUpdateLead({
          organizationId,
          source: LeadSource.CSV_IMPORT,
          name: row.name || row["full name"] || row.fullname || "Imported Lead",
          phone,
          email: row.email || undefined,
          score: 50,
          metadata: { program: row.program || row.course, importedBy: session.user.email },
          notes: row.notes || row.notes_text || undefined,
        });
        created++;
        if (result.duplicateMatch) duplicates++;
      } catch (err: any) {
        skipped++;
        errors.push({ row: i + 2, reason: err?.message || "Unknown error" });
      }
    }

    const scopedDb = getScopedPrismaClient(session);
    await scopedDb.auditLog.create({
      data: {
        organizationId,
        userId: session.user.id,
        action: "LEADS_IMPORTED_FROM_CSV",
        entityType: "Lead",
        entityId: "bulk",
        changesJson: JSON.stringify({ totalRows: rows.length, created, duplicates, skipped }),
      },
    });

    return NextResponse.json({
      totalRows: rows.length,
      created,
      duplicates,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error: any) {
    console.error("Error importing leads from CSV:", error);
    return NextResponse.json({ error: error?.message || "Failed to import leads." }, { status: 500 });
  }
}
