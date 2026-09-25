import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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
    const scopedDb = getScopedPrismaClient(session);

    const slot = await scopedDb.demoSlot.findFirst({
      where: { id: params.id },
      include: { bookings: true },
    });

    if (!slot) {
      return NextResponse.json({ error: "Demo slot not found." }, { status: 404 });
    }

    const activeBookings = slot.bookings.filter((b: any) => b.status !== "CANCELLED");
    if (activeBookings.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this slot: it has ${activeBookings.length} active booking(s). Cancel those bookings first.`,
        },
        { status: 400 }
      );
    }

    await scopedDb.demoSlot.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete demo slot:", err);
    return NextResponse.json({ error: "Failed to delete demo slot." }, { status: 500 });
  }
}
