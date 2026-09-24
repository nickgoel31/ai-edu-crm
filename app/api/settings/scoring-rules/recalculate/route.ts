import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recalculateAllLeadsForOrg } from "@/lib/lead-scoring";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await recalculateAllLeadsForOrg(session.user.organizationId);

    return NextResponse.json({
      success: true,
      message: `Recalculated scores for ${result.updatedCount} leads. Average score: ${result.averageScore}`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/settings/scoring-rules/recalculate error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to recalculate lead scores" },
      { status: 500 }
    );
  }
}
