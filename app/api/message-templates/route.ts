import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const scopedDb = getScopedPrismaClient(session);

    const where: any = {};
    if (channel) where.channel = channel;

    const templates = await scopedDb.messageTemplate.findMany({
      where,
      orderBy: [{ channel: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("GET /api/message-templates error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch message templates." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, channel, subject, body: templateBody } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!channel || !["EMAIL", "SMS", "WHATSAPP"].includes(channel)) {
      return NextResponse.json(
        { error: "Channel must be EMAIL, SMS, or WHATSAPP." },
        { status: 400 }
      );
    }

    const orgId = session.user.organizationId;
    const template = await prisma.messageTemplate.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        channel,
        subject: channel === "EMAIL" ? (subject?.trim() || null) : null,
        body: templateBody || "",
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/message-templates error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create message template." },
      { status: 500 }
    );
  }
}
