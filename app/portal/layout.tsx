import { redirect } from "next/navigation";
import { getGuardianFromRequest } from "@/lib/guardian-auth";
import { PortalTopBar } from "@/components/portal/portal-top-bar";

/**
 * Standalone layout for the parent/guardian portal. Deliberately does NOT
 * import components/dashboard-shell.tsx or components/sidebar.tsx (the
 * staff app chrome) — this portal is a fully separate surface, both
 * visually and in its auth mechanism (see lib/guardian-auth.ts).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // /portal/login renders its own standalone page (no top bar, no auth
  // requirement), so this layout wraps every OTHER /portal/* route.
  const guardian = await getGuardianFromRequest();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {guardian && <PortalTopBar guardianName={guardian.name} />}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
