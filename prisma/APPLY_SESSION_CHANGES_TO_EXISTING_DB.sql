-- Run this against your EXISTING production Turso database to pick up every
-- schema change made in this session. It is NOT part of prisma/migrations/
-- (which only has a from-empty baseline for fresh installs) because your
-- production tables already exist — this script is deltas only.
--
-- This was never run against your production database from this session:
-- there are no Turso/production DB credentials available here, and even if
-- there were, applying schema changes to a live customer database isn't
-- something to do unilaterally. Run it yourself, e.g.:
--   turso db shell <your-db-name> < prisma/APPLY_SESSION_CHANGES_TO_EXISTING_DB.sql
-- or via any libsql client pointed at TURSO_DATABASE_URL. Review it first —
-- if any of these columns/tables already exist (e.g. you applied a subset
-- by hand), drop the matching statement before running.

-- 2FA (lib/totp.ts)
ALTER TABLE "users" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "twoFactorBackupCodes" TEXT;

-- Per-user granular module permissions (lib/rbac.ts)
ALTER TABLE "users" ADD COLUMN "moduleAccess" TEXT;

-- Real billing / trial (lib/billing/*)
ALTER TABLE "organizations" ADD COLUMN "trialEndsAt" DATETIME;

-- SAML SSO (lib/sso/saml.ts)
ALTER TABLE "organizations" ADD COLUMN "ssoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "ssoDomain" TEXT;
ALTER TABLE "organizations" ADD COLUMN "ssoEntryPoint" TEXT;
ALTER TABLE "organizations" ADD COLUMN "ssoIssuer" TEXT;
ALTER TABLE "organizations" ADD COLUMN "ssoCert" TEXT;
CREATE UNIQUE INDEX "organizations_ssoDomain_key" ON "organizations"("ssoDomain");

-- Durable job queue (lib/job-queue.ts)
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "jobs_status_nextRunAt_idx" ON "jobs"("status", "nextRunAt");

-- Existing rows: give every already-registered org a real trial state
-- instead of leaving trialEndsAt null (which lib/billing/access.ts treats
-- as "legacy org, don't retroactively lock out" — i.e. unblocked either
-- way, so this UPDATE is optional/cosmetic, not required for correctness).
-- UPDATE "organizations" SET "subscriptionStatus" = 'ACTIVE' WHERE "subscriptionStatus" = 'ACTIVE';
