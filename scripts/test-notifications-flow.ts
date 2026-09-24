import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import {
  getUserNotificationPreference,
  getInAppAlerts,
  generateDailyDigest,
  runDailyDigestCron,
  sendNotificationEmail,
  sendNotificationWhatsApp,
} from "../lib/notifications";
import { LeadSource, LeadStage, PaymentStatus, ConversationOutcome } from "@prisma/client";

async function main() {
  console.log("=== Testing Notification System Flow ===");

  let org = await prisma.organization.findFirst({
    where: { name: "Notification Test University" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Notification Test University",
        slug: "notification-test-university",
      },
    });
  }
  console.log("Organization ready:", org.id, org.name);

  let user = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "counselor.notif@test.edu" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: "counselor.notif@test.edu",
        name: "Aarav Sharma",
        role: "COUNSELOR",
        password: "$2a$10$hashedpasswordplaceholder1234567890",
      },
    });
  }
  console.log("Counselor ready:", user.id, user.name);

  const pref = await getUserNotificationPreference(user.id, org.id);
  console.log("Preferences fetched/created:", {
    userId: pref.userId,
    preferredChannel: pref.preferredChannel,
    stalledLeadsInApp: pref.stalledLeadsInApp,
    overduePaymentsInApp: pref.overduePaymentsInApp,
    escalationsInApp: pref.escalationsInApp,
  });

  const updatedPref = await prisma.notificationPreference.update({
    where: { userId: user.id },
    data: {
      whatsappNumber: "+919876543210",
      preferredChannel: "WHATSAPP",
    },
  });
  console.log("Preferences updated to WhatsApp channel with number:", updatedPref.whatsappNumber);

  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  let stalledLead = await prisma.lead.findFirst({
    where: {
      organizationId: org.id,
      phone: "+919811223344",
    },
  });

  if (!stalledLead) {
    stalledLead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        name: "Rohan Verma (Stalled)",
        phone: "+919811223344",
        email: "rohan.stalled@test.edu",
        source: LeadSource.META_ADS,
        stage: LeadStage.WARM,
        assignedToUserId: user.id,
        updatedAt: fourDaysAgo,
      },
    });
  } else {
    stalledLead = await prisma.lead.update({
      where: { id: stalledLead.id },
      data: {
        assignedToUserId: user.id,
        stage: LeadStage.WARM,
        updatedAt: fourDaysAgo,
      },
    });
  }
  await prisma.lead.update({
    where: { id: stalledLead.id },
    data: { updatedAt: fourDaysAgo },
  });
  console.log("Seeded stalled lead:", stalledLead.name, "updatedAt:", fourDaysAgo.toISOString());

  let student = await prisma.student.findFirst({
    where: { organizationId: org.id, email: "priya.student@test.edu" },
  });
  if (!student) {
    student = await prisma.student.create({
      data: {
        organizationId: org.id,
        name: "Priya Patel",
        phone: "+919822334455",
        email: "priya.student@test.edu",
        stage: "ENROLLED",
        program: "Data Science MBA",
        cohort: "Spring 2026",
      },
    });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const overduePayment = await prisma.payment.upsert({
    where: { id: "test-overdue-payment-1" },
    update: {
      dueDate: yesterday,
      status: PaymentStatus.OVERDUE,
    },
    create: {
      id: "test-overdue-payment-1",
      studentId: student.id,
      amount: 45000,
      dueDate: yesterday,
      status: PaymentStatus.OVERDUE,
      installmentNumber: 2,
    },
  });
  console.log("Seeded overdue payment:", overduePayment.id, "amount: Rs.45,000, dueDate:", yesterday.toISOString());

  let agent = await prisma.agent.findFirst({
    where: { organizationId: org.id },
  });
  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        organizationId: org.id,
        name: "Admissions Voice Bot",
        type: "VOICE",
        status: "LIVE",
        config: {},
      },
    });
  }

  const escalatedConv = await prisma.conversation.upsert({
    where: { id: "test-escalated-conv-1" },
    update: {
      outcome: ConversationOutcome.ESCALATED,
      claimedByUserId: null,
      leadId: stalledLead.id,
    },
    create: {
      id: "test-escalated-conv-1",
      agentId: agent.id,
      leadId: stalledLead.id,
      channel: "VOICE",
      transcript: "Caller: I need to speak to an admissions supervisor immediately.",
      outcome: ConversationOutcome.ESCALATED,
      claimedByUserId: null,
    },
  });
  console.log("Seeded escalated AI conversation:", escalatedConv.id);

  const inAppAlerts = await getInAppAlerts(org.id, user.id);
  console.log("In-App Alerts Result:", {
    total: inAppAlerts.totalAlertsCount,
    stalledLeads: inAppAlerts.stalledLeads.length,
    overduePayments: inAppAlerts.overduePayments.length,
    escalatedConversations: inAppAlerts.escalatedConversations.length,
    hasUrgentEscalation: inAppAlerts.hasUrgentEscalation,
  });

  if (
    inAppAlerts.stalledLeads.length === 0 ||
    inAppAlerts.overduePayments.length === 0 ||
    inAppAlerts.escalatedConversations.length === 0
  ) {
    throw new Error("Expected at least 1 stalled lead, 1 overdue payment, and 1 escalated conversation in in-app alerts!");
  }

  const digest = await generateDailyDigest({
    organizationId: org.id,
    userId: user.id,
  });
  console.log("Daily Digest generated:");
  console.log("  Subject:", digest.subject);
  console.log("  Stalled Leads Count:", digest.stalledLeads.length);
  console.log("  Overdue Payments Count:", digest.overduePayments.length);
  console.log("  Unclaimed Escalations Count:", digest.unclaimedEscalations.length);

  const emailRes = await sendNotificationEmail({
    to: user.email,
    subject: digest.subject,
    html: digest.html,
    text: digest.whatsappMessage,
  });
  console.log("Email Dispatch Result:", emailRes);

  const waRes = await sendNotificationWhatsApp({
    to: updatedPref.whatsappNumber || "+919876543210",
    message: digest.whatsappMessage,
    organizationId: org.id,
  });
  console.log("WhatsApp Dispatch Result:", waRes);

  console.log("=== Running Daily Digest Cron Batch ===");
  const cronReport = await runDailyDigestCron({
    organizationId: org.id,
    dryRun: false,
  });
  console.log("Cron Batch Report:", cronReport);

  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      organizationId: org.id,
      action: "DAILY_DIGEST_DISPATCHED",
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("AuditLog verification:", auditEntry ? {
    action: auditEntry.action,
    entityType: auditEntry.entityType,
    changesJson: auditEntry.changesJson,
  } : "None");

  const otherOrg = await prisma.organization.create({
    data: { name: "Other University Org", slug: "other-univ-" + Date.now() },
  });
  const otherUser = await prisma.user.create({
    data: {
      organizationId: otherOrg.id,
      email: "other.user@" + Date.now() + ".edu",
      name: "Other Counselor",
      role: "COUNSELOR",
      password: "dummy_hashed_password",
    },
  });
  const otherOrgAlerts = await getInAppAlerts(otherOrg.id, otherUser.id);
  console.log("Other Org Alerts (must be empty/isolated):", otherOrgAlerts.totalAlertsCount);
  if (otherOrgAlerts.totalAlertsCount !== 0) {
    throw new Error("Multi-tenant isolation failed: other organization saw test alerts!");
  }

  await prisma.user.delete({ where: { id: otherUser.id } });
  await prisma.organization.delete({ where: { id: otherOrg.id } });
  console.log("Multi-tenant isolation verified 100%.");

  console.log("🎉 ALL NOTIFICATION TESTS PASSED SUCCESSFULLY!");
}

main()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
