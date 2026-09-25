/**
 * Platform/vendor-level admin access — separate from the per-tenant
 * ADMIN/COUNSELOR/READONLY roles, which are always scoped to one
 * organization. Every User row requires an organizationId (by design, for
 * tenant isolation via lib/scoped-prisma.ts), so "the vendor operating this
 * SaaS" isn't naturally a role in that model. Gating by an env-configured
 * email allowlist avoids bolting a cross-tenant concept onto a schema
 * that's deliberately built around single-tenant scoping.
 */
export function isVendorAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.VENDOR_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
