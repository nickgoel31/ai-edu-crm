import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const MAX_GENERATED_SLOTS = 200;

const DAY_NAME_TO_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const slots = await scopedDb.demoSlot.findMany({
      orderBy: { startTime: "asc" },
      include: {
        _count: { select: { bookings: true } },
      },
    });

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { slug: true },
    });

    return NextResponse.json({ slots, orgSlug: org?.slug || null });
  } catch (err: any) {
    console.error("Failed to list demo slots:", err);
    return NextResponse.json({ error: "Failed to load demo slots." }, { status: 500 });
  }
}

/**
 * Generates repeating slots between startDate/endDate (inclusive) on the
 * given weekdays, each slotDurationMinutes long between startHour/endHour.
 * Capped at MAX_GENERATED_SLOTS to avoid runaway input.
 */
function generateBulkSlots(params: {
  startDate: string;
  endDate: string;
  daysOfWeek: string[];
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  capacity: number;
}): { startTime: Date; endTime: Date; capacity: number }[] {
  const { startDate, endDate, daysOfWeek, startHour, endHour, slotDurationMinutes, capacity } = params;

  const dayIndexes = new Set(
    daysOfWeek
      .map((d) => DAY_NAME_TO_INDEX[d.toUpperCase().slice(0, 3)])
      .filter((n) => n !== undefined)
  );

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const slots: { startTime: Date; endTime: Date; capacity: number }[] = [];

  for (
    let day = new Date(start);
    day <= end && slots.length < MAX_GENERATED_SLOTS;
    day.setDate(day.getDate() + 1)
  ) {
    if (!dayIndexes.has(day.getDay())) continue;

    for (
      let hour = startHour;
      hour < endHour && slots.length < MAX_GENERATED_SLOTS;
      hour += slotDurationMinutes / 60
    ) {
      const slotStart = new Date(day);
      const wholeHour = Math.floor(hour);
      const minutePart = Math.round((hour - wholeHour) * 60);
      slotStart.setHours(wholeHour, minutePart, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000);
      if (slotEnd.getHours() + slotEnd.getMinutes() / 60 > endHour && slotEnd.getDate() !== slotStart.getDate()) {
        continue;
      }

      slots.push({ startTime: slotStart, endTime: slotEnd, capacity });
    }
  }

  return slots;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  try {
    const body = await req.json();
    const scopedDb = getScopedPrismaClient(session);

    // Bulk generator form
    if (body.startDate && body.endDate && Array.isArray(body.daysOfWeek)) {
      const {
        startDate,
        endDate,
        daysOfWeek,
        startHour,
        endHour,
        slotDurationMinutes,
        capacity,
      } = body;

      if (
        typeof startHour !== "number" ||
        typeof endHour !== "number" ||
        typeof slotDurationMinutes !== "number" ||
        slotDurationMinutes <= 0 ||
        endHour <= startHour
      ) {
        return NextResponse.json(
          { error: "Invalid bulk slot generation parameters." },
          { status: 400 }
        );
      }

      const generated = generateBulkSlots({
        startDate,
        endDate,
        daysOfWeek,
        startHour,
        endHour,
        slotDurationMinutes,
        capacity: typeof capacity === "number" && capacity > 0 ? capacity : 1,
      });

      if (generated.length === 0) {
        return NextResponse.json(
          { error: "No slots would be generated with these parameters." },
          { status: 400 }
        );
      }

      if (generated.length > MAX_GENERATED_SLOTS) {
        return NextResponse.json(
          { error: `Too many slots requested. Cap is ${MAX_GENERATED_SLOTS} per call.` },
          { status: 400 }
        );
      }

      const created = await scopedDb.demoSlot.createMany({
        data: generated.map((slot) => ({
          ...slot,
          organizationId: session.user.organizationId,
        })),
      });

      return NextResponse.json({ created: created.count }, { status: 201 });
    }

    // Single slot form
    const { startTime, endTime, capacity } = body;
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "startTime and endTime are required." },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid startTime/endTime range." }, { status: 400 });
    }

    const slot = await scopedDb.demoSlot.create({
      data: {
        organizationId: session.user.organizationId,
        startTime: start,
        endTime: end,
        capacity: typeof capacity === "number" && capacity > 0 ? capacity : 1,
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create demo slot(s):", err);
    return NextResponse.json({ error: "Failed to create demo slot(s)." }, { status: 500 });
  }
}
