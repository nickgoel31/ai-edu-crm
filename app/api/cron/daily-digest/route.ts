import { NextResponse } from "next/server";
import { runDailyDigestCron } from "@/lib/notifications";

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId") || undefined;
    const dryRun = searchParams.get("dryRun") === "true";

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const providedSecret =
        searchParams.get("secret") || authHeader?.replace("Bearer ", "");

      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const report = await runDailyDigestCron({
      organizationId: orgId,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (error: any) {
    console.error("Daily digest cron error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute daily digest cron" },
      { status: 500 }
    );
  }
}
