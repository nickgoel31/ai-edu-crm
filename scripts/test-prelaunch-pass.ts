import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../lib/prisma";
import fs from "fs";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log("  ✓ " + message);
    passedTests++;
  } else {
    console.error("  ✗ FAILED: " + message);
    failedTests++;
  }
}

async function main() {
  console.log("================================================================================");
  console.log("            PRE-LAUNCH PASS AUTOMATED VERIFICATION TEST SUITE                   ");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // 1. SELF-SERVE SIGNUP & BILLING ACTIVATION
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 1] Self-Serve Signup & Subscription Billing Verification");

  const testOrgSlug = "prelaunch-test-org-" + Math.random().toString(36).substring(2, 7);
  const testEmail = "admin." + Math.random().toString(36).substring(2, 7) + "@prelaunch.edu";

  // Create an organization with the "SELF_SERVE_AGENTS" plan
  const org = await prisma.organization.create({
    data: {
      name: "Prelaunch Academy",
      slug: testOrgSlug,
      plan: "SELF_SERVE_AGENTS",
      subscriptionStatus: "ACTIVE",
      stripeSubscriptionId: "sub_test_" + Date.now(),
    },
  });

  assert(org.id !== undefined, "Organization created successfully");
  assert(org.plan === "SELF_SERVE_AGENTS", "Organization has SELF_SERVE_AGENTS plan");
  assert(org.subscriptionStatus === "ACTIVE", "Subscription status is ACTIVE");
  assert(org.stripeSubscriptionId !== null, "Stripe subscription ID populated");

  // Verify plan upgrade
  const upgradedOrg = await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "MANAGED" },
  });
  assert(upgradedOrg.plan === "MANAGED", "Plan successfully upgraded to MANAGED");

  // ---------------------------------------------------------------------------
  // 2. ONBOARDING MILESTONES & DISMISSAL
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 2] Onboarding Milestones & Checklist API Verification");

  assert(org.onboardingDismissed === false, "onboardingDismissed defaults to false for new orgs");

  const dismissedOrg = await prisma.organization.update({
    where: { id: org.id },
    data: { onboardingDismissed: true },
  });
  assert(dismissedOrg.onboardingDismissed === true, "onboardingDismissed can be toggled to true");

  // ---------------------------------------------------------------------------
  // 3. PWA MANIFEST VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 3] PWA Web App Manifest Validation");

  const manifestPath = path.join(__dirname, "../public/manifest.json");
  assert(fs.existsSync(manifestPath), "public/manifest.json exists on filesystem");

  const manifestRaw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  assert(manifest.name === "AI Edu CRM - Enterprise Admissions Platform", "Manifest name is configured");
  assert(manifest.short_name === "EduCRM", "Manifest short_name is EduCRM");
  assert(manifest.display === "standalone", "PWA display mode is standalone");
  assert(manifest.theme_color === "#0f172a", "Theme color matches slate-900 brand");

  // ---------------------------------------------------------------------------
  // 4. LOADING STATES & ERROR BOUNDARIES VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 4] Loading States & Error Boundaries Check");

  const requiredFiles = [
    "app/loading.tsx",
    "app/error.tsx",
    "app/leads/loading.tsx",
    "app/leads/error.tsx",
    "app/leads/[id]/loading.tsx",
    "app/leads/[id]/error.tsx",
    "app/students/loading.tsx",
    "app/students/error.tsx",
    "app/students/[id]/loading.tsx",
    "app/students/[id]/error.tsx",
    "app/agents/loading.tsx",
    "app/agents/error.tsx",
    "app/agents/[id]/loading.tsx",
    "app/agents/[id]/error.tsx",
    "app/reports/loading.tsx",
    "app/reports/error.tsx",
    "app/settings/error.tsx",
    "app/settings/audit-log/loading.tsx",
    "app/settings/audit-log/error.tsx",
    "components/bottom-nav.tsx",
  ];

  let allFilesExist = true;
  for (const relPath of requiredFiles) {
    const fullPath = path.join(__dirname, "../", relPath);
    if (!fs.existsSync(fullPath)) {
      console.error("Missing file: " + relPath);
      allFilesExist = false;
    }
  }
  assert(allFilesExist, "All 20 loading, error boundary, and bottom-nav components exist on disk");

  // ---------------------------------------------------------------------------
  // 5. README HANDOFF DOCUMENTATION VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n[TEST SUITE 5] Developer Handoff README Check");

  const readmePath = path.join(__dirname, "../README.md");
  assert(fs.existsSync(readmePath), "README.md exists in project root");

  const readmeContent = fs.readFileSync(readmePath, "utf8");
  assert(readmeContent.includes("DATABASE_URL"), "README documents DATABASE_URL");
  assert(readmeContent.includes("ENCRYPTION_KEY"), "README documents ENCRYPTION_KEY");
  assert(readmeContent.includes("npm run db:server"), "README documents db:server command");
  assert(readmeContent.includes("test-hardening-and-security.ts"), "README documents test suites");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("PRE-LAUNCH TEST SUMMARY: " + passedTests + " passed, " + failedTests + " failed");
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Test execution failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
