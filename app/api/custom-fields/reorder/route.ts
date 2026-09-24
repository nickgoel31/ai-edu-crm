import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertAdmin(session);
    const body = await req.json();
    const { items } = body; // Array of { id: string, displayOrder: number }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid items payload for reordering." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    await Promise.all(
      items.map((item) =>
        scopedDb.customFieldDefinition.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering custom fields:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reorder custom fields." },
      { status: 500 }
    );
  }
}
