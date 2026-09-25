"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
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
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  AgentStatus,
  AgentChannel,
  AgentRole,
  AgentCategory,
  AGENT_ROLE_META,
  AGENT_CATEGORY_LABELS,
  AGENT_MARKETPLACE_ROLES,
  ConversationOutcome,
} from "@/types";
import { AGENT_CATALOG } from "@/lib/agent-catalog";
import { TranscriptDialog } from "@/components/agents/transcript-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface AgentItem {
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
  metrics: {
    conversationsToday: number;
    conversationsThisWeek: number;
    totalConversations: number;
    convertedCount: number;
    conversionRate: number;
    costThisMonthPaise: number;
    costThisMonthRupees: string;
  };
}

interface EscalationItem {
  id: string;
  channel: string;
  transcript: string;
  outcome: ConversationOutcome;
  costInPaise: number | null;
  createdAt: string;
  claimedByUserId?: string | null;
  claimedAt?: string | null;
  agent: {
    id: string;
    name: string;
    channel: string;
    role: string;
    status: string;
  };
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

export default function AgentsDashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canMutate = userRole === "ADMIN" || userRole === "COUNSELOR";
  const currentUserId = session?.user?.id;

  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [escalationFilter, setEscalationFilter] = useState<"all" | "unclaimed" | "claimed">("all");

  const [activeTab, setActiveTab] = useState<"fleet" | "escalations">("fleet");
  const [isLoading, setIsLoading] = useState(true);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Transcript modal state
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [agentsRes, escRes] = await Promise.all([
        fetch("/api/agents"),
        fetch(`/api/agents/escalations?filter=${escalationFilter}`),
      ]);

      const [agentsData, escData] = await Promise.all([
        agentsRes.json(),
        escRes.json(),
      ]);

      if (agentsRes.ok) {
        setAgents(agentsData.agents || []);
        setStats(agentsData.stats || null);
      }
      if (escRes.ok) {
        setEscalations(escData.escalations || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load agents dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [escalationFilter]);

  // Toggle Agent LIVE / PAUSED
  const handleToggleStatus = async (agent: AgentItem) => {
    if (!canMutate) return;

    const nextStatus: AgentStatus =
      agent.status === AgentStatus.LIVE ? AgentStatus.PAUSED : AgentStatus.LIVE;

    setTogglingAgentId(agent.id);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to toggle agent status.");

      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a))
      );
      setSuccess(`${agent.name} is now ${nextStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchDashboardData();
    } catch (err: any) {
      setError(err?.message || "Failed to toggle agent.");
    } finally {
      setTogglingAgentId(null);
    }
  };

  // Claim or Release Escalation
  const handleClaimEscalation = async (
    conversationId: string,
    action: "CLAIM" | "RELEASE" = "CLAIM"
  ) => {
    if (!canMutate) return;

    setClaimingId(conversationId);
    setError(null);

    try {
      const res = await fetch("/api/agents/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update escalation.");

      setSuccess(data.message || "Escalation updated.");
      setTimeout(() => setSuccess(null), 3000);
      fetchDashboardData();
    } catch (err: any) {
      setError(err?.message || "Failed to claim escalation.");
    } finally {
      setClaimingId(null);
    }
  };

  const getAgentIcon = (channel: AgentChannel) => {
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

  const unclaimedEscalationCount = useMemo(() => {
    return escalations.filter((e) => !e.claimedByUserId).length;
  }, [escalations]);

  // Active Agents = every Agent record actually deployed for this org.
  const activeAgents = agents;

  // Available Agents (marketplace) = curated 10-agent catalog, minus roles already deployed.
  const deployedRoles = useMemo(() => new Set(agents.map((a) => a.role)), [agents]);
  const availableCatalogEntries = useMemo(
    () =>
      AGENT_CATALOG.filter(
        (entry) => AGENT_MARKETPLACE_ROLES.includes(entry.role) && !deployedRoles.has(entry.role)
      ),
    [deployedRoles]
  );
  const marketplaceByCategory = useMemo(() => {
    const groups = new Map<AgentCategory, typeof availableCatalogEntries>();
    for (const entry of availableCatalogEntries) {
      const category = AGENT_ROLE_META[entry.role].category;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(entry);
    }
    return groups;
  }, [availableCatalogEntries]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              AI Conversational Agents
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              Omnichannel
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Autonomous Voice, WhatsApp, and Web AI assistants qualifying admissions leads and handling inquiries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchDashboardData()} aria-label="Refresh dashboard">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
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

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Live Fleet</span>
            <span className="p-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg">
              <Bot className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              {stats?.activeAgentsCount ?? 0}
            </span>
            <span className="text-[11px] text-muted-foreground">
              / {stats?.totalAgentsCount ?? 0} agents
            </span>
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Today's Chats</span>
            <span className="p-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              {stats?.totalConversationsToday ?? 0}
            </span>
            <span className="text-[11px] text-muted-foreground">
              ({stats?.totalConversationsThisWeek ?? 0} this week)
            </span>
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Conversion Rate</span>
            <span className="p-1.5 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-purple-400">
              {stats?.overallConversionRate ?? 0}%
            </span>
            <span className="text-[11px] text-muted-foreground">converted</span>
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Month Spend</span>
            <span className="p-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg">
              <Coins className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              ₹{stats?.totalCostThisMonthRupees ?? "0.00"}
            </span>
            <span className="text-[11px] text-muted-foreground">total API cost</span>
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as typeof activeTab)}
      >
        <TabsList variant="line" className="border-b border-border rounded-none w-full justify-start h-auto p-0">
          <TabsTrigger id="fleet" className="py-2 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0">
            <Bot className="w-3.5 h-3.5" />
            <span>Configured Agents</span>
            <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
              {agents.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger id="escalations" className="py-2 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-rose-500 data-selected:after:opacity-0">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Escalation Queue</span>
            {unclaimedEscalationCount > 0 && (
              <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                {unclaimedEscalationCount} Unclaimed
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab 1: Active Agents + Available Agents catalog */}
      {activeTab === "fleet" && (
        <div className="space-y-8">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <p className="text-sm font-medium">Loading AI agents...</p>
            </div>
          ) : (
            <>
              {/* Active Agents */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="text-sm font-bold text-foreground">Active Agents</h2>
                  <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
                    {activeAgents.length}
                  </Badge>
                </div>

                {activeAgents.length === 0 ? (
                  <div className="flex items-center gap-2.5 py-4 px-1 text-zinc-500">
                    <Bot className="w-4 h-4 shrink-0" />
                    <p className="text-xs">No agents deployed yet — deploy one from the catalog below.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {activeAgents.map((agent) => {
                      const Icon = getAgentIcon(agent.channel);
                      const isToggling = togglingAgentId === agent.id;
                      const isLive = agent.status === AgentStatus.LIVE;
                      const roleLabel = AGENT_ROLE_META[agent.role]?.label || agent.role.replace(/_/g, " ");

                      return (
                        <Card
                          key={agent.id}
                          className={`p-0 flex-col justify-between overflow-hidden transition-all ${
                            isLive ? "" : "opacity-75"
                          }`}
                        >
                          {/* Card Header */}
                          <div className="p-4 border-b border-border space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`p-2 rounded-lg ${
                                    agent.channel === "VOICE"
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                                      : agent.channel === "WHATSAPP"
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                      : agent.channel === "EMAIL"
                                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                      : "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-foreground text-xs leading-tight">
                                    {agent.name}
                                  </h3>
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {roleLabel} · {agent.channel.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </div>

                              {/* Status badge */}
                              <Badge
                                variant="outline"
                                className={
                                  isLive
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 uppercase"
                                    : "bg-muted text-muted-foreground border-border uppercase"
                                }
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                                  }`}
                                />
                                {agent.status}
                              </Badge>
                            </div>
                          </div>

                          {/* Card Metrics Grid */}
                          <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20 text-xs">
                            <div className="p-3 space-y-0.5">
                              <span className="text-[10px] text-muted-foreground font-medium">Conversations</span>
                              <p className="text-sm font-bold text-foreground">
                                {agent.metrics.conversationsToday}
                                <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                  ({agent.metrics.conversationsThisWeek} w)
                                </span>
                              </p>
                            </div>

                            <div className="p-3 space-y-0.5">
                              <span className="text-[10px] text-muted-foreground font-medium">Conv. Rate</span>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {agent.metrics.conversionRate}%
                                <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                  ({agent.metrics.convertedCount})
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Card Cost Row */}
                          <div className="px-3 py-2 border-b border-border text-[10px] text-zinc-500 flex items-center justify-between">
                            <span>Cost this month</span>
                            <span className="font-mono text-zinc-300">
                              ₹{agent.metrics.costThisMonthRupees}
                            </span>
                          </div>

                          {/* Card Actions Footer */}
                          <div className="p-3.5 border-t border-border bg-card flex items-center justify-between gap-2">
                            {/* Live/Paused Toggle Button */}
                            {canMutate ? (
                              <Button
                                variant={isLive ? "outline" : "default"}
                                size="sm"
                                onClick={() => handleToggleStatus(agent)}
                                isDisabled={isToggling}
                                className={isLive ? "" : "bg-emerald-600 text-white hover:bg-emerald-500"}
                                aria-label={isLive ? "Pause this agent" : "Resume this agent"}
                              >
                                {isToggling ? (
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
                            ) : (
                              <span className="text-xs text-zinc-500 italic">Read-only status</span>
                            )}

                            {/* Manage Details Link */}
                            <Link
                              href={`/agents/${agent.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              <span>Config & Logs</span>
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agent Marketplace, grouped by category */}
              {availableCatalogEntries.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <h2 className="text-sm font-bold text-foreground">Agent Marketplace</h2>
                    <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
                      {availableCatalogEntries.length} available
                    </Badge>
                  </div>

                  {Array.from(marketplaceByCategory.entries()).map(([category, entries]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {AGENT_CATEGORY_LABELS[category]}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {entries.map((entry) => {
                          const meta = AGENT_ROLE_META[entry.role];
                          const Icon = getAgentIcon(meta.channel);

                          return (
                            <Link key={entry.role} href={`/agents/${entry.role}`} className="group block">
                              <Card className="p-0 flex-col justify-between overflow-hidden h-full border-dashed hover:border-solid hover:ring-1 hover:ring-blue-500/40 transition-all">
                                <div className="p-4 space-y-2.5 flex-1">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-muted text-muted-foreground border border-border group-hover:text-blue-500 group-hover:border-blue-500/30 transition-colors">
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-foreground text-xs leading-tight">
                                        {entry.name}
                                      </h3>
                                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                        {meta.channel.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">{entry.description}</p>
                                </div>

                                <div className="p-3.5 border-t border-border bg-card flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Not added</span>
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 dark:hover:text-blue-300">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Add to CRM</span>
                                  </span>
                                </div>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Escalation Queue View */}
      {activeTab === "escalations" && (
        <div className="space-y-4">
          {/* Subheader & Filters */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Counselor Escalation Queue</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                AI Agent interactions flagged as <span className="font-semibold text-rose-400">ESCALATED</span> awaiting human takeover.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {(["all", "unclaimed", "claimed"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={escalationFilter === mode ? "default" : "outline"}
                  onClick={() => setEscalationFilter(mode)}
                  className="capitalize"
                >
                  {mode}
                </Button>
              ))}
            </div>
          </Card>

          {/* Escalations Table */}
          <Card className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                <p className="text-sm font-medium">Loading escalation queue...</p>
              </div>
            ) : escalations.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-bold text-zinc-200">Escalation Queue Clear</h3>
                <p className="text-xs text-zinc-500">
                  No escalated conversations found matching the selected filter.
                </p>
              </div>
            ) : (
              <Table aria-label="Escalations">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                    <TableHead>Contact</TableHead>
                    <TableHead>Agent & Channel</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Claim Status</TableHead>
                    <TableHead className="text-right">Takeover & Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                  {escalations.map((esc) => {
                    const isClaiming = claimingId === esc.id;
                    const isClaimedByMe = esc.claimedByUserId === currentUserId;
                    const isUnclaimed = !esc.claimedByUserId;

                    return (
                      <TableRow
                        key={esc.id}
                        className={`border-border/60 hover:bg-muted/40/50 transition-colors ${
                          isUnclaimed ? "bg-rose-500/5" : ""
                        }`}
                      >
                        {/* Contact Info */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-[4px] bg-muted/40 border border-border text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {(esc.student?.name || esc.lead?.name || "C")[0].toUpperCase()}
                            </div>
                            <div>
                              {esc.student ? (
                                <Link
                                  href={`/students/${esc.student.id}`}
                                  className="font-bold text-foreground hover:text-blue-400 hover:underline flex items-center gap-1.5 text-xs"
                                >
                                  <span>{esc.student.name}</span>
                                  <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                    Student
                                  </Badge>
                                </Link>
                              ) : esc.lead ? (
                                <Link
                                  href={`/leads/${esc.lead.id}`}
                                  className="font-bold text-foreground hover:text-blue-400 hover:underline flex items-center gap-1.5 text-xs"
                                >
                                  <span>{esc.lead.name}</span>
                                  <Badge variant="outline" className="text-blue-400 bg-blue-500/10 border-blue-500/20">
                                    Lead
                                  </Badge>
                                </Link>
                              ) : (
                                <span className="font-bold text-zinc-300 text-xs">
                                  Inbound Caller
                                </span>
                              )}
                              <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                                {esc.student?.phone || esc.lead?.phone || "No phone"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Agent & Channel */}
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            <span className="font-semibold text-zinc-200 block">
                              {esc.agent.name}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              {esc.channel}
                            </span>
                          </div>
                        </TableCell>

                        {/* Timestamp */}
                        <TableCell className="text-xs text-zinc-400 font-mono">
                          {new Date(esc.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>

                        {/* Claim Status Badge */}
                        <TableCell>
                          {esc.claimedBy ? (
                            <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                              <UserCheck className="w-3 h-3" />
                              <span>
                                {isClaimedByMe ? "You" : esc.claimedBy.name || esc.claimedBy.email}
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-rose-400 bg-rose-500/15 border-rose-500/30 uppercase">
                              Unclaimed
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedConversation(esc);
                                setIsTranscriptOpen(true);
                              }}
                            >
                              View Transcript
                            </Button>

                            {canMutate && (
                              <>
                                {isUnclaimed ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleClaimEscalation(esc.id, "CLAIM")}
                                    isDisabled={isClaiming}
                                  >
                                    {isClaiming ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <UserCheck className="w-3.5 h-3.5" />
                                    )}
                                    <span>Claim & Take Over</span>
                                  </Button>
                                ) : isClaimedByMe ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleClaimEscalation(esc.id, "RELEASE")}
                                    isDisabled={isClaiming}
                                    aria-label="Release back to queue"
                                  >
                                    Release
                                  </Button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Transcript Dialog */}
      <TranscriptDialog
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        conversation={selectedConversation}
      />
    </div>
  );
}
