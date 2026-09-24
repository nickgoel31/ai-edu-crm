import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { DuplicateMatchStatus } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const matchId = params.id;
    const scopedPrisma = getScopedPrismaClient(session);

    const match = await scopedPrisma.duplicateMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Duplicate match not found." },
        { status: 404 }
      );
    }

    if (match.status === DuplicateMatchStatus.MERGED) {
      return NextResponse.json(
        { error: "Cannot dismiss an already merged duplicate record." },
        { status: 400 }
      );
    }

    const updatedMatch = await scopedPrisma.duplicateMatch.update({
      where: { id: matchId },
      data: {
        status: DuplicateMatchStatus.DISMISSED,
      },
    });

    await scopedPrisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: `${match.entityType}_DUPLICATE_DISMISSED`,
        entityType: match.entityType,
        entityId: match.primaryEntityId,
        changesJson: JSON.stringify({
          matchId,
          primaryEntityId: match.primaryEntityId,
          duplicateEntityId: match.duplicateEntityId,
          reason: "Marked as false-positive match by user",
          dismissedBy: session.user.name || session.user.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Duplicate match dismissed as false-positive.",
      match: updatedMatch,
    });
  } catch (error: any) {
    console.error("POST /api/duplicates/[id]/dismiss error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to dismiss duplicate match." },
      { status: 500 }
    );
  }
}
