import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { sendNotificationWhatsApp } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { BroadcastSegmentType } from "@/types";

// Hard cap on a synchronous send. This route runs inline in the request
// (see note in the final report re: enqueueJob) rather than as a
// background job, so a campaign larger than this should be split up.
const MAX_SYNC_RECIPIENTS = 500;
const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function substitutePlaceholders(template: string, name: string): string {
  return template.replace(/\{\{\s*name\s*\}\}/gi, name);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
    const organizationId = session.user.organizationId;

    const campaign = await scopedDb.broadcastCampaign.findFirst({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Campaign has already been ${campaign.status.toLowerCase()}. It cannot be sent again.` },
        { status: 400 }
      );
    }

    const segmentFilter = campaign.segmentFilter ? JSON.parse(campaign.segmentFilter) : null;
    const baseWhere: any = { isArchived: false };
    if (segmentFilter?.stage) {
      baseWhere.stage = segmentFilter.stage;
    }

    // Re-run the segment query scoped to the org, once WITHOUT the opt-in
    // filter (to know how many are being skipped) and once WITH it (the
    // only set of people that actually get messaged). This is the
    // single most important correctness requirement of this feature:
    // never message a lead/student that hasn't opted in, no matter what
    // the campaign's segment definition otherwise matches.
    let matchingSegment: { id: string; name: string; phone: string; whatsappOptIn: boolean }[];
    if (campaign.segmentType === BroadcastSegmentType.LEADS) {
      matchingSegment = await scopedDb.lead.findMany({
        where: baseWhere,
        select: { id: true, name: true, phone: true, whatsappOptIn: true },
      });
    } else {
      matchingSegment = await scopedDb.student.findMany({
        where: baseWhere,
        select: { id: true, name: true, phone: true, whatsappOptIn: true },
      });
    }

    const recipients = matchingSegment.filter((r) => r.whatsappOptIn === true);
    const optedOutSkipped = matchingSegment.length - recipients.length;

    if (recipients.length === 0) {
      await scopedDb.broadcastCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED",
          totalRecipients: matchingSegment.length,
          optedOutSkipped,
          sentCount: 0,
          failedCount: 0,
        },
      });
      return NextResponse.json(
        { error: "No opted-in recipients match this segment. Nothing was sent." },
        { status: 400 }
      );
    }

    if (recipients.length > MAX_SYNC_RECIPIENTS) {
      return NextResponse.json(
        {
          error: `This campaign has ${recipients.length} opted-in recipients, above the ${MAX_SYNC_RECIPIENTS} synchronous send cap. Split the segment or contact support for large sends.`,
        },
        { status: 400 }
      );
    }

    await scopedDb.broadcastCampaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING", totalRecipients: matchingSegment.length, optedOutSkipped },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
      const batch = recipients.slice(i, i + SEND_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          sendNotificationWhatsApp({
            to: recipient.phone,
            message: substitutePlaceholders(campaign.templateMessage, recipient.name),
            organizationId,
          })
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      if (i + SEND_BATCH_SIZE < recipients.length) {
        await sleep(SEND_BATCH_DELAY_MS);
      }
    }

    const finalStatus = sentCount > 0 ? "SENT" : "FAILED";

    const updated = await scopedDb.broadcastCampaign.update({
      where: { id: campaign.id },
      data: {
        status: finalStatus,
        sentCount,
        failedCount,
        optedOutSkipped,
        sentAt: finalStatus === "SENT" ? new Date() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: session.user.id,
        action: "BROADCAST_CAMPAIGN_SENT",
        entityType: "BroadcastCampaign",
        entityId: campaign.id,
        changesJson: JSON.stringify({
          name: campaign.name,
          segmentType: campaign.segmentType,
          segmentFilter,
          matchingSegmentSize: matchingSegment.length,
          sentCount,
          failedCount,
          optedOutSkipped,
          finalStatus,
        }),
      },
    });

    return NextResponse.json({ campaign: updated });
  } catch (err: any) {
    console.error("Failed to send broadcast campaign:", err);
    return NextResponse.json({ error: "Failed to send broadcast campaign." }, { status: 500 });
  }
}
