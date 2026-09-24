"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Flame,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Loader2,
  Clock,
  MessageSquare,
  Users,
  Target,
  Sliders,
  HelpCircle,
  X,
} from "lucide-react";
import { ScoringRule, ScoringOperator, LeadSource, LeadStage } from "@/types";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AVAILABLE_FIELDS = [
  { value: "source", label: "Lead Source", type: "enum_source", icon: Target },
  { value: "stage", label: "Pipeline Stage", type: "enum_stage", icon: Sliders },
  { value: "daysInCurrentStage", label: "Days in Current Stage", type: "number", icon: Clock },
  { value: "daysSinceLastActivity", label: "Days Since Last Activity", type: "number", icon: Clock },
  { value: "hasReplied", label: "Candidate Has Replied", type: "boolean", icon: MessageSquare },
  { value: "hasConversations", label: "Has Communication History", type: "boolean", icon: MessageSquare },
];

export default function LeadScoringSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [stats, setStats] = useState<{
    totalRules: number;
    enabledRules: number;
    totalLeads: number;
    avgScore: number;
    hotLeadsCount: number;
    coldLeadsCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [formName, setFormName] = useState("");
  const [formField, setFormField] = useState("source");
  const [formOperator, setFormOperator] = useState<ScoringOperator>(ScoringOperator.EQUALS);
  const [formValue, setFormValue] = useState("");
  const [formPoints, setFormPoints] = useState(15);
  const [formEnabled, setFormEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm Modal
  const [deletingRule, setDeletingRule] = useState<ScoringRule | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/settings/scoring-rules`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load scoring rules.");
      setRules(data.rules || []);
      setStats(data.stats || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load scoring rules.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchRules();
    }
  }, [session]);

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormName("");
    setFormField("source");
    setFormOperator(ScoringOperator.EQUALS);
    setFormValue("META_ADS");
    setFormPoints(20);
    setFormEnabled(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: ScoringRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormField(rule.field);
    setFormOperator(rule.operator);
    setFormValue(rule.value || "");
    setFormPoints(rule.points);
    setFormEnabled(rule.enabled);
    setIsModalOpen(true);
  };

  const handleFieldChange = (newField: string) => {
    setFormField(newField);
    const fieldMeta = AVAILABLE_FIELDS.find((f) => f.value === newField);
    if (fieldMeta?.type === "boolean") {
      setFormOperator(ScoringOperator.EQUALS);
      setFormValue("true");
    } else if (fieldMeta?.type === "number") {
      setFormOperator(ScoringOperator.GREATER_THAN);
      setFormValue("7");
    } else if (newField === "source") {
      setFormOperator(ScoringOperator.EQUALS);
      setFormValue("META_ADS");
    } else if (newField === "stage") {
      setFormOperator(ScoringOperator.EQUALS);
      setFormValue("WARM");
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Rule name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRule) {
        // PATCH
        const res = await fetch(`/api/settings/scoring-rules/${editingRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            field: formField,
            operator: formOperator,
            value: formValue,
            points: Number(formPoints),
            enabled: formEnabled,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update rule.");
        toast.success("Scoring rule updated.");
      } else {
        // POST
        const res = await fetch(`/api/settings/scoring-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            field: formField,
            operator: formOperator,
            value: formValue,
            points: Number(formPoints),
            enabled: formEnabled,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create rule.");
        toast.success("Scoring rule created.");
      }
      setIsModalOpen(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: ScoringRule) => {
    try {
      const res = await fetch(`/api/settings/scoring-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");
      toast.success(rule.enabled ? "Rule paused." : "Rule enabled.");
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle rule.");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/settings/scoring-rules/${ruleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete rule.");
      toast.success("Scoring rule deleted.");
      setIsDeleteModalOpen(false);
      setDeletingRule(null);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule.");
    }
  };

  const handleInstallDefaults = async () => {
    setIsLoadingDefaults(true);
    try {
      const res = await fetch(`/api/settings/scoring-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loadDefaults: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load default templates.");
      toast.success(data.message || "Default education scoring rules loaded.");
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to load defaults.");
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch(`/api/settings/scoring-rules/recalculate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recalculation failed.");
      toast.success(data.message || "All lead scores have been recalculated!");
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || "Recalculation failed.");
    } finally {
      setIsRecalculating(false);
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
          Only organization administrators can configure or calibrate lead scoring rules.
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
            <span className="text-xs text-zinc-300 font-medium">Lead Scoring</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading flex items-center gap-2.5">
            <Flame className="w-6 h-6 text-amber-500" />
            <span>Lead Scoring Engine</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Configure weighted rules that automatically score prospects based on engagement, source attribution, and pipeline velocity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateAll}
            isDisabled={isRecalculating}
            className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin text-amber-400" : ""}`} />
            <span>{isRecalculating ? "Recalculating..." : "Recalculate All Leads"}</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Rule</span>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Active Scoring Rules</span>
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-white">
              {stats.enabledRules} <span className="text-xs font-normal text-zinc-500">/ {stats.totalRules}</span>
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Average Lead Score</span>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-white flex items-baseline gap-1">
              <span>{stats.avgScore}</span>
              <span className="text-xs font-normal text-zinc-500">/ 100</span>
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Hot Leads (≥70)</span>
              <Flame className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-emerald-400">
              {stats.hotLeadsCount}
            </div>
          </Card>

          <Card className="bg-[#171717] border-[#262626] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Cold Leads (&lt;40)</span>
              <Clock className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-heading text-zinc-300">
              {stats.coldLeadsCount}
            </div>
          </Card>
        </div>
      )}

      {/* Rules List Container */}
      <Card className="bg-[#171717] border-[#262626] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white font-heading">
              Scoring Rules & Live Impact
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live preview shows how many active leads currently meet each rule condition.
            </p>
          </div>

          {rules.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstallDefaults}
              isDisabled={isLoadingDefaults}
              className="text-xs gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isLoadingDefaults ? "Loading..." : "Load Education Templates"}</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Loading scoring rules...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <Flame className="w-12 h-12 text-amber-500/40 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-white">No Scoring Rules Configured</h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Set up automated points for inbound Meta ads, WhatsApp replies, stage duration, or time-stalled prospects.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleInstallDefaults}
                isDisabled={isLoadingDefaults}
                className="text-xs gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Recommended Edu Rules</span>
              </Button>
              <Button
                size="sm"
                onClick={handleOpenAdd}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Custom Rule
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#262626]">
            {rules.map((rule) => {
              const isPos = rule.points > 0;
              const isZero = rule.points === 0;
              const matchedCount = (rule as any).matchedCount ?? 0;

              return (
                <div
                  key={rule.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors ${
                    !rule.enabled ? "opacity-55 bg-zinc-900/40" : "hover:bg-[#202020]"
                  }`}
                >
                  {/* Left: Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">
                        {rule.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-mono font-semibold ${
                          isPos
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : isZero
                            ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {isPos ? `+${rule.points} pts` : `${rule.points} pts`}
                      </Badge>
                      {!rule.enabled && (
                        <Badge variant="outline" className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700">
                          Paused
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                      <span className="font-mono text-zinc-300 bg-[#262626] px-1.5 py-0.5 rounded border border-[#333]">
                        {rule.field}
                      </span>
                      <span className="text-zinc-500">
                        {rule.operator.toLowerCase().replace("_", " ")}
                      </span>
                      {rule.value && (
                        <span className="font-mono text-zinc-200 bg-[#292929] px-1.5 py-0.5 rounded border border-[#383838]">
                          {rule.value}
                        </span>
                      )}
                      <span>•</span>
                      {/* Live Impact Preview */}
                      <span className="inline-flex items-center gap-1 text-xs text-amber-300/90 font-medium">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>{matchedCount} leads match right now</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleRule(rule)}
                      className={`text-xs border-[#2e2e2e] ${
                        rule.enabled
                          ? "bg-[#202020] hover:bg-zinc-800 text-zinc-300"
                          : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {rule.enabled ? "Pause" : "Enable"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(rule)}
                      className="border-[#2e2e2e] bg-[#202020] hover:bg-[#282828] text-xs gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeletingRule(rule);
                        setIsDeleteModalOpen(true);
                      }}
                      className="border-[#2e2e2e] bg-[#202020] hover:bg-rose-500/10 hover:text-rose-400 text-xs text-zinc-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add / Edit Rule Modal */}
      <Dialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        isDismissable={!isSubmitting}
        className="sm:max-w-[520px]"
      >
        <form onSubmit={handleSaveRule}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-white">
              {editingRule ? `Edit Rule: ${editingRule.name}` : "Create Scoring Rule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Rule Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ruleName" className="text-xs font-medium text-zinc-300">
                Rule Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ruleName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Meta Ads Inbound Attribution, WhatsApp Fast Reply..."
                required
              />
            </div>

            {/* Target Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">
                Target Field / Metric <span className="text-rose-400">*</span>
              </Label>
              <Select
                selectedKey={formField}
                onSelectionChange={(k) => handleFieldChange(String(k))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FIELDS.map((f) => (
                    <SelectItem key={f.value} id={f.value} textValue={f.label}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator and Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-300">
                  Condition / Operator
                </Label>
                <Select
                  selectedKey={formOperator}
                  onSelectionChange={(k) => setFormOperator(k as ScoringOperator)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id={ScoringOperator.EQUALS} textValue="Equals (=)">
                      Equals (=)
                    </SelectItem>
                    <SelectItem id={ScoringOperator.NOT_EQUALS} textValue="Does Not Equal (!=)">
                      Does Not Equal (!=)
                    </SelectItem>
                    <SelectItem id={ScoringOperator.GREATER_THAN} textValue="Greater Than (&gt;)">
                      Greater Than (&gt;)
                    </SelectItem>
                    <SelectItem id={ScoringOperator.LESS_THAN} textValue="Less Than (&lt;)">
                      Less Than (&lt;)
                    </SelectItem>
                    <SelectItem id={ScoringOperator.CONTAINS} textValue="Contains">
                      Contains
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Value Input depending on field */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-300">
                  Target Value
                </Label>
                {formField === "source" ? (
                  <Select
                    selectedKey={formValue}
                    onSelectionChange={(k) => setFormValue(String(k))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(LeadSource).map((src) => (
                        <SelectItem key={src} id={src} textValue={src}>
                          {src}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : formField === "stage" ? (
                  <Select
                    selectedKey={formValue}
                    onSelectionChange={(k) => setFormValue(String(k))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(LeadStage).map((stg) => (
                        <SelectItem key={stg} id={stg} textValue={stg}>
                          {stg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : formField === "daysInCurrentStage" || formField === "daysSinceLastActivity" ? (
                  <Input
                    type="number"
                    min="0"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="e.g. 7"
                  />
                ) : formField === "hasReplied" || formField === "hasConversations" ? (
                  <Select
                    selectedKey={formValue}
                    onSelectionChange={(k) => setFormValue(String(k))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="true" textValue="Yes (True)">
                        Yes (True)
                      </SelectItem>
                      <SelectItem id="false" textValue="No (False)">
                        No (False)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="e.g. value"
                  />
                )}
              </div>
            </div>

            {/* Points Impact */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="points" className="text-xs font-medium text-zinc-300">
                  Points Delta (Can be positive or negative) <span className="text-rose-400">*</span>
                </Label>
                <span className="text-[11px] font-mono text-zinc-400">
                  Clamped total: 0 to 100
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="points"
                  type="number"
                  value={formPoints}
                  onChange={(e) => setFormPoints(Number(e.target.value))}
                  placeholder="e.g. 20 or -15"
                  className="font-mono"
                  required
                />
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormPoints(25)}
                    className="text-xs text-emerald-400 border-emerald-500/30"
                  >
                    +25
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormPoints(-15)}
                    className="text-xs text-rose-400 border-rose-500/30"
                  >
                    -15
                  </Button>
                </div>
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-2.5 pt-1">
              <Checkbox
                id="formEnabled"
                isSelected={formEnabled}
                onChange={setFormEnabled}
              />
              <Label htmlFor="formEnabled" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Rule is active and evaluates leads automatically
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingRule ? (
                "Update Rule"
              ) : (
                "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Delete Rule Modal */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <Trash2 className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Delete Scoring Rule?
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-zinc-300 py-2">
          Are you sure you want to delete <strong className="text-white">{deletingRule?.name}</strong>?
          This rule will no longer contribute to future lead score calculations.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => deletingRule && handleDeleteRule(deletingRule.id)}
          >
            Delete Rule
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
