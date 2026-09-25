import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { WEEKDAYS } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const scopedDb = getScopedPrismaClient(session);

    const batches = await scopedDb.batch.findMany({
      include: {
        faculty: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = batches.map((b) => ({
      ...b,
      scheduleDays: safeParseDays(b.scheduleDays),
    }));

    return NextResponse.json({ batches: parsed });
  } catch (error: any) {
    console.error("Error fetching batches:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch batches." },
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

    const body = await req.json();
    const {
      name,
      program,
      facultyUserId,
      startDate,
      endDate,
      scheduleDays,
      scheduleTime,
      capacity,
    } = body;

    if (!name?.trim() || !program?.trim() || !startDate) {
      return NextResponse.json(
        { error: "Name, program, and start date are required." },
        { status: 400 }
      );
    }

    if (
      scheduleDays !== undefined &&
      scheduleDays !== null &&
      (!Array.isArray(scheduleDays) ||
        scheduleDays.some((d: string) => !WEEKDAYS.includes(d as any)))
    ) {
      return NextResponse.json(
        { error: `scheduleDays must be an array of: ${WEEKDAYS.join(", ")}` },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const batch = await scopedDb.batch.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        program: program.trim(),
        facultyUserId: facultyUserId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        scheduleDays: JSON.stringify(Array.isArray(scheduleDays) ? scheduleDays : []),
        scheduleTime: scheduleTime?.trim() || null,
        capacity: capacity !== undefined && capacity !== null && capacity !== "" ? Number(capacity) : null,
      },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        _count: { select: { students: true } },
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BATCH_CREATED",
        entityType: "Batch",
        entityId: batch.id,
        changesJson: JSON.stringify({
          name: batch.name,
          program: batch.program,
          startDate: batch.startDate,
        }),
      },
    });

    return NextResponse.json(
      { batch: { ...batch, scheduleDays: safeParseDays(batch.scheduleDays) } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating batch:", error);
    const status = /forbidden/i.test(error?.message || "") ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to create batch." },
      { status }
    );
  }
}

function safeParseDays(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
