"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Shield, Users, Database, AlertCircle } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function AccessBanner() {
  const searchParams = useSearchParams();
  const accessDenied = searchParams.get("access_denied");

  if (accessDenied !== "admin_required") {
    return null;
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-300">
      <AlertCircle className="text-amber-400" />
      <AlertTitle className="text-amber-200">Access Restricted</AlertTitle>
      <AlertDescription className="text-amber-300">
        Organization settings and user management require an{" "}
        <span className="font-semibold text-amber-200">ADMIN</span> role. Counselor
        and Read-Only roles are restricted from accessing settings.
      </AlertDescription>
    </Alert>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Access Denied Warning if redirected from settings */}
      <Suspense fallback={null}>
        <AccessBanner />
      </Suspense>

      {/* Welcome header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          CRM Workspace Overview
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Next.js 14 App Router scaffold with multi-tenant database isolation.
        </p>
      </div>

      {/* First-Run Onboarding Checklist */}
      <OnboardingChecklist />

      {/* System Status / Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tenant Model</p>
              <p className="text-sm font-semibold text-foreground">
                Organization-scoped
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">RBAC Roles</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                <Badge variant="outline">ADMIN</Badge>
                <Badge variant="outline">COUNSELOR</Badge>
                <Badge variant="outline">READONLY</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Database</p>
              <p className="text-sm font-semibold text-foreground">
                PostgreSQL + Prisma
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Scoped Client</p>
              <p className="text-sm font-semibold text-foreground">
                getScopedPrismaClient()
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Architecture Notice */}
      <Card>
        <CardContent>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Multi-Tenant Isolation Notice
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every entity in this database is designed to enforce{" "}
            <code className="bg-muted border border-border px-1.5 py-0.5 rounded text-foreground text-xs font-mono">organizationId</code>{" "}
            scoping. All database queries through{" "}
            <code className="bg-muted border border-border px-1.5 py-0.5 rounded text-foreground text-xs font-mono">getScopedPrismaClient(session)</code>{" "}
            automatically inject the tenant identifier at the query level.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
