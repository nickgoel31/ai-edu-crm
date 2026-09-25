import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processPendingJobs, type JobHandler } from "@/lib/job-queue";
import { ingestOrUpdateLead, type IngestLeadParams } from "@/lib/lead-ingestion";
import { callAgentWebhook } from "@/lib/agent-trigger-engine";

const handlers: Record<string, JobHandler> = {
  LEAD_INGESTION_RETRY: async (payload: IngestLeadParams) => {
    await ingestOrUpdateLead(payload);
  },

  AGENT_TRIGGER_RETRY: async (payload: {
    agentTriggerId: string;
    entityType: string;
    entityId: string;
    webhookUrl: string;
    webhookPayload: Record<string, any>;
  }) => {
    const result = await callAgentWebhook(payload.webhookUrl, payload.webhookPayload);
    if (!result.ok) {
      throw new Error(result.error || "Agent webhook retry failed");
    }
    // Retry succeeded — flip the recorded fire from FAILED to SUCCESS so
    // the Agent Automation tab reflects reality instead of a stale failure.
    await prisma.agentTriggerFire.updateMany({
      where: {
        agentTriggerId: payload.agentTriggerId,
        entityType: payload.entityType,
        entityId: payload.entityId,
      },
      data: { status: "SUCCESS", errorMessage: null },
    });
  },
};

async function handleCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = searchParams.get("secret") || authHeader?.replace("Bearer ", "");
      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const report = await processPendingJobs(handlers);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), report });
  } catch (error: any) {
    console.error("Process jobs cron error:", error);
    return NextResponse.json({ error: error.message || "Failed to process jobs" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
