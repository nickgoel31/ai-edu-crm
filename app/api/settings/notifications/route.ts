import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getUserNotificationPreference,
  generateDailyDigest,
  sendNotificationEmail,
  sendNotificationWhatsApp,
} from "@/lib/notifications";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pref = await getUserNotificationPreference(
      session.user.id,
      session.user.organizationId
    );

    return NextResponse.json({ preference: pref });
  } catch (error: any) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const allowedFields = [
      "stalledLeadsInApp",
      "stalledLeadsEmail",
      "stalledLeadsWhatsapp",
      "overduePaymentsInApp",
      "overduePaymentsEmail",
      "overduePaymentsWhatsapp",
      "escalationsInApp",
      "escalationsEmail",
      "escalationsWhatsapp",
      "preferredChannel",
      "whatsappNumber",
    ];

    const dataToUpdate: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        dataToUpdate[field] = body[field];
      }
    }

    await getUserNotificationPreference(
      session.user.id,
      session.user.organizationId
    );

    const updated = await prisma.notificationPreference.update({
      where: { userId: session.user.id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      preference: updated,
    });
  } catch (error: any) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const channel = body.channel || "EMAIL";

    const pref = await getUserNotificationPreference(
      session.user.id,
      session.user.organizationId
    );

    const digest = await generateDailyDigest({
      organizationId: session.user.organizationId,
      userId: session.user.id,
    });

    let result;
    if (channel === "WHATSAPP") {
      const recipientNumber = body.whatsappNumber || pref?.whatsappNumber;
      if (!recipientNumber) {
        return NextResponse.json(
          { error: "No WhatsApp phone number provided or configured" },
          { status: 400 }
        );
      }

      result = await sendNotificationWhatsApp({
        to: recipientNumber,
        message: digest.whatsappMessage,
        organizationId: session.user.organizationId,
      });
    } else {
      const recipientEmail = session.user.email;
      if (!recipientEmail) {
        return NextResponse.json(
          { error: "User does not have a configured email address" },
          { status: 400 }
        );
      }

      result = await sendNotificationEmail({
        to: recipientEmail,
        subject: `[Test] ${digest.subject}`,
        html: digest.html,
        text: digest.whatsappMessage,
      });
    }

    return NextResponse.json({
      success: true,
      channel,
      result,
      summary: {
        stalledLeadsCount: digest.stalledLeads.length,
        overduePaymentsCount: digest.overduePayments.length,
        escalationsCount: digest.unclaimedEscalations.length,
      },
    });
  } catch (error: any) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send test notification" },
      { status: 500 }
    );
  }
}
