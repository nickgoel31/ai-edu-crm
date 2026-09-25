import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/lib/billing/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { organizationName, name, email, password, plan } = body;

    if (!organizationName || !name || !email || !password) {
      return NextResponse.json(
        { error: "Organization name, full name, email, and password are required." },
        { status: 400 }
      );
    }

    const validPlans = ["SELF_SERVE", "SELF_SERVE_AGENTS", "MANAGED"];
    const selectedPlan = plan && validPlans.includes(plan) ? plan : "SELF_SERVE";

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrgName = organizationName.trim();
    const trimmedName = name.trim();

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Generate slug from org name
    const baseSlug = trimmedOrgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${baseSlug || "org"}-${Math.random().toString(36).substring(2, 7)}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Organization and Admin User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: trimmedOrgName,
          slug,
          plan: selectedPlan,
          // Every org starts on a real, time-boxed trial — no payment
          // collected at signup. lib/billing/access.ts blocks AI-agent
          // usage (not the rest of the CRM) once this runs out with no
          // active Stripe subscription behind it.
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        },
      });

      const user = await tx.user.create({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          password: hashedPassword,
          role: "ADMIN",
          organizationId: organization.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: "ORGANIZATION_CREATED",
          entityType: "Organization",
          entityId: organization.id,
          changesJson: JSON.stringify({
            plan: selectedPlan,
            adminEmail: trimmedEmail,
            organizationName: trimmedOrgName,
          }),
        },
      });

      return { organization, user };
    });

    return NextResponse.json(
      {
        message: "Organization and admin account created successfully.",
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to complete registration." },
      { status: 500 }
    );
  }
}
