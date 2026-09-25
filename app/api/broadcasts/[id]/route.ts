import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const campaign = await scopedDb.broadcastCampaign.findFirst({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("Failed to load broadcast campaign:", err);
    return NextResponse.json({ error: "Failed to load broadcast campaign." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);
    const campaign = await scopedDb.broadcastCampaign.findFirst({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft campaigns can be deleted. A sent campaign is a permanent audit record." },
        { status: 400 }
      );
    }

    await scopedDb.broadcastCampaign.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete broadcast campaign:", err);
    return NextResponse.json({ error: "Failed to delete broadcast campaign." }, { status: 500 });
  }
}
