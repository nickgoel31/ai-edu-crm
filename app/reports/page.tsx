"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  TrendingUp,
  Users2,
  Bot,
  DollarSign,
  Clock,
  Filter,
  RefreshCw,
  ArrowDownRight,
  ShieldAlert,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface FunnelStep {
  id: string;
  label: string;
  count: number;
  conversionRateFromTotal: number;
  dropOffCount: number;
  dropOffPercentage: number;
  color: string;
}

interface SourceRoiItem {
  source: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  estimatedSpend: number;
  costPerLead: number;
  costPerConversion: number;
}

interface CounselorPerformanceItem {
  counselorId: string;
  name: string;
  email: string;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  avgTimeToConversionDays: number | null;
  avgTimeToConversionHours: number | null;
}

interface AgentPerformanceItem {
  id: string;
  name: string;
  channel: string;
  role: string;
  category: string;
  status: string;
  conversationsCount: number;
  convertedCount: number;
  conversionRate: number;
  costInRupees: number;
  costPerConversion: number;
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: "Meta Lead Ads",
  WHATSAPP: "WhatsApp Inbound",
  GOOGLE_SHEETS: "Google Sheets Sync",
  GOOGLE_ADS: "Google Search Ads",
  WEBSITE_FORM: "Website Form",
  CSV_IMPORT: "CSV Import",
  CALL_TRACKING: "Voice Screener Call",
  REFERRAL: "Referral / Word of Mouth",
  MANUAL: "Manual Walk-in",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"];

import { SLAComplianceSummary } from "@/types";

export default function ReportsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Report data state
  const [summary, setSummary] = useState<any>({});
  const [slaCompliance, setSlaCompliance] = useState<SLAComplianceSummary | null>(null);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
  const [lostReasons, setLostReasons] = useState<Record<string, number>>({});
  const [sourceRoi, setSourceRoi] = useState<SourceRoiItem[]>([]);
  const [counselors, setCounselors] = useState<CounselorPerformanceItem[] | null>(null);
  const [isCounselorRestricted, setIsCounselorRestricted] = useState(false);
  const [agents, setAgents] = useState<AgentPerformanceItem[]>([]);
  const [benchmark, setBenchmark] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange,
        source: selectedSource,
      });

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load reports");

      setLastUpdated(data.lastUpdated);
      setSummary(data.summary || {});
      setSlaCompliance(data.slaCompliance || null);
      setFunnelSteps(data.funnel?.steps || []);
      setLostReasons(data.funnel?.lostReasonCounts || {});
      setSourceRoi(data.sourceRoi || []);
      setCounselors(data.counselorPerformance);
      setIsCounselorRestricted(data.isCounselorRestricted);
      setAgents(data.agentPerformance || []);
      setBenchmark(data.comparativeBenchmark || null);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange, selectedSource]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Filter Controls */}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>Admissions Analytics & ROI</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time conversion funnel, acquisition source profitability, counselor velocity, and AI benchmarking.
          </p>
        </div>

        {/* Filter Controls & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Pills */}
          <div className="flex items-center bg-card p-1 rounded-xl border border-border text-xs font-bold">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange("7d")}
              className={dateRange === "7d" ? "bg-zinc-800 text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"}
            >
              7 Days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange("30d")}
              className={dateRange === "30d" ? "bg-zinc-800 text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"}
            >
              30 Days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange("90d")}
              className={dateRange === "90d" ? "bg-zinc-800 text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"}
            >
              90 Days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange("all")}
              className={dateRange === "all" ? "bg-zinc-800 text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"}
            >
              All Time
            </Button>
          </div>

          {/* Lead Source Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="text-xs font-semibold text-zinc-300 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-card text-zinc-200">All Sources</option>
              <option value="META_ADS" className="bg-card text-zinc-200">Meta Lead Ads</option>
              <option value="WHATSAPP" className="bg-card text-zinc-200">WhatsApp Inbound</option>
              <option value="GOOGLE_SHEETS" className="bg-card text-zinc-200">Google Sheets Sync</option>
              <option value="GOOGLE_ADS" className="bg-card text-zinc-200">Google Search Ads</option>
              <option value="CALL_TRACKING" className="bg-card text-zinc-200">Voice Screener Calls</option>
              <option value="WEBSITE_FORM" className="bg-card text-zinc-200">Website Forms</option>
              <option value="CSV_IMPORT" className="bg-card text-zinc-200">CSV Imports</option>
              <option value="REFERRAL" className="bg-card text-zinc-200">Referrals</option>
            </select>
          </div>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchReports}
            isDisabled={isLoading}
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Timestamp Ribbon */}
      <Card className="flex-row items-center justify-between text-xs text-zinc-400 px-4 py-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            Active Date Scope: <strong className="text-zinc-200">{dateRange.toUpperCase()}</strong> | Filtered Source:{" "}
            <strong className="text-zinc-200">{SOURCE_LABELS[selectedSource] || selectedSource}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            Last updated:{" "}
            <strong className="font-mono text-zinc-300">
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Just now"}
            </strong>
          </span>
        </div>
      </Card>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="p-4 rounded-2xl space-y-1 bg-[#171717] border-[#262626]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Leads Ingested</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white font-mono">{summary.totalLeads || 0}</span>
            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
              {summary.convertingCount || 0} Converted
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500">Pipeline acquisition across channels</p>
        </Card>

        <Card className="p-4 rounded-2xl space-y-1 bg-[#171717] border-[#262626]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">SLA Response Compliance</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {summary.slaComplianceRate !== undefined ? `${summary.slaComplianceRate}%` : "100%"}
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              {summary.avgFirstResponseMinutes ? `${summary.avgFirstResponseMinutes}m avg` : "On Time"}
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500">First contact within source SLA window</p>
        </Card>

        <Card className="p-4 rounded-2xl space-y-1 bg-[#171717] border-[#262626]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Funnel Conversion Rate</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">{summary.overallConversionRate || 0}%</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              Enrolled
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500">From cold enquiry to converted student</p>
        </Card>

        <Card className="p-4 rounded-2xl space-y-1 bg-[#171717] border-[#262626]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">AI Conversations</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-400 font-mono">{summary.totalAiConversations || 0}</span>
            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
              Omnichannel
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500">Voice screener &amp; WhatsApp chats</p>
        </Card>

        <Card className="p-4 rounded-2xl space-y-1 bg-[#171717] border-[#262626]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">AI Fleet Spend</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white font-mono">₹{summary.totalAiCostRupees || "0.00"}</span>
            <Badge className="bg-muted/40 text-zinc-300 border border-border text-[10px]">
              ₹0.15/min
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500">Direct compute &amp; telephony cost</p>
        </Card>
      </div>

      {/* SECTION 1: FUNNEL CONVERSION & DROP-OFF */}
      <Card className="p-6 space-y-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              1. Admissions Conversion Funnel & Stage Drop-Off
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Visualizes lead volume progression through stages and tracks drop-off velocity between transitions.
            </p>
          </div>
        </div>

        {/* Step-by-Step Funnel Visual Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelSteps.map((step, idx) => (
            <div
              key={step.id}
              className="relative p-4 rounded-xl border border-border bg-muted/40 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 mb-1">
                  <span>Step {idx + 1}</span>
                  <span className="font-bold text-zinc-300">{step.conversionRateFromTotal}% of total</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-200">{step.label}</h3>
                <div className="text-2xl font-black text-white mt-1 font-mono">{step.count} leads</div>
              </div>

              {idx > 0 && (
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">Stage Drop-off:</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      step.dropOffPercentage > 50 ? "text-rose-400" : "text-amber-400"
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {step.dropOffPercentage}% (-{step.dropOffCount})
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recharts Funnel Chart */}
        {isMounted && (
          <div className="pt-4">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Lead Volume by Pipeline Stage
            </h4>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelSteps} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#a1a1aa" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      color: "#f4f4f5",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: any) => [`${value} leads`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {funnelSteps.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Lost Reasons Breakdown */}
        {Object.keys(lostReasons).length > 0 && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Primary Lost Stage Reasons (Drop-off Causes)
            </h4>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(lostReasons).map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-3 py-1 bg-muted/40 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold shadow-xs"
                >
                  {reason}: <strong className="text-rose-200">{count}</strong> ({Math.round((count / (summary.lostCount || 1)) * 100)}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 2: SOURCE-WISE ROI TABLE & CHART */}
      <Card className="p-6 space-y-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              2. Source-Wise Acquisition & ROI Performance
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Conversion rate and acquisition spend efficiency broken down by marketing channel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recharts Bar Chart (2 spans) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Lead Volume vs Conversion Rate by Channel
            </h4>
            {isMounted && (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceRoi} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis
                      dataKey="source"
                      tick={{ fontSize: 10, fill: "#a1a1aa" }}
                      tickFormatter={(val) => SOURCE_LABELS[val]?.slice(0, 10) || val}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        color: "#f4f4f5",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any) => [
                        name === "conversionRate" ? `${val}%` : `${val}`,
                        name === "conversionRate" ? "Conversion Rate" : "Total Leads",
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: "#a1a1aa" }} />
                    <Bar dataKey="totalLeads" name="Total Leads" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="convertedLeads" name="Converted" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Channel Share Pie Chart */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Acquisition Share
            </h4>
            {isMounted && (
              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceRoi.filter((s) => s.totalLeads > 0)}
                      dataKey="totalLeads"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {sourceRoi.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        color: "#f4f4f5",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any) => [
                        `${val} leads`,
                        SOURCE_LABELS[String(name)] || name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Source ROI Data Table */}
        <Card className="p-0 overflow-hidden rounded-xl">
          <Table aria-label="Source ROI">
            <TableHeader>
              <TableRow>
                <TableHead>Channel / Lead Source</TableHead>
                <TableHead className="text-right">Leads Ingested</TableHead>
                <TableHead className="text-right">Converted</TableHead>
                <TableHead className="text-right">Conversion %</TableHead>
                <TableHead className="text-right">Est. Spend</TableHead>
                <TableHead className="text-right">Cost / Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceRoi.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-zinc-500 text-xs">
                    No lead records matching selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                sourceRoi.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="font-semibold text-zinc-200">
                      {SOURCE_LABELS[row.source] || row.source}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-zinc-300">
                      {row.totalLeads}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-400 font-bold">
                      {row.convertedLeads}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        className={
                          row.conversionRate >= 40
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                            : row.conversionRate >= 20
                            ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                            : "bg-muted/40 text-zinc-400 border border-border"
                        }
                      >
                        {row.conversionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      ₹{row.estimatedSpend.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-zinc-200">
                      {row.costPerConversion > 0 ? `₹${row.costPerConversion.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Card>

      {/* SECTION 3: INBOUND SLA RESPONSE COMPLIANCE & VELOCITY */}
      <Card className="p-6 space-y-6 rounded-2xl bg-[#171717] border-[#262626]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262626] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                3. Inbound SLA Response Compliance &amp; Speed
              </h2>
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-xs">
                {slaCompliance ? `${slaCompliance.complianceRate}% On-Time` : "100%"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Source-by-source first-response speed against configured SLA thresholds. Prevents inbound prospects from going cold.
            </p>
          </div>
        </div>

        {/* SLA Source Performance Table */}
        <Card className="p-0 overflow-hidden rounded-xl border-[#262626] bg-[#141414]">
          <Table aria-label="SLA Compliance by Source">
            <TableHeader>
              <TableRow>
                <TableHead>Inbound Channel</TableHead>
                <TableHead className="text-center">SLA Window</TableHead>
                <TableHead className="text-right">Total Inbound</TableHead>
                <TableHead className="text-right">Responded On-Time</TableHead>
                <TableHead className="text-right">SLA Breached</TableHead>
                <TableHead className="text-right">Pending Response</TableHead>
                <TableHead className="text-right">Compliance %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!slaCompliance || slaCompliance.sourceBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-zinc-500 text-xs">
                    No lead records matching selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                slaCompliance.sourceBreakdown.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="font-semibold text-zinc-200 text-xs">
                      {SOURCE_LABELS[row.source] || row.source.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-mono bg-[#202020] border-[#333] text-zinc-300">
                        {row.respondWithinMinutes < 60 ? `${row.respondWithinMinutes}m` : `${row.respondWithinMinutes / 60}h`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-zinc-300">
                      {row.total}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-400 font-bold">
                      {row.respondedOnTime}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-400">
                      {row.breached > 0 ? row.breached : "0"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      {row.pending}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        className={
                          row.complianceRate >= 90
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                            : row.complianceRate >= 70
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                        }
                      >
                        {row.complianceRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Card>

      {/* SECTION 4: COUNSELOR-WISE PERFORMANCE (ADMIN ONLY) */}
      <Card className="p-6 space-y-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users2 className="w-5 h-5 text-indigo-400" />
                4. Counselor-Wise Performance & Velocity
              </h2>
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25">
                ADMIN ONLY
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Leads assigned, converted count, individual conversion rates, and average time-to-conversion.
            </p>
          </div>
        </div>

        {isCounselorRestricted ? (
          <div className="p-8 rounded-xl bg-muted/40 border border-border text-center space-y-3">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Counselor Performance View Restricted</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Individual counselor scorecards, peer benchmarks, and time-to-conversion metrics are restricted to
              organization Administrators.
            </p>
          </div>
        ) : (
          <Card className="p-0 overflow-hidden rounded-xl">
            <Table aria-label="Counselor performance">
              <TableHeader>
                <TableRow>
                  <TableHead>Admissions Counselor</TableHead>
                  <TableHead className="text-right">Leads Assigned</TableHead>
                  <TableHead className="text-right">Leads Converted</TableHead>
                  <TableHead className="text-right">Conversion Rate</TableHead>
                  <TableHead className="text-right">Avg Time to Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!counselors || counselors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-zinc-500 text-xs">
                      No counselor activity found for selected time range.
                    </TableCell>
                  </TableRow>
                ) : (
                  counselors.map((c) => (
                    <TableRow key={c.counselorId}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-[4px] bg-muted/40 border border-border text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-200 text-xs">{c.name}</div>
                            <div className="text-[11px] text-zinc-500">{c.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-zinc-300">
                        {c.leadsAssigned}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-400 font-bold">
                        {c.leadsConverted}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={
                            c.conversionRate >= 50
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : c.conversionRate >= 25
                              ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                              : "bg-muted/40 text-zinc-400 border border-border"
                          }
                        >
                          {c.conversionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-300 font-semibold">
                        {c.avgTimeToConversionDays !== null ? (
                          <span>
                            {c.avgTimeToConversionDays} days{" "}
                            <span className="text-[11px] text-zinc-500 font-normal">
                              ({c.avgTimeToConversionHours}h)
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </Card>

      {/* SECTION 5: AGENT-WISE CONVERSION & HUMAN BENCHMARK */}
      <Card className="p-6 space-y-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              5. AI Agent Fleet vs. Human Counselor Benchmarking
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Direct comparison of conversational AI screening agents alongside human admissions team metrics.
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Cards */}
        {benchmark && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Human Team Card */}
            <div className="p-5 rounded-xl border border-border bg-muted/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-zinc-200">Human Admissions Counselors</h3>
                </div>
                <Badge className="text-indigo-300 bg-indigo-500/15 border border-indigo-500/25">
                  Team
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Leads Handled</span>
                  <span className="text-lg font-black text-white font-mono">
                    {benchmark.humanCounselors.totalHandled}
                  </span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Converted</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {benchmark.humanCounselors.totalConverted}
                  </span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Conversion Rate</span>
                  <span className="text-lg font-black text-white font-mono">
                    {benchmark.humanCounselors.conversionRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* AI Agent Fleet Card */}
            <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-zinc-200">Autonomous AI Agent Fleet</h3>
                </div>
                <Badge className="text-purple-300 bg-purple-500/15 border border-purple-500/25">
                  24/7 Engine
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Conversations</span>
                  <span className="text-lg font-black text-purple-400 font-mono">
                    {benchmark.aiAgents.totalHandled}
                  </span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Converted</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {benchmark.aiAgents.totalConverted}
                  </span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border">
                  <span className="text-[11px] text-zinc-500 block font-semibold">Conversion Rate</span>
                  <span className="text-lg font-black text-purple-400 font-mono">
                    {benchmark.aiAgents.conversionRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Agents Individual Performance Table */}
        <Card className="p-0 overflow-hidden rounded-xl">
          <Table aria-label="AI agent performance">
            <TableHeader>
              <TableRow>
                <TableHead>AI Agent Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="text-right">Converted</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Cost / Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-semibold text-zinc-200 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {agent.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-muted/40 text-zinc-300 border border-border">
                      {agent.role?.replace(/_/g, " ") || agent.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-zinc-300">
                    {agent.conversationsCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-400 font-bold">
                    {agent.convertedCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {agent.conversionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-400 text-xs">
                    ₹{agent.costInRupees.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-xs text-zinc-200">
                    {agent.costPerConversion > 0 ? `₹${agent.costPerConversion.toFixed(2)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Card>
    </div>
  );
}
