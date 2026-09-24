import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
import { assertCanMutate } from "../lib/rbac";
import { AgentStatus, ConversationOutcome } from "@prisma/client";
// Dynamic import will be used inside the test


async function run() {
  console.log("Starting Agents module verification suite...\n");

  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
    include: { integrations: true },
  });

  if (!org) {
    throw new Error("Apex Tech Academy organization not found.");
  }

  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "ADMIN" },
  });

  const counselor = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "COUNSELOR" },
  });

  const readonlyUser = await prisma.user.findFirst({
    where: { organizationId: org.id, role: "READONLY" },
  });

  if (!admin || !counselor || !readonlyUser) {
    throw new Error("Required users (ADMIN, COUNSELOR, READONLY) not found.");
  }

  const session = {
    user: {
      id: counselor.id,
      email: counselor.email,
      role: counselor.role,
      organizationId: org.id,
    },
  };

  const scopedDb = getScopedPrismaClient(session as any);

  // 1. Verify Agents Dashboard and KPI queries
  console.log("1. Testing Agent Dashboard & KPI computation...");
  const agents = await scopedDb.agent.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`[PASS] Found ${agents.length} agents in tenant.`);
  if (agents.length === 0) {
    throw new Error("Expected at least one agent to be seeded.");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const agent of agents) {
    const todayCount = await scopedDb.conversation.count({
      where: { agentId: agent.id, createdAt: { gte: startOfToday } },
    });
    const weekCount = await scopedDb.conversation.count({
      where: { agentId: agent.id, createdAt: { gte: sevenDaysAgo } },
    });
    const totalConv = await scopedDb.conversation.count({
      where: { agentId: agent.id },
    });
    const convertedConv = await scopedDb.conversation.count({
      where: { agentId: agent.id, outcome: "CONVERTED" },
    });
    const rate = totalConv > 0 ? Math.round((convertedConv / totalConv) * 100) : 0;
    const costAgg = await scopedDb.conversation.aggregate({
      where: { agentId: agent.id, createdAt: { gte: startOfMonth } },
      _sum: { costInPaise: true },
    });
    const costInRupees = ((costAgg._sum.costInPaise || 0) / 100).toFixed(2);

    console.log(
      `   * ${agent.name} (${agent.channel}) [${agent.status}]: today=${todayCount}, week=${weekCount}, convRate=${rate}%, cost=₹${costInRupees}`
    );
  }
  console.log("[PASS] Agent KPI computations succeeded.\n");

  // 2. Test Agent Status Toggle and Config updates
  console.log("2. Testing Agent Status Toggle & Config updates...");
  const targetAgent = agents[0];
  const originalStatus = targetAgent.status;
  const newStatus = originalStatus === AgentStatus.LIVE ? AgentStatus.PAUSED : AgentStatus.LIVE;

  // Toggle status
  const updatedAgent = await scopedDb.agent.update({
    where: { id: targetAgent.id },
    data: { status: newStatus },
  });
  console.log(`[PASS] Toggled agent status from ${originalStatus} to ${updatedAgent.status}`);

  // Update config metadata
  const originalConfig = (targetAgent.config as any) || {};
  const updatedConfig = {
    ...originalConfig,
    workingHours: "09:00 - 21:00 IST",
    language: "Hindi + English",
    scriptPromptVersion: "v2.5-screener-strict",
  };

  const agentWithNewConfig = await scopedDb.agent.update({
    where: { id: targetAgent.id },
    data: {
      status: originalStatus, // revert back
      config: updatedConfig,
    },
  });
  console.log(
    `[PASS] Updated agent config: workingHours="${(agentWithNewConfig.config as any)?.workingHours}", promptVersion="${(agentWithNewConfig.config as any)?.scriptPromptVersion}"\n`
  );

  // 3. Test Webhook Ingestion (/api/webhooks/agent-conversation)
  console.log("3. Testing Inbound Agent Conversation Webhook...");
  // Find or create integration token
  let token = org.integrations[0]?.webhookSecret;
  if (!token) {
    const integ = await prisma.integration.create({
      data: {
        organizationId: org.id,
        type: "META_ADS",
        webhookSecret: "test-agent-secret-" + Date.now(),
        isEnabled: true,
      },
    });
    token = integ.webhookSecret;
  }

  // Get an existing student to test matching
  const testStudent = await scopedDb.student.findFirst({
    where: { phone: { not: "" } },
  });
  if (!testStudent) {
    throw new Error("Expected at least one student with phone to test matching.");
  }
  console.log(`   Target existing student for webhook matching: ${testStudent.name} (${testStudent.phone})`);

  // Webhook 1: Voice Screener CONVERTED call
  const callPayload1 = {
    agentId: agents[0].id,
    callerPhone: testStudent.phone,
    callerName: testStudent.name,
    durationSeconds: 185,
    outcome: "CONVERTED",
    costInPaise: 450,
    transcript: [
      { speaker: "agent", text: "Hello, thank you for calling Apex Tech Academy! How can I assist you today?", timestamp: "00:01" },
      { speaker: "caller", text: "Hi! I wanted to check my upcoming cohort start date.", timestamp: "00:08" },
      { speaker: "agent", text: "I can see your enrollment in Full Stack AI Engineering is confirmed for Batch 2026-Q2.", timestamp: "00:15" },
      { speaker: "caller", text: "Fantastic, that answers my question. Thank you!", timestamp: "00:22" },
      { speaker: "agent", text: "You are very welcome! Have a wonderful day.", timestamp: "00:25" }
    ],
    metadata: {
      callId: "call_test_" + Date.now(),
      platform: "retell",
    }
  };

  const { POST: handleAgentWebhook } = await import("../app/api/webhooks/agent-conversation/route");
  const { NextRequest } = await import("next/server");

  const req1 = new NextRequest(`http://localhost:3000/api/webhooks/agent-conversation?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(callPayload1),
  });

  const res1 = await handleAgentWebhook(req1);
  const data1 = await res1.json();
  console.log(`[PASS] Webhook 1 Response (status ${res1.status}):`, data1);
  if (!data1.success || !data1.conversationId) {
    throw new Error("Webhook 1 failed to record conversation.");
  }

  // Webhook 2: WhatsApp ESCALATED conversation
  const callPayload2 = {
    agentId: agents.length > 1 ? agents[1].id : agents[0].id,
    callerPhone: testStudent.phone,
    callerName: testStudent.name,
    durationSeconds: 240,
    outcome: "ESCALATED",
    costInPaise: 120,
    transcript: [
      { speaker: "caller", text: "I need urgent assistance with my tuition payment installment.", timestamp: "10:00" },
      { speaker: "agent", text: "I understand. Let me check with our finance team. Could you confirm your payment receipt?", timestamp: "10:01" },
      { speaker: "caller", text: "I transferred via NEFT but the portal still shows OVERDUE. Please connect me to a counselor immediately.", timestamp: "10:02" },
      { speaker: "agent", text: "Understood. I am escalating this conversation immediately to our senior admissions and finance desk.", timestamp: "10:03" }
    ],
    metadata: {
      chatId: "wa_chat_" + Date.now(),
      platform: "dograh",
      urgency: "HIGH",
    }
  };

  const req2 = new NextRequest(`http://localhost:3000/api/webhooks/agent-conversation?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(callPayload2),
  });

  const res2 = await handleAgentWebhook(req2);
  const data2 = await res2.json();
  console.log(`[PASS] Webhook 2 Response (status ${res2.status}):`, data2);
  if (!data2.success || !data2.conversationId) {
    throw new Error("Webhook 2 failed to record conversation.");
  }
  console.log("[PASS] Inbound Agent Webhooks succeeded.\n");

  // 4. Test Escalation Queue & Counselor Claim
  console.log("4. Testing Escalation Queue and Claim & Take Over...");
  // Query pending escalations
  const escalations = await scopedDb.conversation.findMany({
    where: { outcome: ConversationOutcome.ESCALATED },
    include: {
      agent: true,
      lead: true,
      student: true,
      claimedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const targetEscalation = escalations.find((e) => e.id === data2.conversationId);
  if (!targetEscalation) {
    throw new Error("Created escalated conversation not found in escalation queue.");
  }
  console.log(`   Found escalated conversation ID: ${targetEscalation.id}`);
  console.log(`   Current claimed status: ${targetEscalation.claimedByUserId || "UNCLAIMED"}`);

  // Counselor claims the escalation
  const claimedEscalation = await scopedDb.conversation.update({
    where: { id: targetEscalation.id },
    data: {
      claimedByUserId: counselor.id,
      claimedAt: new Date(),
    },
    include: {
      claimedBy: true,
    },
  });

  await scopedDb.auditLog.create({
    data: {
      organizationId: org.id,
      userId: counselor.id,
      entityType: "Conversation",
      entityId: targetEscalation.id,
      action: "CLAIM_ESCALATION",
      changesJson: {
        agentId: targetEscalation.agentId,
        callerPhone: targetEscalation.student?.phone || targetEscalation.lead?.phone || "",
      },
    },
  });

  console.log(`[PASS] Counselor ${counselor.name} (${counselor.email}) successfully claimed escalation.`);
  console.log(`   Claimed at: ${claimedEscalation.claimedAt?.toISOString()}, Claimed by: ${claimedEscalation.claimedBy?.name}\n`);

  // 5. Test Student Communication Timeline linkage
  console.log("5. Testing Student Communication Timeline linkage...");
  const studentWithTimeline = await scopedDb.student.findUnique({
    where: { id: testStudent.id },
    include: {
      lead: true,
      conversations: {
        include: {
          agent: true,
          claimedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!studentWithTimeline) {
    throw new Error("Student not found.");
  }

  console.log(`   Student: ${studentWithTimeline.name}`);
  console.log(`   Total conversations in timeline: ${studentWithTimeline.conversations.length}`);
  const matchingConv1 = studentWithTimeline.conversations.find((c) => c.id === data1.conversationId);
  const matchingConv2 = studentWithTimeline.conversations.find((c) => c.id === data2.conversationId);

  if (!matchingConv1 || !matchingConv2) {
    throw new Error("Ingested conversations are not present in student timeline.");
  }
  console.log(`   * Verified Voice Conversation (${matchingConv1.outcome}) linked to student.`);
  console.log(`   * Verified WhatsApp Escalated Conversation (${matchingConv2.outcome}) linked to student.`);
  console.log("[PASS] Student Communication Timeline linkage verified.\n");

  // 6. RBAC Enforcement test
  console.log("6. Testing RBAC enforcement for READONLY users...");
  const readonlySession = {
    user: {
      id: readonlyUser.id,
      email: readonlyUser.email,
      role: readonlyUser.role,
      organizationId: org.id,
    },
  };

  let caughtRbacError = false;
  try {
    assertCanMutate(readonlySession as any);
  } catch (err: any) {
    caughtRbacError = true;
    console.log(`   [PASS] assertCanMutate caught READONLY access as expected: "${err.message}"`);
  }

  if (!caughtRbacError) {
    throw new Error("RBAC failed: READONLY user was permitted mutation access.");
  }

  console.log("\n========================================================");
  console.log("ALL AGENT MODULE TESTS PASSED CLEANLY!");
  console.log("========================================================\n");
}

run()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
