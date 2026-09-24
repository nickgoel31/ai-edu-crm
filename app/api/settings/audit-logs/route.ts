import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  // Enforce ADMIN-only access policy
  try {
    assertAdmin(session);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Forbidden: Only Organization Administrators can access the Audit Log." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const dateRange = searchParams.get("dateRange") || "all";

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (entityType && entityType !== "ALL") {
      where.entityType = entityType;
    }

    if (userId && userId !== "ALL") {
      where.userId = userId;
    }

    // Date range filter
    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let startDate: Date | null = null;
      if (dateRange === "24h") {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateRange === "7d") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === "30d") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === "90d") {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }

      if (startDate) {
        where.createdAt = { gte: startDate };
      }
    }

    // Search query: match user name/email or entityId
    if (search && search.trim()) {
      const query = search.trim();
      where.OR = [
        { entityId: { contains: query, mode: "insensitive" } },
        { action: { contains: query, mode: "insensitive" } },
        {
          user: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [totalCount, logs, actionSummary, entitySummary, users] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: { organizationId: session.user.organizationId },
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ["entityType"],
        where: { organizationId: session.user.organizationId },
        _count: true,
      }),
      prisma.user.findMany({
        where: { organizationId: session.user.organizationId },
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        actions: actionSummary.map((a) => a.action),
        entityTypes: entitySummary.map((e) => e.entityType),
        users,
      },
    });
  } catch (error: any) {
    console.error("Error querying audit logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to query audit logs." },
      { status: 500 }
    );
  }
}
