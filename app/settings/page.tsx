import Link from "next/link";
import { Users, Webhook, ShieldCheck, ArrowRight, Bell, Shield, Zap, Sliders, Tag, Flame, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Organization Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your organization settings, team members, integrations, and access policies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/settings/users" className="group block">
          <Card className="hover:ring-indigo-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    User Management
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Invite team members and assign ADMIN, COUNSELOR, or READONLY roles
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/integrations" className="group block">
          <Card className="hover:ring-purple-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Lead Ingestion & Webhooks
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure Meta Lead Ads, WhatsApp Business, and Google Sheets sync
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/notifications" className="group block">
          <Card className="hover:ring-amber-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure daily digests (Email/WhatsApp), stalled leads, and escalation alerts
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/agent-triggers" className="group block">
          <Card className="hover:ring-emerald-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Agent Triggers
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure CRM events (overdue payments, stale leads) that proactively fire AI agents
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/custom-fields" className="group block">
          <Card className="hover:ring-blue-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Custom Fields
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define custom Lead & Student fields, validation rules, choices, and display orders
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/lead-scoring" className="group block">
          <Card className="hover:ring-amber-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Lead Scoring Rules
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure weighted scoring rules, engagement points, and nightly sweep triggers (ADMIN-only)
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/sla" className="group block">
          <Card className="hover:ring-emerald-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    SLA & Response Speed
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure "respond within X hours" SLA tracking per source, countdown alerts, and breach escalation
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/tags" className="group block">
          <Card className="hover:ring-pink-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/25 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Tags & Segmentation
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage tags, colors, rename, delete, and merge duplicate tags (ADMIN-only)
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/templates" className="group block">
          <Card className="hover:ring-violet-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Message Templates
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create reusable Email, SMS, and WhatsApp templates with dynamic merge fields (ADMIN-only)
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/pipelines" className="group block">
          <Card className="hover:ring-indigo-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Pipelines & Stages
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure custom per-program pipelines, dynamic stages, exit requirements, and analytics bucket mappings (ADMIN-only)
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/audit-log" className="group block">
          <Card className="hover:ring-indigo-500/50 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Audit Log & Compliance
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Search and inspect administrative actions, stage updates, and compliance events (ADMIN-only)
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Multi-Tenant Architecture Policy
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every webhook, database record, and sync job is strictly isolated by organizationId.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
