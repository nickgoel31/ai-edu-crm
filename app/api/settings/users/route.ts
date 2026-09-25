import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { prisma } from "@/lib/prisma";
import { Role } from "@/types";
import { PLAN_CONFIGS, type PlanId } from "@/lib/billing/stripe";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  // Enforce ADMIN role access for user management
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can view team members." },
      { status: 403 }
    );
  }

  try {
    const scopedDb = getScopedPrismaClient(session);

    const users = await scopedDb.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        moduleAccess: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching scoped users:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users." },
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

  // Enforce ADMIN role access for user management
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can add or invite users." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, temporary password, and role are required." },
        { status: 400 }
      );
    }

    const validRoles: Role[] = ["ADMIN", "COUNSELOR", "READONLY"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role specified. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name?.trim() || null;

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { plan: true },
    });
    const seatLimit = PLAN_CONFIGS[org?.plan as PlanId]?.seatLimit ?? Infinity;
    if (Number.isFinite(seatLimit)) {
      const currentSeats = await scopedDb.user.count();
      if (currentSeats >= seatLimit) {
        return NextResponse.json(
          {
            error: `Your ${PLAN_CONFIGS[org!.plan as PlanId]?.name || "current"} plan is limited to ${seatLimit} seats. Upgrade in Settings → Billing to add more.`,
          },
          { status: 402 }
        );
      }
    }

    // Check if user already exists within this organization
    const existing = await scopedDb.user.findFirst({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists in this organization." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Scoped client automatically injects and enforces organizationId into data
    const newUser = await scopedDb.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password: hashedPassword,
        role: role as Role,
        organizationId: scopedDb.currentOrganizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        moduleAccess: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User successfully added to organization.",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error adding user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user." },
      { status: 500 }
    );
  }
}
