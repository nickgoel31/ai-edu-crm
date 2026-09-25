import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const scopedDb = getScopedPrismaClient(session);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const bookings = await scopedDb.demoBooking.findMany({
      where,
      include: {
        demoSlot: true,
        lead: { select: { id: true, name: true, phone: true, stage: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bookings });
  } catch (err: any) {
    console.error("Failed to list demo bookings:", err);
    return NextResponse.json({ error: "Failed to load demo bookings." }, { status: 500 });
  }
}
