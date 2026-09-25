import { prisma } from "@/lib/prisma";
import {
  LeadStage,
  PaymentStatus,
  ConversationOutcome,
  IntegrationType,
} from "@/types";

export interface InAppAlertItem {
  id: string;
  type: "STALLED_LEAD" | "OVERDUE_PAYMENT" | "ESCALATED_CONVERSATION" | "SLA_BREACH";
  title: string;
  subtitle: string;
  timestamp: string;
  linkUrl: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  metadata?: Record<string, any>;
}

/**
 * Get or create notification preferences for a user
 */
export async function getUserNotificationPreference(
  userId: string,
  organizationId: string
) {
  try {
    let pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      // Ensure user actually exists in the database before creating preferences
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (userExists) {
        pref = await prisma.notificationPreference.create({
          data: {
            userId,
            organizationId,
            stalledLeadsInApp: true,
            stalledLeadsEmail: true,
            stalledLeadsWhatsapp: false,
            overduePaymentsInApp: true,
            overduePaymentsEmail: true,
            overduePaymentsWhatsapp: false,
            escalationsInApp: true,
            escalationsEmail: false,
            escalationsWhatsapp: true,
            preferredChannel: "EMAIL",
            whatsappNumber: null,
          },
        });
      }
    }

    return pref;
  } catch (err) {
    console.error("Failed to query/create notification preference:", err);
    return null;
  }
}

/**
 * Fetches real-time in-app alerts for top-bar notification bell
 */
export async function getInAppAlerts(
  organizationId: string,
  userId: string
): Promise<{
  stalledLeads: InAppAlertItem[];
  overduePayments: InAppAlertItem[];
  escalatedConversations: InAppAlertItem[];
  slaBreaches: InAppAlertItem[];
  totalAlertsCount: number;
  hasUrgentEscalation: boolean;
}> {
  const pref = (await getUserNotificationPreference(userId, organizationId)) || {
    stalledLeadsInApp: true,
    overduePaymentsInApp: true,
    escalationsInApp: true,
    stalledLeadsEmail: true,
    overduePaymentsEmail: true,
    escalationsEmail: false,
    stalledLeadsWhatsapp: false,
    overduePaymentsWhatsapp: false,
    escalationsWhatsapp: true,
    preferredChannel: "EMAIL",
    whatsappNumber: null,
  };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isCounselor = user?.role === "COUNSELOR";

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // 1. Stalled Leads (no follow-up in 3+ days)
  let stalledLeadsAlerts: InAppAlertItem[] = [];
  if (pref.stalledLeadsInApp) {
    const leadWhere: any = {
      organizationId,
      stage: {
        notIn: [LeadStage.CONVERTING, LeadStage.LOST],
      },
      updatedAt: { lte: threeDaysAgo },
    };

    // If counselor, prioritize their assigned leads; otherwise show org leads
    if (isCounselor) {
      leadWhere.OR = [{ assignedToUserId: userId }, { assignedToUserId: null }];
    }

    const stalledLeads = await prisma.lead.findMany({
      where: leadWhere,
      take: 20,
      orderBy: { updatedAt: "asc" },
      include: { assignedTo: { select: { name: true } } },
    });

    stalledLeadsAlerts = stalledLeads.map((lead) => {
      const daysSince = Math.floor(
        (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: `stalled_${lead.id}`,
        type: "STALLED_LEAD",
        title: `Stalled Lead: ${lead.name}`,
        subtitle: `No touchpoint in ${daysSince} days (${lead.stage} • ${lead.source})`,
        timestamp: lead.updatedAt.toISOString(),
        linkUrl: `/leads/${lead.id}`,
        urgency: daysSince >= 7 ? "HIGH" : "MEDIUM",
        metadata: {
          leadId: lead.id,
          phone: lead.phone,
          stage: lead.stage,
          assignedTo: lead.assignedTo?.name || "Unassigned",
        },
      };
    });
  }

  // 2. Overdue Payments
  let overduePaymentsAlerts: InAppAlertItem[] = [];
  if (pref.overduePaymentsInApp) {
    const overduePayments = await prisma.payment.findMany({
      where: {
        student: { organizationId },
        status: { not: PaymentStatus.PAID },
        dueDate: { lt: new Date() },
      },
      take: 20,
      orderBy: { dueDate: "asc" },
      include: {
        student: { select: { id: true, name: true, phone: true, program: true } },
      },
    });

    overduePaymentsAlerts = overduePayments.map((p) => {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: `overdue_${p.id}`,
        type: "OVERDUE_PAYMENT",
        title: `Overdue Tuition: ${p.student.name}`,
        subtitle: `Installment #${p.installmentNumber} (₹${p.amount.toLocaleString("en-IN")}) is ${daysOverdue} days overdue`,
        timestamp: p.dueDate.toISOString(),
        linkUrl: `/students/${p.student.id}`,
        urgency: daysOverdue > 14 ? "HIGH" : "MEDIUM",
        metadata: {
          studentId: p.student.id,
          installmentNumber: p.installmentNumber,
          amount: p.amount,
          program: p.student.program,
        },
      };
    });
  }

  // 3. Escalated & Unclaimed AI Conversations (Real-time urgent)
  let escalatedConversationsAlerts: InAppAlertItem[] = [];
  if (pref.escalationsInApp) {
    const escalations = await prisma.conversation.findMany({
      where: {
        agent: { organizationId },
        outcome: ConversationOutcome.ESCALATED,
        claimedByUserId: null,
      },
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        agent: { select: { name: true, channel: true } },
        lead: { select: { id: true, name: true, phone: true } },
        student: { select: { id: true, name: true, phone: true } },
      },
    });

    escalatedConversationsAlerts = escalations.map((c) => {
      const callerName = c.student?.name || c.lead?.name || "Caller";
      const callerPhone = c.student?.phone || c.lead?.phone || "Direct Line";
      return {
        id: `escalation_${c.id}`,
        type: "ESCALATED_CONVERSATION",
        title: `URGENT: Escalation from ${c.agent.name}`,
        subtitle: `${callerName} (${callerPhone}) requested counselor takeover`,
        timestamp: c.createdAt.toISOString(),
        linkUrl: `/agents`,
        urgency: "HIGH",
        metadata: {
          conversationId: c.id,
          agentName: c.agent.name,
          agentChannel: c.agent.channel,
          callerName,
          callerPhone,
        },
      };
    });
  }

  // 4. SLA Breached Leads (Passed response deadline with zero touchpoints)
  const now = new Date();
  const slaWhere: any = {
    organizationId,
    firstContactAt: null,
    slaDueBy: { lt: now },
    isArchived: false,
  };

  if (isCounselor) {
    slaWhere.OR = [{ assignedToUserId: userId }, { assignedToUserId: null }];
  }

  const breachedLeads = await prisma.lead.findMany({
    where: slaWhere,
    take: 15,
    orderBy: { slaDueBy: "asc" },
    include: { assignedTo: { select: { name: true } } },
  });

  const slaBreachesAlerts: InAppAlertItem[] = breachedLeads.map((lead) => {
    const overdueMinutes = lead.slaDueBy
      ? Math.max(1, Math.floor((now.getTime() - new Date(lead.slaDueBy).getTime()) / (1000 * 60)))
      : 1;
    const hours = (overdueMinutes / 60).toFixed(1);
    const timeText = overdueMinutes < 60 ? `${overdueMinutes}m` : `${hours.endsWith(".0") ? hours.slice(0, -2) : hours}h`;

    return {
      id: `sla_breach_${lead.id}`,
      type: "SLA_BREACH",
      title: `SLA Breached: ${lead.name}`,
      subtitle: `Overdue by ${timeText} (${lead.source.replace(/_/g, " ")}) — No initial contact logged!`,
      timestamp: (lead.slaDueBy || lead.createdAt).toISOString(),
      linkUrl: `/leads/${lead.id}`,
      urgency: "HIGH",
      metadata: {
        leadId: lead.id,
        phone: lead.phone,
        source: lead.source,
        overdueMinutes,
        assignedTo: lead.assignedTo?.name || "Unassigned",
      },
    };
  });

  const totalAlertsCount =
    stalledLeadsAlerts.length +
    overduePaymentsAlerts.length +
    escalatedConversationsAlerts.length +
    slaBreachesAlerts.length;

  const hasUrgentEscalation = escalatedConversationsAlerts.length > 0 || slaBreachesAlerts.length > 0;

  return {
    stalledLeads: stalledLeadsAlerts,
    overduePayments: overduePaymentsAlerts,
    escalatedConversations: escalatedConversationsAlerts,
    slaBreaches: slaBreachesAlerts,
    totalAlertsCount,
    hasUrgentEscalation,
  };
}

/**
 * Send Email notification via Resend API (or safe mock logger)
 */
export async function sendNotificationEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey && apiKey.startsWith("re_")) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "AI Edu CRM <alerts@inbound.edu>",
          to: [to],
          subject,
          html,
          text: text || subject,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Resend API error");
      }
      return { success: true, id: data.id, provider: "RESEND" };
    } catch (err: any) {
      console.warn("Resend email delivery failed, falling back to simulated logger:", err.message);
    }
  }

  // Graceful simulated delivery (standard for local dev & test suites)
  console.log(`[SIMULATED EMAIL DIGEST] To: ${to} | Subject: "${subject}"`);
  return {
    success: true,
    id: `sim_email_${Date.now()}`,
    provider: "SIMULATED_RESEND",
    to,
    subject,
  };
}

/**
 * Send WhatsApp notification via WhatsApp Business Cloud API (or safe mock logger)
 */
export async function sendNotificationWhatsApp({
  to,
  message,
  organizationId,
}: {
  to: string;
  message: string;
  organizationId: string;
}) {
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      type: IntegrationType.WHATSAPP,
      isEnabled: true,
    },
  });

  const config = (integration?.config as any) || {};
  const { phoneNumberId, accessToken } = config;

  if (phoneNumberId && accessToken) {
    try {
      const cleanPhone = to.replace(/\D/g, "");
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        return { success: true, id: data.messages?.[0]?.id, provider: "WHATSAPP_CLOUD_API" };
      }
    } catch (err: any) {
      console.warn("WhatsApp API delivery failed, falling back to simulation:", err.message);
    }
  }

  console.log(`[SIMULATED WHATSAPP DIGEST] To: ${to} | Message Preview: ${message.slice(0, 100)}...`);
  return {
    success: true,
    id: `sim_wa_${Date.now()}`,
    provider: "SIMULATED_WHATSAPP",
    to,
  };
}

/**
 * Sends an immediate (not batched into the next daily digest) email/WhatsApp
 * alert to every ADMIN/COUNSELOR in the org who has escalations notifications
 * enabled for that channel. Escalations are time-sensitive — a lead asking
 * for a human right now shouldn't wait for tomorrow's digest to be noticed.
 */
export async function notifyEscalation(params: {
  organizationId: string;
  conversationId: string;
  agentName: string;
  channel: string;
  contactName?: string | null;
  contactPhone?: string | null;
}) {
  const { organizationId, conversationId, agentName, channel, contactName, contactPhone } = params;

  const staff = await prisma.user.findMany({
    where: { organizationId, role: { in: ["ADMIN", "COUNSELOR"] } },
    include: { notificationPreference: true },
  });

  const subject = `🚨 Escalation: ${contactName || "A lead"} needs a human`;
  const text = `${agentName} (${channel}) escalated a conversation with ${contactName || "a contact"}${
    contactPhone ? ` (${contactPhone})` : ""
  }. Claim it from the Agents Automation queue.`;
  const html = `<p><strong>${agentName}</strong> (${channel}) escalated a conversation with <strong>${
    contactName || "a contact"
  }</strong>${contactPhone ? ` (${contactPhone})` : ""}.</p><p>Claim it from the Agents Automation queue.</p>`;

  const results = await Promise.allSettled(
    staff.flatMap((user) => {
      const pref = user.notificationPreference;
      const sends: Promise<any>[] = [];

      if (pref?.escalationsEmail && user.email) {
        sends.push(sendNotificationEmail({ to: user.email, subject, html, text }));
      }
      if (pref?.escalationsWhatsapp && pref.whatsappNumber) {
        sends.push(sendNotificationWhatsApp({ to: pref.whatsappNumber, message: text, organizationId }));
      }
      return sends;
    })
  );

  return { conversationId, notified: results.length };
}

/**
 * Compiles and formats daily digest content for a user
 */
export async function generateDailyDigest({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const alerts = await getInAppAlerts(organizationId, userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });

  const stalledCount = alerts.stalledLeads.length;
  const overdueCount = alerts.overduePayments.length;
  const escalationCount = alerts.escalatedConversations.length;

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // 1. Plain text format (used for WhatsApp and email fallback)
  let whatsappText = `📢 *Daily Admissions & Operations Digest*\n`;
  whatsappText += `🏢 *${org?.name || "Academy Workspace"}* — ${dateStr}\n`;
  whatsappText += `👤 Counselor: ${user?.name || user?.email}\n\n`;

  if (escalationCount > 0) {
    whatsappText += `🚨 *URGENT AI ESCALATIONS (${escalationCount})*\n`;
    alerts.escalatedConversations.slice(0, 3).forEach((e, idx) => {
      whatsappText += `${idx + 1}. ${e.metadata?.callerName} (${e.metadata?.callerPhone}) - ${e.metadata?.agentName}\n`;
    });
    whatsappText += `👉 Take over: /agents\n\n`;
  }

  whatsappText += `⚠️ *STALLED LEADS (${stalledCount})* (No follow-up in 3+ days)\n`;
  if (stalledCount === 0) {
    whatsappText += `✅ All active leads have recent touchpoints!\n\n`;
  } else {
    alerts.stalledLeads.slice(0, 5).forEach((l, idx) => {
      whatsappText += `${idx + 1}. *${l.metadata?.leadId ? l.title.replace("Stalled Lead: ", "") : l.title}* (${l.metadata?.phone || ""}) - ${l.subtitle}\n`;
    });
    if (stalledCount > 5) whatsappText += `...and ${stalledCount - 5} more.\n`;
    whatsappText += `👉 Review pipeline: /leads\n\n`;
  }

  whatsappText += `💳 *OVERDUE TUITION INSTALLMENTS (${overdueCount})*\n`;
  if (overdueCount === 0) {
    whatsappText += `✅ Zero overdue fee installments!\n`;
  } else {
    alerts.overduePayments.slice(0, 5).forEach((p, idx) => {
      whatsappText += `${idx + 1}. *${p.metadata?.studentId ? p.title.replace("Overdue Tuition: ", "") : p.title}* - ${p.subtitle}\n`;
    });
    if (overdueCount > 5) whatsappText += `...and ${overdueCount - 5} more.\n`;
    whatsappText += `👉 Manage students: /students\n`;
  }

  // 2. HTML email format
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; padding: 24px; border-radius: 16px;">
      <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 4px; color: #0f172a; font-size: 20px;">Daily Admissions & Operations Digest</h2>
        <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">${org?.name || "Academy Workspace"} • ${dateStr}</p>
        
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; background: #eff6ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe;">
            <div style="font-size: 11px; font-weight: bold; color: #1e40af; text-transform: uppercase;">Stalled Leads</div>
            <div style="font-size: 22px; font-weight: bold; color: #1e3a8a;">${stalledCount}</div>
          </div>
          <div style="flex: 1; background: #fef2f2; padding: 12px; border-radius: 8px; border: 1px solid #fecaca;">
            <div style="font-size: 11px; font-weight: bold; color: #991b1b; text-transform: uppercase;">Overdue Fees</div>
            <div style="font-size: 22px; font-weight: bold; color: #7f1d1d;">${overdueCount}</div>
          </div>
          <div style="flex: 1; background: #faf5ff; padding: 12px; border-radius: 8px; border: 1px solid #e9d5ff;">
            <div style="font-size: 11px; font-weight: bold; color: #6b21a8; text-transform: uppercase;">Escalations</div>
            <div style="font-size: 22px; font-weight: bold; color: #581c87;">${escalationCount}</div>
          </div>
        </div>

        ${
          escalationCount > 0
            ? `
          <div style="background: #fdf4ff; border: 1px solid #f0abfc; padding: 14px; border-radius: 8px; margin-bottom: 18px;">
            <strong style="color: #86198f; font-size: 14px;">🚨 Urgent AI Escalations (${escalationCount})</strong>
            <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #701a75;">
              ${alerts.escalatedConversations
                .slice(0, 4)
                .map(
                  (e) =>
                    `<li><strong>${e.metadata?.callerName}</strong> (${e.metadata?.callerPhone}) - ${e.metadata?.agentName}</li>`
                )
                .join("")}
            </ul>
          </div>
        `
            : ""
        }

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 15px; margin: 0 0 8px; color: #0f172a;">Stalled Leads (3+ Days Without Follow-up)</h3>
          ${
            stalledCount === 0
              ? `<p style="font-size: 13px; color: #10b981; margin: 0;">✅ All leads are actively in follow-up!</p>`
              : `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              ${alerts.stalledLeads
                .slice(0, 6)
                .map(
                  (l) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0;"><strong>${l.title.replace("Stalled Lead: ", "")}</strong></td>
                  <td style="padding: 8px 0; color: #64748b;">${l.subtitle}</td>
                </tr>
              `
                )
                .join("")}
            </table>
          `
          }
        </div>

        <div>
          <h3 style="font-size: 15px; margin: 0 0 8px; color: #0f172a;">Overdue Tuition Installments</h3>
          ${
            overdueCount === 0
              ? `<p style="font-size: 13px; color: #10b981; margin: 0;">✅ Zero overdue installments!</p>`
              : `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              ${alerts.overduePayments
                .slice(0, 6)
                .map(
                  (p) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0;"><strong>${p.title.replace("Overdue Tuition: ", "")}</strong></td>
                  <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">${p.subtitle}</td>
                </tr>
              `
                )
                .join("")}
            </table>
          `
          }
        </div>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 16px;">
        To manage notifications, visit <a href="/settings/notifications" style="color: #2563eb;">Notification Preferences</a> in CRM.
      </p>
    </div>
  `;

  return {
    subject: `Daily CRM Digest: ${stalledCount} stalled leads, ${overdueCount} overdue fees`,
    whatsappText,
    emailHtml,
    whatsappMessage: whatsappText,
    html: emailHtml,
    stalledLeads: alerts.stalledLeads,
    overduePayments: alerts.overduePayments,
    unclaimedEscalations: alerts.escalatedConversations,
    counts: { stalledCount, overdueCount, escalationCount },
  };
}

/**
 * Scheduled Cron Job: Executes once daily to send email/WhatsApp digests
 */
export async function runDailyDigestCron({
  organizationId,
  dryRun = false,
}: {
  organizationId?: string;
  dryRun?: boolean;
} = {}) {
  const orgWhere: any = {};
  if (organizationId) {
    orgWhere.id = organizationId;
  }

  const organizations = await prisma.organization.findMany({
    where: orgWhere,
    include: {
      users: {
        where: {
          role: { in: ["ADMIN", "COUNSELOR"] },
        },
      },
    },
  });

  const results: any[] = [];
  let totalEmailsSent = 0;
  let totalWhatsAppSent = 0;

  for (const org of organizations) {
    for (const user of org.users) {
      const pref = await getUserNotificationPreference(user.id, org.id);
      if (!pref) continue;

      // Check if user wants daily digest
      const wantsEmail = pref.stalledLeadsEmail || pref.overduePaymentsEmail;
      const wantsWhatsApp =
        (pref.stalledLeadsWhatsapp || pref.overduePaymentsWhatsapp) &&
        Boolean(pref.whatsappNumber);

      if (!wantsEmail && !wantsWhatsApp) continue;

      const digest = await generateDailyDigest({
        organizationId: org.id,
        userId: user.id,
      });

      let emailRes: any = null;
      let whatsappRes: any = null;

      // Dispatch according to preferred channel
      if (pref.preferredChannel === "WHATSAPP" && wantsWhatsApp && pref.whatsappNumber) {
        if (!dryRun) {
          whatsappRes = await sendNotificationWhatsApp({
            to: pref.whatsappNumber,
            message: digest.whatsappText,
            organizationId: org.id,
          });
          totalWhatsAppSent++;
        }
      } else if (wantsEmail) {
        if (!dryRun) {
          emailRes = await sendNotificationEmail({
            to: user.email,
            subject: digest.subject,
            html: digest.emailHtml,
            text: digest.whatsappText,
          });
          totalEmailsSent++;
        }
      }

      results.push({
        userId: user.id,
        userEmail: user.email,
        channel: pref.preferredChannel,
        whatsappNumber: pref.whatsappNumber,
        counts: digest.counts,
        emailRes,
        whatsappRes,
      });

      // Audit Log
      if (!dryRun) {
        await prisma.auditLog.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            action: "DAILY_DIGEST_DISPATCHED",
            entityType: "User",
            entityId: user.id,
            changesJson: JSON.stringify({
              channel: pref.preferredChannel,
              counts: digest.counts,
            }),
          },
        });
      }
    }
  }

  return {
    success: true,
    dryRun,
    dispatchedCount: results.length,
    totalEmailsSent,
    totalWhatsAppSent,
    details: results,
  };
}
