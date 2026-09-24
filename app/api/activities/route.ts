import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { ActivityEntityType, ActivityType } from "@/types";
import { recordLeadFirstContact } from "@/lib/sla";

const MANUAL_TYPES: ActivityType[] = [
  ActivityType.NOTE,
  ActivityType.CALL,
  ActivityType.EMAIL,
];

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const cursor = searchParams.get("cursor");

    if (
      !entityType ||
      !entityId ||
      !Object.values(ActivityEntityType).includes(entityType as ActivityEntityType)
    ) {
      return NextResponse.json(
        { error: "A valid entityType and entityId are required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const activities = await scopedDb.activity.findMany({
      where: {
        entityType: entityType as ActivityEntityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const hasMore = activities.length > PAGE_SIZE;
    const page = hasMore ? activities.slice(0, PAGE_SIZE) : activities;

    return NextResponse.json({
      activities: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch activity timeline." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Read-only accounts cannot log activity." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { entityType, entityId, type, content } = body;

    if (
      !entityType ||
      !Object.values(ActivityEntityType).includes(entityType)
    ) {
      return NextResponse.json(
        { error: "A valid entityType is required." },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId is required." },
        { status: 400 }
      );
    }

    if (!type || !MANUAL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "type must be one of NOTE, CALL, EMAIL." },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Activity content cannot be empty." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify the target entity belongs to this organization
    const exists =
      entityType === ActivityEntityType.LEAD
        ? await scopedDb.lead.findUnique({ where: { id: entityId } })
        : await scopedDb.student.findUnique({ where: { id: entityId } });

    if (!exists) {
      return NextResponse.json(
        { error: "Target record not found in this organization." },
        { status: 404 }
      );
    }

    const activity = await scopedDb.activity.create({
      data: {
        organizationId: session.user.organizationId,
        entityType,
        entityId,
        type,
        content: content.trim(),
        createdByUserId: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // If activity was logged for a Lead, record first contact timestamp and satisfy SLA
    if (entityType === ActivityEntityType.LEAD) {
      try {
        await recordLeadFirstContact({
          leadId: entityId,
          organizationId: session.user.organizationId,
          client: scopedDb,
        });
      } catch (slaErr) {
        console.error("Non-blocking error recording first contact SLA:", slaErr);
      }
    }

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to log activity." },
      { status: 500 }
    );
  }
}
