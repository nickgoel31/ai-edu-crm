import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationType } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  // Enforce ADMIN role
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required to manage integrations." },
      { status: 403 }
    );
  }

  try {
    const orgId = session.user.organizationId;

    // Ensure all 3 integration types exist for this organization
    const requiredTypes: string[] = [
      IntegrationType.META_ADS,
      IntegrationType.WHATSAPP,
      IntegrationType.GOOGLE_SHEETS,
    ];

    for (const itype of requiredTypes) {
      const existing = await prisma.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: orgId,
            type: itype,
          },
        },
      });

      if (!existing) {
        const randomSecret = `whsec_${itype.toLowerCase().slice(0, 4)}_${Math.random()
          .toString(36)
          .substring(2, 10)}`;

        const defaultConfig =
          itype === IntegrationType.GOOGLE_SHEETS
            ? { sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", sheetRange: "Sheet1!A2:E" }
            : {};

        await prisma.integration.create({
          data: {
            organizationId: orgId,
            type: itype,
            webhookSecret: randomSecret,
            isEnabled: true,
            config: JSON.stringify(defaultConfig),
          },
        });
      }
    }

    const integrations = await prisma.integration.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });

    const parsedIntegrations = integrations.map((i) => ({
      ...i,
      config: typeof i.config === "string" ? JSON.parse(i.config) : i.config,
    }));

    return NextResponse.json({ integrations: parsedIntegrations });
  } catch (error: any) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch integrations." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Only organization admins can modify integrations." },
      { status: 403 }
    );
  }

  try {
    const orgId = session.user.organizationId;
    const body = await req.json();
    const { type, webhookSecret, isEnabled, config } = body;

    if (!type || !Object.values(IntegrationType).includes(type)) {
      return NextResponse.json(
        { error: "Valid integration type is required." },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret.trim();
    if (isEnabled !== undefined) updateData.isEnabled = Boolean(isEnabled);
    if (config !== undefined) updateData.config = typeof config === "string" ? config : JSON.stringify(config);

    const updated = await prisma.integration.upsert({
      where: {
        organizationId_type: {
          organizationId: orgId,
          type,
        },
      },
      update: updateData,
      create: {
        organizationId: orgId,
        type,
        webhookSecret: webhookSecret?.trim() || `whsec_${Math.random().toString(36).slice(2, 10)}`,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
        config: config ? (typeof config === "string" ? config : JSON.stringify(config)) : null,
      },
    });

    return NextResponse.json({
      message: `${type} integration settings saved.`,
      integration: {
        ...updated,
        config: typeof updated.config === "string" ? JSON.parse(updated.config) : updated.config,
      },
    });
  } catch (error: any) {
    console.error("Error saving integration:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update integration settings." },
      { status: 500 }
    );
  }
}
