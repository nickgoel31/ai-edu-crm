"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Bot,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Play,
  Pause,
  Clock,
  TrendingUp,
  Coins,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Calendar,
  Languages,
  FileCode2,
  RefreshCw,
  Download,
  Zap,
  History,
} from "lucide-react";
import {
  AgentStatus,
  AgentChannel,
  AgentRole,
  AgentCategory,
  AGENT_ROLE_META,
  AGENT_CATEGORY_LABELS,
  AGENT_TRIGGER_EVENT_META,
  AgentTriggerEvent,
  ConversationOutcome,
} from "@/types";
import { TranscriptDialog } from "@/components/agents/transcript-dialog";
import { AgentSetupForm } from "@/components/agents/agent-setup-form";
import { getCatalogEntry, isValidAgentRole } from "@/lib/agent-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface ConversationItem {
  id: string;
  channel: string;
  transcript: string;
  outcome: ConversationOutcome;
  costInPaise: number | null;
  createdAt: string;
  claimedByUserId?: string | null;
  claimedAt?: string | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    stage?: string | null;
    score?: number | null;
  } | null;
  student?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    stage?: string | null;
    program?: string | null;
    cohort?: string | null;
  } | null;
  claimedBy?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

interface AgentDetail {
  id: string;
  name: string;
  channel: AgentChannel;
  role: AgentRole;
  category: AgentCategory;
  status: AgentStatus;
  config: {
    workingHours: string;
    language: string;
    scriptPromptVersion: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  ALL: { label: "All Logs", color: "text-slate-600" },
  CONVERTED: { label: "Converted", color: "text-emerald-600" },
  ESCALATED: { label: "Escalated", color: "text-rose-600" },
  CONTINUED: { label: "Continued", color: "text-blue-600" },
  NO_RESPONSE: { label: "No Response", color: "text-slate-500" },
};

export default function AgentDetailPage() {
  const params = useParams();
  const idOrRole = params.idOrRole as string;
  const agentId = idOrRole;
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canMutate = userRole === "ADMIN" || userRole === "COUNSELOR";

  // "loading" until we know whether idOrRole is a deployed Agent id, an
  // undeployed catalog role, or neither.
  const [mode, setMode] = useState<"loading" | "deployed" | "setup" | "notfound">("loading");

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [outcomeCounts, setOutcomeCounts] = useState<Record<string, number>>({
    ALL: 0,
    CONVERTED: 0,
    ESCALATED: 0,
    CONTINUED: 0,
    NO_RESPONSE: 0,
  });
  const [metrics, setMetrics] = useState<any>(null);

  const [selectedOutcome, setSelectedOutcome] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config Form State
  const [workingHours, setWorkingHours] = useState("");
  const [language, setLanguage] = useState("en-IN");
  const [scriptPromptVersion, setScriptPromptVersion] = useState("");
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [embedSnippet, setEmbedSnippet] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Transcript Dialog
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  // Automation tab (CRM-event triggers configured for this agent)
  const [detailTab, setDetailTab] = useState<"conversations" | "automation">("conversations");
  const [automationTriggers, setAutomationTriggers] = useState<any[] | null>(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);

  const fetchAutomation = async () => {
    setAutomationLoading(true);
    setAutomationError(null);
    try {
      const res = await fetch(`/api/agent-triggers?agentId=${agentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load automation triggers.");
      setAutomationTriggers(data.triggers || []);
    } catch (err: any) {
      setAutomationError(err?.message || "Failed to load automation triggers.");
    } finally {
      setAutomationLoading(false);
    }
  };

  useEffect(() => {
    if (detailTab === "automation" && automationTriggers === null && agentId) {
      fetchAutomation();
    }
  }, [detailTab, agentId]);

  const fetchAgentData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const outcomeParam = selectedOutcome !== "ALL" ? `?outcome=${selectedOutcome}` : "";
      const res = await fetch(`/api/agents/${agentId}${outcomeParam}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          // Not a deployed Agent id — try it as a not-yet-deployed catalog role.
          if (isValidAgentRole(idOrRole) && getCatalogEntry(idOrRole)) {
            setMode("setup");
          } else {
            setMode("notfound");
          }
          return;
        }
        throw new Error(data?.error || "Failed to load agent.");
      }

      setAgent(data.agent);
      setConversations(data.conversations || []);
      if (data.outcomeCounts) setOutcomeCounts(data.outcomeCounts);
      if (data.metrics) setMetrics(data.metrics);

      // Populate config state
      if (data.agent?.config) {
        setWorkingHours(data.agent.config.workingHours || "09:00 - 20:00 IST");
        setLanguage(data.agent.config.language || "en-IN");
        setScriptPromptVersion(data.agent.config.scriptPromptVersion || "v1.0");
        setOutboundWebhookUrl(data.agent.outboundWebhookUrl || "");
        setApiKey(data.agent.config.apiKey || "");
        setEmbedSnippet(data.agent.config.embedSnippet || "");
      }
      setMode("deployed");
    } catch (err: any) {
      setError(err?.message || "Failed to load agent profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      fetchAgentData();
    }
  }, [agentId, selectedOutcome]);

  // Toggle Live/Paused
  const handleToggleStatus = async () => {
    if (!canMutate || !agent) return;

    const nextStatus: AgentStatus =
      agent.status === AgentStatus.LIVE ? AgentStatus.PAUSED : AgentStatus.LIVE;

    setIsTogglingStatus(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to toggle status.");

      setAgent((prev) => (prev ? { ...prev, status: nextStatus } : null));
      setSuccess(`Agent is now ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchAgentData();
    } catch (err: any) {
      setError(err?.message || "Failed to toggle agent status.");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Save Config Panel
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;

    setIsSavingConfig(true);
    setError(null);
    try {
      const isChatChannel = agent?.channel === AgentChannel.WEBSITE_CHAT;

      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingHours: workingHours.trim(),
          language,
          scriptPromptVersion: scriptPromptVersion.trim(),
          outboundWebhookUrl: isChatChannel ? undefined : outboundWebhookUrl.trim(),
          extraConfig: isChatChannel
            ? { embedSnippet: embedSnippet.trim() }
            : { apiKey: apiKey.trim() },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save configuration.");

      setSuccess("Agent configuration saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
      fetchAgentData();
    } catch (err: any) {
      setError(err?.message || "Failed to save configuration.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const getAgentIcon = (channel?: AgentChannel) => {
    switch (channel) {
      case AgentChannel.VOICE:
        return Phone;
      case AgentChannel.WHATSAPP:
        return MessageSquare;
      case AgentChannel.EMAIL:
        return Mail;
      case AgentChannel.WEBSITE_CHAT:
        return Globe;
      default:
        return Bot;
    }
  };

  if (mode === "loading") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p className="text-sm font-medium">Loading AI agent profile...</p>
      </div>
    );
  }

  if (mode === "setup") {
    const catalogEntry = getCatalogEntry(idOrRole)!;
    if (!canMutate) {
      return (
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-zinc-100">Admin or Counselor Access Required</h2>
          <p className="text-sm text-zinc-400">
            {catalogEntry.name} is not deployed yet. Ask an admin or counselor to deploy it.
          </p>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Agents Fleet</span>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Agents Dashboard</span>
        </Link>
        <AgentSetupForm entry={catalogEntry} orgSlug={session?.user?.organizationName} />
      </div>
    );
  }

  if (mode === "notfound" || !agent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-100">Agent Not Found</h2>
        <p className="text-sm text-zinc-400">
          This AI agent could not be found or belongs to another organization.
        </p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Agents Fleet</span>
        </Link>
      </div>
    );
  }

  const Icon = getAgentIcon(agent.channel);
  const roleLabel = AGENT_ROLE_META[agent.role]?.label || agent.role.replace(/_/g, " ");
  const categoryLabel = AGENT_CATEGORY_LABELS[agent.category] || agent.category.replace(/_/g, " ");
  const isLive = agent.status === AgentStatus.LIVE;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Agents Dashboard</span>
        </Link>

        {!canMutate && (
          <Badge variant="outline" className="text-muted-foreground">
            Read-Only Mode
          </Badge>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      {/* Agent Header Card */}
      <Card className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
              <Badge variant="outline" className="uppercase">
                {roleLabel}
              </Badge>
              <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
                {categoryLabel}
              </Badge>
              <Badge variant="outline" className="uppercase text-zinc-500">
                {agent.channel.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 font-mono">
              Agent ID: {agent.id}
            </p>
          </div>
        </div>

        {/* Live/Paused Toggle */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              isLive
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase h-auto px-3 py-1.5"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 uppercase h-auto px-3 py-1.5"
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? "bg-emerald-400 animate-ping" : "bg-zinc-500"
              }`}
            />
            <span>{agent.status}</span>
          </Badge>

          {canMutate && (
            <Button
              variant={isLive ? "outline" : "default"}
              onClick={handleToggleStatus}
              isDisabled={isTogglingStatus}
              className={isLive ? "" : "bg-emerald-600 text-white hover:bg-emerald-500"}
            >
              {isTogglingStatus ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isLive ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Agent</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Live</span>
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-xs">
          <span className="text-muted-foreground block font-medium">Conversations (Today)</span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {metrics?.conversationsToday ?? 0}
          </span>
          <span className="text-zinc-500 text-[11px]">
            {metrics?.conversationsThisWeek ?? 0} this week
          </span>
        </Card>

        <Card className="p-4 text-xs">
          <span className="text-muted-foreground block font-medium">Conversion Rate</span>
          <span className="text-2xl font-bold text-purple-400 mt-1 block">
            {metrics?.conversionRate ?? 0}%
          </span>
          <span className="text-zinc-500 text-[11px]">
            {metrics?.convertedCount ?? 0} converted
          </span>
        </Card>

        <Card className="p-4 text-xs">
          <span className="text-muted-foreground block font-medium">Escalated</span>
          <span className="text-2xl font-bold text-rose-400 mt-1 block">
            {metrics?.escalatedCount ?? 0}
          </span>
          <span className="text-zinc-500 text-[11px]">transferred to counselors</span>
        </Card>

        <Card className="p-4 text-xs">
          <span className="text-muted-foreground block font-medium">Cost This Month</span>
          <span className="text-xl font-bold text-foreground mt-1 block">
            ₹{metrics?.costThisMonthRupees ?? "0.00"}
          </span>
          <span className="text-zinc-500 text-[11px]">
            ₹{metrics?.totalCostRupees ?? "0.00"} all-time
          </span>
        </Card>
      </div>

      {/* Main Grid: Config Panel on Left/Top vs Conversation Logs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config Panel */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <div className="border-b border-border/60 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-blue-400" />
                <span>Agent Configuration</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Runtime metadata stored for Retell / Dograh orchestration.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              {/* Channel-specific config */}
              {agent.channel === AgentChannel.WEBSITE_CHAT ? (
                <div className="space-y-1.5">
                  <Label className="font-semibold text-zinc-300">
                    <span>Website Embed Snippet</span>
                  </Label>
                  <textarea
                    value={embedSnippet}
                    onChange={(e) => setEmbedSnippet(e.target.value)}
                    disabled={!canMutate}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-[11px] font-mono text-foreground disabled:opacity-60"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-zinc-300">
                      <span>Outbound Webhook URL</span>
                    </Label>
                    <Input
                      type="url"
                      value={outboundWebhookUrl}
                      onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                      placeholder="https://api.retellai.com/... or https://your-dograh-instance/webhook"
                      disabled={!canMutate}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-zinc-300">
                      <span>API Key</span>
                    </Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-••••••••••••••••"
                      disabled={!canMutate}
                      autoComplete="off"
                    />
                  </div>
                </>
              )}

              {/* Working Hours */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Working Hours</span>
                </Label>
                <Input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="e.g. 09:00 - 20:00 IST"
                  disabled={!canMutate}
                />
                <div className="flex gap-1 pt-1">
                  {["09:00 - 20:00 IST", "24/7 Active", "10:00 - 18:00 IST"].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setWorkingHours(preset)}
                      isDisabled={!canMutate}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-zinc-300">
                  <Languages className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Primary Language</span>
                </Label>
                <Select
                  selectedKey={language}
                  onSelectionChange={(key) => setLanguage(String(key))}
                  isDisabled={!canMutate}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="en-IN">English (India - en-IN)</SelectItem>
                    <SelectItem id="hi-IN">Hindi (hi-IN)</SelectItem>
                    <SelectItem id="hi-Latn">Hinglish (Colloquial - hi-Latn)</SelectItem>
                    <SelectItem id="mr-IN">Marathi (mr-IN)</SelectItem>
                    <SelectItem id="ta-IN">Tamil (ta-IN)</SelectItem>
                    <SelectItem id="te-IN">Telugu (te-IN)</SelectItem>
                    <SelectItem id="kn-IN">Kannada (kn-IN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Script / Prompt Version Label */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-zinc-300">
                  <Bot className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Script / Prompt Version</span>
                </Label>
                <Input
                  type="text"
                  value={scriptPromptVersion}
                  onChange={(e) => setScriptPromptVersion(e.target.value)}
                  placeholder="e.g. v2.4-vocational-closer"
                  disabled={!canMutate}
                  className="font-mono"
                />
                <p className="text-[10px] text-zinc-500">
                  Labels version deployed on Retell / Dograh without altering core agent logic.
                </p>
              </div>

              {/* Save Button */}
              {canMutate && (
                <Button type="submit" isDisabled={isSavingConfig} className="w-full">
                  {isSavingConfig ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Config</span>
                    </>
                  )}
                </Button>
              )}
            </form>
          </Card>
        </div>

        {/* Right Column: Conversation Logs / Automation */}
        <div className="space-y-4 lg:col-span-2">
          {/* Plain button-toggle tabs (kept independent of react-aria Tabs/Table collections) */}
          <div className="flex items-center gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => setDetailTab("conversations")}
              className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                detailTab === "conversations"
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conversation Log</span>
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("automation")}
              className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                detailTab === "automation"
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Automation</span>
            </button>
          </div>

          {detailTab === "automation" ? (
            <div className="space-y-4">
              {automationLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
                  <p className="text-xs">Loading automation config...</p>
                </div>
              ) : automationError ? (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{automationError}</AlertDescription>
                </Alert>
              ) : !automationTriggers || automationTriggers.length === 0 ? (
                <Card className="py-12 text-center space-y-2">
                  <Zap className="w-7 h-7 text-zinc-600 mx-auto" />
                  <h4 className="text-xs font-bold text-zinc-200">No triggers configured for this agent</h4>
                  <p className="text-[11px] text-zinc-500">
                    Configure a CRM-event trigger in{" "}
                    <Link href="/settings/agent-triggers" className="text-blue-400 hover:underline">
                      Settings → Agent Triggers
                    </Link>{" "}
                    so this agent can fire proactively.
                  </p>
                </Card>
              ) : (
                automationTriggers.map((trigger: any) => {
                  const meta = AGENT_TRIGGER_EVENT_META[trigger.triggerEvent as AgentTriggerEvent];
                  return (
                    <Card key={trigger.id} className="p-0 overflow-hidden">
                      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{meta?.label || trigger.triggerEvent}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{meta?.description}</p>
                          {trigger.conditions && Object.keys(trigger.conditions).length > 0 && (
                            <p className="text-[11px] text-zinc-500 mt-1">
                              Conditions:{" "}
                              {Object.entries(trigger.conditions)
                                .map(([k, v]) => `${k.replace("Threshold", "")}: ${v}`)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            trigger.enabled
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700 uppercase"
                          }
                        >
                          {trigger.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>

                      <div className="p-4">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                          <History className="w-3.5 h-3.5" />
                          <span>Recent Fire History</span>
                        </h5>
                        {!trigger.fires || trigger.fires.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">Not fired yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {trigger.fires.map((fire: any) => (
                              <div
                                key={fire.id}
                                className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/50 last:border-0"
                              >
                                <span className="text-zinc-300">
                                  {fire.entityType} · {fire.entityId.slice(0, 10)}…
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      fire.status === "SUCCESS"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : fire.status === "FAILED"
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                    }
                                  >
                                    {fire.status}
                                  </Badge>
                                  <span className="text-zinc-500 font-mono">
                                    {new Date(fire.lastTriggeredAt).toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <>
          {/* Outcome Filter Tabs & CSV Export */}
          <Card className="p-3.5 flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {["ALL", "CONVERTED", "ESCALATED", "CONTINUED", "NO_RESPONSE"].map((key) => {
                const count = outcomeCounts[key] || 0;
                const isSelected = selectedOutcome === key;
                const cfg = OUTCOME_LABELS[key];

                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setSelectedOutcome(key)}
                  >
                    <span>{cfg.label}</span>
                    <Badge
                      className={isSelected ? "bg-blue-500 text-white" : "bg-[#27272a] text-zinc-300"}
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {/* CSV Export Button */}
            <Button
              variant="outline"
              onClick={() => {
                if (!conversations || conversations.length === 0) return;

                const headers = [
                  "Conversation ID",
                  "Contact Name",
                  "Phone",
                  "Type",
                  "Channel",
                  "Outcome",
                  "Cost (Paise)",
                  "Claimed By",
                  "Timestamp",
                  "Transcript Preview",
                ];

                const rows = conversations.map((conv) => {
                  const contactName = conv.student?.name || conv.lead?.name || "Anonymous";
                  const phone = conv.student?.phone || conv.lead?.phone || "N/A";
                  const contactType = conv.student ? "Student" : conv.lead ? "Lead" : "Direct";
                  const claimed = conv.claimedBy?.name || "Unclaimed";
                  const cleanTranscript = (conv.transcript || "")
                    .replace(/\r?\n/g, " ")
                    .replace(/"/g, '""')
                    .slice(0, 150);

                  return [
                    conv.id,
                    `"${contactName.replace(/"/g, '""')}"`,
                    `"${phone}"`,
                    contactType,
                    conv.channel,
                    conv.outcome,
                    conv.costInPaise ?? 0,
                    `"${claimed.replace(/"/g, '""')}"`,
                    new Date(conv.createdAt).toISOString(),
                    `"${cleanTranscript}"`,
                  ];
                });

                const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute(
                  "download",
                  `agent-${agent?.name?.toLowerCase().replace(/\s+/g, "-")}-conversations-${selectedOutcome.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
                );
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              isDisabled={conversations.length === 0}
              aria-label="Export filtered conversation logs to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </Card>

          {/* Conversation Table */}
          <Card className="p-0 overflow-hidden">
            {conversations.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
                <h4 className="text-xs font-bold text-zinc-200">No conversations found</h4>
                <p className="text-[11px] text-zinc-500">
                  No interactions recorded matching this outcome filter.
                </p>
              </div>
            ) : (
              <Table aria-label="Conversations">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                    <TableHead>Contact</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {conversations.map((conv) => {
                    return (
                      <TableRow key={conv.id} className="border-border/60 hover:bg-muted/40/50 transition-colors">
                        {/* Contact Info */}
                        <TableCell>
                          <div>
                            {conv.student ? (
                              <Link
                                href={`/students/${conv.student.id}`}
                                className="font-semibold text-zinc-100 hover:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span>{conv.student.name}</span>
                                <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                  Student
                                </Badge>
                              </Link>
                            ) : conv.lead ? (
                              <Link
                                href={`/leads/${conv.lead.id}`}
                                className="font-semibold text-zinc-100 hover:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span>{conv.lead.name}</span>
                                <Badge variant="outline" className="text-blue-400 bg-blue-500/10 border-blue-500/20">
                                  Lead
                                </Badge>
                              </Link>
                            ) : (
                              <span className="font-semibold text-zinc-300">Inbound Caller</span>
                            )}
                            <span className="text-[11px] text-zinc-500 block mt-0.5 font-mono">
                              {conv.student?.phone || conv.lead?.phone || "No phone"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Channel */}
                        <TableCell className="text-zinc-300 font-medium">
                          {conv.channel}
                        </TableCell>

                        {/* Outcome */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`uppercase tracking-wider ${
                              conv.outcome === "CONVERTED"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : conv.outcome === "ESCALATED"
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                : conv.outcome === "CONTINUED"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {conv.outcome}
                          </Badge>
                        </TableCell>

                        {/* Cost */}
                        <TableCell className="font-mono font-medium text-zinc-300">
                          {conv.costInPaise !== null
                            ? `₹${(conv.costInPaise / 100).toFixed(2)}`
                            : "—"}
                        </TableCell>

                        {/* Timestamp */}
                        <TableCell className="text-zinc-400 font-mono">
                          {new Date(conv.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedConv({
                                ...conv,
                                agent,
                              });
                              setIsTranscriptOpen(true);
                            }}
                          >
                            Transcript
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
            </>
          )}
        </div>
      </div>

      {/* Transcript Dialog */}
      <TranscriptDialog
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        conversation={selectedConv}
      />
    </div>
  );
}
