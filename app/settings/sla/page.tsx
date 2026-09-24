"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Clock,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldAlert,
  Loader2,
  Target,
  MessageSquare,
  Globe,
  Phone,
  FileSpreadsheet,
  Save,
  Trash2,
} from "lucide-react";
import { SLAPolicy, LeadSource, SLAComplianceSummary } from "@/types";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_MINUTE_CHOICES = [
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hrs", value: 120 },
  { label: "4 hrs", value: 240 },
  { label: "24 hrs", value: 1440 },
];

const SOURCE_CONFIGS = [
  {
    source: null,
    title: "Organization Default SLA",
    subtitle: "Global fallback when no specific source policy is defined",
    icon: Clock,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    defaultMinutes: 120,
  },
  {
    source: LeadSource.WHATSAPP,
    title: "WhatsApp Inbound",
    subtitle: "Mobile messaging inquiries with high real-time intent",
    icon: MessageSquare,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    defaultMinutes: 10,
  },
  {
    source: LeadSource.META_ADS,
    title: "Meta Lead Ads",
    subtitle: "Facebook & Instagram sponsored lead generation forms",
    icon: Target,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    defaultMinutes: 15,
  },
  {
    source: LeadSource.GOOGLE_ADS,
    title: "Google Search Ads",
    subtitle: "High-intent search traffic researching specific courses",
    icon: Globe,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    defaultMinutes: 20,
  },
  {
    source: LeadSource.WEBSITE_FORM,
    title: "Website Inquiries",
    subtitle: "Direct web portal forms & syllabus download requests",
    icon: Globe,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    defaultMinutes: 30,
  },
  {
    source: LeadSource.CALL_TRACKING,
    title: "Voice / Call Tracking",
    subtitle: "Inbound voice screener inquiries and callback requests",
    icon: Phone,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    defaultMinutes: 15,
  },
  {
    source: LeadSource.GOOGLE_SHEETS,
    title: "Google Sheets Sync",
    subtitle: "Partner school fairs and offline admissions event lists",
    icon: FileSpreadsheet,
    color: "text-green-400 bg-green-500/10 border-green-500/20",
    defaultMinutes: 60,
  },
  {
    source: LeadSource.CSV_IMPORT,
    title: "CSV Bulk Imports",
    subtitle: "Bulk batch uploads and historical lists",
    icon: FileSpreadsheet,
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    defaultMinutes: 180,
  },
];

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export default function SLASettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [stats, setStats] = useState<SLAComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // Local editing values map: key (source string or "DEFAULT") -> minutes
  const [draftMinutes, setDraftMinutes] = useState<Record<string, number>>({});

  const fetchSlaData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/settings/sla`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load SLA settings.");
      setPolicies(data.policies || []);
      setStats(data.stats || null);

      // Initialize draft minutes
      const map: Record<string, number> = {};
      SOURCE_CONFIGS.forEach((cfg) => {
        const key = cfg.source || "DEFAULT";
        const found = (data.policies || []).find((p: any) => p.source === cfg.source);
        map[key] = found ? found.respondWithinMinutes : cfg.defaultMinutes;
      });
      setDraftMinutes(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch SLA settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchSlaData();
    }
  }, [session]);

  const handleSavePolicy = async (source: string | null) => {
    const key = source || "DEFAULT";
    const minutes = draftMinutes[key];
    if (!minutes || minutes <= 0) {
      toast.error("Please enter a valid response duration in minutes.");
      return;
    }

    setSavingKey(key);
    try {
      const res = await fetch(`/api/settings/sla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          respondWithinMinutes: minutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save SLA policy.");
      toast.success(
        `SLA policy saved: Respond within ${formatMinutes(minutes)}`
      );
      fetchSlaData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleInstallDefaults = async () => {
    setLoadingPresets(true);
    try {
      const res = await fetch(`/api/settings/sla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loadPresets: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load presets.");
      toast.success("Standard education SLA presets installed.");
      fetchSlaData();
    } catch (err: any) {
      toast.error(err.message || "Failed to load presets.");
    } finally {
      setLoadingPresets(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white font-heading">Admin Access Required</h2>
        <p className="text-xs text-zinc-400">
          Only organization administrators can configure or adjust SLA response policies.
        </p>
        <Link href="/settings" className={buttonVariants({ variant: "outline", className: "mt-4 gap-2" })}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-300 font-medium">SLA Policies</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-emerald-400" />
            <span>Response Speed & SLA Tracking</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Enforce maximum first-response windows per inbound channel so no inquiry goes cold silently.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallDefaults}
          isDisabled={loadingPresets}
          className="text-xs gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{loadingPresets ? "Installing..." : "Load Education Benchmarks"}</span>
        </Button>
      </div>

      {/* Compliance Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>SLA Compliance</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-emerald-400">
              {stats.complianceRate}%
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Avg. First Response</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-white">
              {stats.avgFirstResponseMinutes !== null ? `${stats.avgFirstResponseMinutes}m` : "N/A"}
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Responded On Time</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-white">
              {stats.respondedWithinSlaCount}
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>SLA Breached Leads</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-rose-400">
              {stats.breachedSlaCount}
            </div>
          </Card>
        </div>
      )}

      {/* SLA Policy Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SOURCE_CONFIGS.map((cfg) => {
          const key = cfg.source || "DEFAULT";
          const currentMinutes = draftMinutes[key] ?? cfg.defaultMinutes;
          const isSaving = savingKey === key;
          const IconComp = cfg.icon;

          return (
            <Card key={key} className="bg-[#171717] border-[#262626] overflow-hidden">
              <CardContent className="p-5 space-y-4">
                {/* Title & Icon Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${cfg.color} shrink-0`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white font-heading">
                        {cfg.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                        {cfg.subtitle}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[11px] font-mono shrink-0 bg-[#262626] text-zinc-200 border-[#383838]">
                    {formatMinutes(currentMinutes)}
                  </Badge>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-medium text-zinc-400">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_MINUTE_CHOICES.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          setDraftMinutes((prev) => ({
                            ...prev,
                            [key]: preset.value,
                          }))
                        }
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          currentMinutes === preset.value
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-semibold"
                            : "bg-[#202020] text-zinc-400 border-[#2e2e2e] hover:bg-[#262626] hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Minutes Input & Save Button */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#262626]">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Label htmlFor={`min-${key}`} className="text-xs text-zinc-400 shrink-0">
                      Minutes:
                    </Label>
                    <Input
                      id={`min-${key}`}
                      type="number"
                      min="1"
                      value={currentMinutes}
                      onChange={(e) =>
                        setDraftMinutes((prev) => ({
                          ...prev,
                          [key]: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="font-mono text-xs h-8 bg-[#202020] border-[#2e2e2e]"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSavePolicy(cfg.source)}
                    isDisabled={isSaving}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1 shrink-0"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Policy</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
