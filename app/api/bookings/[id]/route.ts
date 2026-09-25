import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { DemoBookingStatus } from "@/types";

const VALID_STATUSES = Object.values(DemoBookingStatus);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    const { status, notes } = body;

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);

    const existing = await scopedDb.demoBooking.findFirst({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Demo booking not found." }, { status: 404 });
    }

    const data: any = {};
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await scopedDb.demoBooking.update({
      where: { id: params.id },
      data,
    });

    // Cancelling a booking frees up its slot's capacity.
    if (status === DemoBookingStatus.CANCELLED && existing.status !== DemoBookingStatus.CANCELLED) {
      await scopedDb.demoSlot.update({
        where: { id: existing.demoSlotId },
        data: { bookedCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ booking: updated });
  } catch (err: any) {
    console.error("Failed to update demo booking:", err);
    return NextResponse.json({ error: "Failed to update demo booking." }, { status: 500 });
  }
}
