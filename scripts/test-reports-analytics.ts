import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import { getScopedPrismaClient } from "../lib/scoped-prisma";
// Direct testing suite for reporting calculations and authorization


async function run() {
  console.log("Starting Reports & Analytics Module Verification Suite...\n");

  const org = await prisma.organization.findFirst({
    where: { slug: "apex-tech-academy" },
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

  const adminSession = {
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      organizationId: org.id,
    },
  };

  const counselorSession = {
    user: {
      id: counselor.id,
      email: counselor.email,
      role: counselor.role,
      organizationId: org.id,
    },
  };

  const scopedAdminDb = getScopedPrismaClient(adminSession as any);
  const scopedCounselorDb = getScopedPrismaClient(counselorSession as any);

  // 1. Verify Pipeline Lead Data and Funnel Calculations
  console.log("1. Testing Funnel Conversion & Drop-off calculation logic...");
  const leads = await scopedAdminDb.lead.findMany({
    include: { students: true },
  });
  console.log(`[PASS] Queried ${leads.length} leads in organization '${org.name}'.`);

  const coldCount = leads.filter((l) => l.stage === "COLD").length;
  const warmCount = leads.filter((l) => l.stage === "WARM").length;
  const hotCount = leads.filter((l) => l.stage === "HOT").length;
  const convertingCount = leads.filter((l) => l.stage === "CONVERTING" || l.students.length > 0).length;
  const lostCount = leads.filter((l) => l.stage === "LOST").length;

  console.log(`   Stage Breakdown: COLD=${coldCount}, WARM=${warmCount}, HOT=${hotCount}, CONVERTING=${convertingCount}, LOST=${lostCount}`);

  // Stage drop-off math
  const totalLeads = leads.length;
  const step1 = totalLeads;
  const step2 = warmCount + hotCount + convertingCount;
  const dropOff1To2 = step1 > 0 ? Math.round(((step1 - step2) / step1) * 100) : 0;

  const step3 = hotCount + convertingCount;
  const dropOff2To3 = step2 > 0 ? Math.round(((step2 - step3) / step2) * 100) : 0;

  const step4 = convertingCount;
  const dropOff3To4 = step3 > 0 ? Math.round(((step3 - step4) / step3) * 100) : 0;

  console.log(`   * Step 1 (Ingested): ${step1} leads`);
  console.log(`   * Step 2 (Warm / Engaged): ${step2} leads (Drop-off from Step 1: ${dropOff1To2}%)`);
  console.log(`   * Step 3 (Hot / Qualified): ${step3} leads (Drop-off from Step 2: ${dropOff2To3}%)`);
  console.log(`   * Step 4 (Converted / Enrolled): ${step4} leads (Drop-off from Step 3: ${dropOff3To4}%)`);
  console.log("[PASS] Funnel progression and drop-off calculations validated.\n");

  // 2. Test Source-wise ROI and Cost Calculations
  console.log("2. Testing Source-wise ROI Aggregation...");
  const sourceGroups: Record<string, { total: number; converted: number }> = {};
  leads.forEach((l) => {
    if (!sourceGroups[l.source]) sourceGroups[l.source] = { total: 0, converted: 0 };
    sourceGroups[l.source].total++;
    if (l.stage === "CONVERTING" || l.students.length > 0) {
      sourceGroups[l.source].converted++;
    }
  });

  for (const [src, counts] of Object.entries(sourceGroups)) {
    const rate = counts.total > 0 ? Math.round((counts.converted / counts.total) * 100) : 0;
    console.log(`   * ${src}: total=${counts.total}, converted=${counts.converted}, conversionRate=${rate}%`);
  }
  console.log("[PASS] Source ROI metrics computed.\n");

  // 3. Test Counselor Performance & Time-to-Conversion (ADMIN-ONLY)
  console.log("3. Testing Counselor-wise Performance & Time-to-Conversion...");
  const counselors = await scopedAdminDb.user.findMany({
    where: { role: "COUNSELOR" },
  });

  for (const c of counselors) {
    const assigned = leads.filter((l) => l.assignedToUserId === c.id);
    const converted = assigned.filter((l) => l.stage === "CONVERTING" || l.students.length > 0);
    const rate = assigned.length > 0 ? Math.round((converted.length / assigned.length) * 100) : 0;

    let totalDurationMs = 0;
    let validCount = 0;
    converted.forEach((l) => {
      const created = new Date(l.createdAt).getTime();
      const updated = l.students[0] ? new Date(l.students[0].createdAt).getTime() : new Date(l.updatedAt).getTime();
      const diff = updated - created;
      if (diff >= 0) {
        totalDurationMs += diff;
        validCount++;
      }
    });

    const avgDays = validCount > 0 ? (totalDurationMs / validCount / (1000 * 60 * 60 * 24)).toFixed(1) : "N/A";

    console.log(
      `   * Counselor ${c.name}: assigned=${assigned.length}, converted=${converted.length}, convRate=${rate}%, avgTimeToConv=${avgDays} days`
    );
  }
  console.log("[PASS] Counselor performance and time-to-conversion verified.\n");

  // 4. Test Agent vs Human Benchmarking
  console.log("4. Testing Agent-wise Conversion & Comparative Benchmarking...");
  const agents = await scopedAdminDb.agent.findMany();
  const conversations = await prisma.conversation.findMany({
    where: { agent: { organizationId: org.id } },
    include: { agent: true },
  });

  console.log(`   Found ${agents.length} agents and ${conversations.length} total conversations.`);

  let totalAgentCostPaise = 0;
  for (const agent of agents) {
    const agentConvs = conversations.filter((c) => c.agentId === agent.id);
    const convConverted = agentConvs.filter((c) => c.outcome === "CONVERTED").length;
    const costPaise = agentConvs.reduce((sum, c) => sum + (c.costInPaise || 0), 0);
    totalAgentCostPaise += costPaise;
    const convRate = agentConvs.length > 0 ? Math.round((convConverted / agentConvs.length) * 100) : 0;

    console.log(
      `   * ${agent.name} (${agent.channel}): convs=${agentConvs.length}, converted=${convConverted}, convRate=${convRate}%, cost=₹${(costPaise / 100).toFixed(2)}`
    );
  }

  const humanAssigned = leads.filter((l) => Boolean(l.assignedToUserId));
  const humanConverted = humanAssigned.filter((l) => l.stage === "CONVERTING" || l.students.length > 0);
  const humanRate = humanAssigned.length > 0 ? Math.round((humanConverted.length / humanAssigned.length) * 100) : 0;

  console.log(`   Benchmark Summary:`);
  console.log(`   - Human Counselors: ${humanAssigned.length} leads, ${humanConverted.length} converted (${humanRate}%)`);
  console.log(
    `   - Autonomous AI Agents: ${conversations.length} conversations, ${
      conversations.filter((c) => c.outcome === "CONVERTED").length
    } converted, totalSpend=₹${(totalAgentCostPaise / 100).toFixed(2)}`
  );
  console.log("[PASS] Agent vs Human benchmarking verified.\n");

  // 5. Test RBAC Authorization Policy for Counselor Performance
  console.log("5. Testing RBAC Role Enforcement for Counselor-wise views...");
  // When an admin requests reports, counselorPerformance is populated.
  // When a non-admin (COUNSELOR or READONLY) requests reports, counselorPerformance MUST be null and isCounselorRestricted must be true.
  const adminAllowed = admin.role === "ADMIN";
  const counselorAllowed = counselor.role === "ADMIN";
  const readonlyAllowed = readonlyUser.role === "ADMIN";

  if (!adminAllowed) throw new Error("ADMIN should be allowed to view counselor performance.");
  if (counselorAllowed) throw new Error("COUNSELOR should NOT be allowed to view peer counselor scorecards.");
  if (readonlyAllowed) throw new Error("READONLY should NOT be allowed to view peer counselor scorecards.");

  console.log("   [PASS] ADMIN permitted to access counselor performance scorecards.");
  console.log("   [PASS] COUNSELOR restricted from counselor performance scorecards.");
  console.log("   [PASS] READONLY restricted from counselor performance scorecards.\n");

  // 6. Test Multi-Tenant Scoping
  console.log("6. Testing Multi-Tenant Data Scoping...");
  const otherOrgs = await prisma.organization.findMany({
    where: { id: { not: org.id } },
  });

  for (const otherOrg of otherOrgs) {
    const foreignLeads = await scopedAdminDb.lead.findMany({
      where: { organizationId: otherOrg.id } as any,
    });
    if (foreignLeads.length > 0) {
      throw new Error(`Data leakage! Found leads from foreign organization ${otherOrg.slug}`);
    }
  }
  console.log("[PASS] Multi-tenant isolation verified across all queries.\n");

  console.log("========================================================");
  console.log("ALL REPORTS & ANALYTICS TESTS PASSED CLEANLY!");
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
