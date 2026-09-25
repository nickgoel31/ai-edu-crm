import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { BroadcastSegmentType } from "@/types";

/**
 * Builds the segment where-clause for a broadcast campaign, applied to
 * either Lead or Student. `optedInOnly` controls whether the opt-in gate
 * is applied — always true for the actual send, and used here to compute
 * the real (opted-in) recipient count at creation time too so the admin
 * never sees an inflated number.
 */
function buildSegmentWhere(
  segmentType: string,
  segmentFilter: Record<string, any> | null,
  optedInOnly: boolean
) {
  const where: any = {};
  if (segmentFilter?.stage) {
    where.stage = segmentFilter.stage;
  }
  if (optedInOnly) {
    where.whatsappOptIn = true;
  }
  return where;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const campaigns = await scopedDb.broadcastCampaign.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error("Failed to list broadcast campaigns:", err);
    return NextResponse.json({ error: "Failed to load broadcast campaigns." }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const { name, templateMessage, segmentType, segmentFilter } = body;

    if (!name || !templateMessage || !segmentType) {
      return NextResponse.json(
        { error: "name, templateMessage, and segmentType are required." },
        { status: 400 }
      );
    }

    if (!Object.values(BroadcastSegmentType).includes(segmentType)) {
      return NextResponse.json({ error: "Invalid segmentType." }, { status: 400 });
    }

    const scopedDb = getScopedPrismaClient(session);

    // Compute the REAL opted-in recipient count up front, so the admin
    // sees actual reach (not the full segment size) before ever sending.
    const where = buildSegmentWhere(segmentType, segmentFilter || null, true);
    const totalRecipients =
      segmentType === BroadcastSegmentType.LEADS
        ? await scopedDb.lead.count({ where: { ...where, isArchived: false } })
        : await scopedDb.student.count({ where: { ...where, isArchived: false } });

    const campaign = await scopedDb.broadcastCampaign.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        templateMessage,
        segmentType,
        segmentFilter: segmentFilter ? JSON.stringify(segmentFilter) : null,
        status: "DRAFT",
        totalRecipients,
        createdByUserId: session.user.id,
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create broadcast campaign:", err);
    return NextResponse.json({ error: "Failed to create broadcast campaign." }, { status: 500 });
  }
}
