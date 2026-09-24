import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const orgId = session.user.organizationId;

    const [org, integrationsCount, counselorsCount, templatesCount, paymentsCount] =
      await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { plan: true, subscriptionStatus: true, onboardingDismissed: true },
        }),
        prisma.integration.count({
          where: { organizationId: orgId, isEnabled: true },
        }),
        prisma.user.count({
          where: { organizationId: orgId, role: "COUNSELOR" },
        }),
        prisma.documentTemplate.count({
          where: { organizationId: orgId },
        }),
        prisma.payment.count({
          where: { student: { organizationId: orgId } },
        }),
      ]);

    const steps = [
      {
        id: "lead_source",
        title: "Connect a Lead Source",
        description: "Set up inbound ingestion via Meta Ads, WhatsApp, or Google Sheets sync.",
        completed: integrationsCount > 0,
        href: "/settings/integrations",
        actionLabel: "Configure Integrations",
      },
      {
        id: "invite_counselor",
        title: "Invite Your First Counselor",
        description: "Add an admissions counselor to assign leads and review conversion workflows.",
        completed: counselorsCount > 0,
        href: "/settings/users",
        actionLabel: "Invite Team",
      },
      {
        id: "document_template",
        title: "Set Up Document Checklist",
        description: "Define a program document verification checklist (e.g. Degree, ID, Visa).",
        completed: templatesCount > 0,
        href: "/settings",
        actionLabel: "Create Template",
      },
      {
        id: "payment_plan",
        title: "Configure Tuition / ERP Sync",
        description: "Set up tuition installment structure or connect automated ERP webhooks.",
        completed: paymentsCount > 0,
        href: "/settings/integrations/erp",
        actionLabel: "Set Up ERP / Fees",
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const totalCount = steps.length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    const isAllCompleted = completedCount === totalCount;

    return NextResponse.json({
      dismissed: org?.onboardingDismissed || false,
      completedCount,
      totalCount,
      progressPercent,
      isAllCompleted,
      plan: org?.plan || "SELF_SERVE",
      subscriptionStatus: org?.subscriptionStatus || "ACTIVE",
      steps,
    });
  } catch (error: any) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { error: "Failed to load onboarding status." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { dismissed } = body;

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        onboardingDismissed: Boolean(dismissed),
      },
    });

    return NextResponse.json({ success: true, dismissed });
  } catch (error: any) {
    console.error("Error updating onboarding dismissal:", error);
    return NextResponse.json(
      { error: "Failed to update dismissal status." },
      { status: 500 }
    );
  }
}
