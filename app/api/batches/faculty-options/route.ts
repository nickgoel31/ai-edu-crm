import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";

// Lightweight org-user list for the "Faculty / Instructor" picker on batch
// forms. Unlike /api/settings/users, this is available to any authenticated
// user in the org (not just ADMIN) since any counselor may need to create or
// edit a batch and assign a faculty member to it.
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

    const users = await scopedDb.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching faculty options:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users." },
      { status: 500 }
    );
  }
}
