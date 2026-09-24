"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Phone,
  Mail,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Building,
  User,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Bot,
  ChevronRight,
} from "lucide-react";
import { LeadStage, LeadSource, Tag } from "@/types";
import { LostReasonDialog } from "@/components/leads/lost-reason-dialog";
import { ConvertLeadDialog } from "@/components/students/convert-lead-dialog";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { TranscriptDialog } from "@/components/agents/transcript-dialog";
import { InlineTagPicker } from "@/components/tags/inline-tag-picker";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Counselor {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface LeadDetail {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  stage: LeadStage;
  lostReason: string | null;
  assignedToUserId: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: Counselor | null;
  conversations?: any[];
  tags?: Tag[];
  students?: {
    id: string;
    name: string;
    stage: string;
    program: string;
    cohort: string;
    createdAt: string;
  }[];
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const userRole = session?.user?.role;
  const canEdit = userRole === "ADMIN" || userRole === "COUNSELOR";

  const fetchLeadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load lead details.");
      }

      setLead(data.lead);
      setCounselors(data.counselors || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load lead profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
    }
  }, [leadId]);

  const handleStageChange = async (targetStage: LeadStage) => {
    if (!canEdit || !lead) return;

    if (targetStage === LeadStage.LOST) {
      setIsLostModalOpen(true);
    } else {
      await updateLead({ stage: targetStage, lostReason: null }, `Stage changed to ${targetStage}`);
    }
  };

  const confirmLostReason = async (reason: string) => {
    setIsLostModalOpen(false);
    await updateLead({ stage: LeadStage.LOST, lostReason: reason }, "Lead marked as Lost");
  };

  const handleCounselorChange = async (counselorId: string) => {
    if (!canEdit || !lead) return;
    const counselor = counselors.find((c) => c.id === counselorId);
    await updateLead(
      { assignedToUserId: counselorId === "unassigned" ? null : counselorId },
      counselor ? `Assigned to ${counselor.name || counselor.email}` : "Lead unassigned"
    );
  };

  const updateLead = async (updates: any, successMessage?: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update lead.");
      }

      toast.success(successMessage || "Lead updated successfully");
      fetchLeadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update lead.");
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string, type: "phone" | "email") => {
    navigator.clipboard.writeText(text);
    if (type === "phone") {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
    toast.info(`Copied ${type} to clipboard`);
  };

  const getStageBadge = (stage: LeadStage) => {
    switch (stage) {
      case "COLD":
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
      case "WARM":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "HOT":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "CONVERTING":
        return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "LOST":
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  const getStageBadgeVariant = (stage: LeadStage): "default" | "secondary" | "destructive" | "outline" => {
    switch (stage) {
      case "HOT":
        return "destructive";
      case "CONVERTING":
        return "default";
      case "LOST":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-2xl bg-card" />
            <Skeleton className="h-72 w-full rounded-2xl bg-card" />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-40 w-full rounded-2xl bg-card" />
            <Skeleton className="h-52 w-full rounded-2xl bg-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <Card className="max-w-xl mx-auto py-16 text-center space-y-4 p-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white font-heading">Lead Not Found</h2>
        <p className="text-xs text-zinc-400">
          This lead may have been removed or belongs to another organization.
        </p>
        <Button render={(props: any) => <Link href="/leads" {...props} />} className="mx-auto">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Leads Pipeline</span>
        </Button>
      </Card>
    );
  }

  const initial = lead.name ? lead.name[0].toUpperCase() : "L";
  const scoreVal = lead.score ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads Pipeline</span>
        </Link>

        {!canEdit && (
          <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
            Read-Only Mode
          </Badge>
        )}
      </div>

      {/* Hero Profile Header Card */}
      <Card className="p-6 flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg font-bold shrink-0 shadow-sm">
            {initial}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground tracking-tight font-heading truncate">
                {lead.name}
              </h1>
              <Badge variant={getStageBadgeVariant(lead.stage)} className="uppercase tracking-wider">
                {lead.stage}
              </Badge>
              <Badge variant="outline" className="bg-muted/40 text-foreground border-border">
                {lead.source.replace(/_/g, " ")}
              </Badge>
              <InlineTagPicker
                entityType="LEAD"
                entityId={lead.id}
                initialTags={lead.tags || []}
                canEdit={canEdit}
                onTagsChange={(newTags) => {
                  setLead((prev) => (prev ? { ...prev, tags: newTags } : null));
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
              <span>Lead ID: {lead.id.slice(0, 16)}...</span>
              <span>•</span>
              <span>Added {new Date(lead.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}</span>
            </p>
          </div>
        </div>

        {/* Header Action: Enrolled Link or Quick Convert CTA */}
        <div className="shrink-0">
          {lead.students && lead.students.length > 0 ? (
            <Button
              render={(props: any) => <Link href={`/students/${lead.students![0].id}`} {...props} />}
              className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
              variant="ghost"
            >
              <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Enrolled Student: {lead.students[0].name}</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setIsConvertModalOpen(true)}
              isDisabled={!canEdit}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Convert to Student</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ================= LEFT / MAIN COLUMN (2/3) ================= */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick Contact Dossier */}
          <Card className="p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading border-b border-border pb-2.5">
              Contact & Acquisition Dossier
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone with Call & Copy */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Phone Number
                </span>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-xs font-mono font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 truncate"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">{lead.phone}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lead.phone, "phone")}
                    className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                    title="Copy phone"
                  >
                    {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Email with Mail & Copy */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Email Address
                </span>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-xs font-mono font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 truncate"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">{lead.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lead.email, "email")}
                    className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                    title="Copy email"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Ingestion & Qualification Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">Acquisition Channel</span>
                <p className="text-xs font-semibold text-foreground">{lead.source.replace(/_/g, " ")}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">Inquiry Score</span>
                <p className={`text-xs font-bold ${
                  scoreVal >= 80 ? "text-emerald-500" : scoreVal >= 50 ? "text-amber-500" : "text-rose-500"
                }`}>
                  {scoreVal} / 100 Points
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">Last Profile Update</span>
                <p className="text-xs font-semibold text-foreground">
                  {new Date(lead.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Score progress indicator */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Intent Qualification Bar</span>
                <span className="font-mono text-foreground font-bold">{scoreVal}%</span>
              </div>
              <Progress
                value={Math.min(scoreVal, 100)}
                aria-label="Intent Qualification Bar"
                className={`[&_[data-slot=progress-indicator]]:${
                  scoreVal >= 80 ? "bg-emerald-500" : scoreVal >= 50 ? "bg-amber-500" : "bg-rose-500"
                } [&_[data-slot=progress-track]]:bg-muted [&_[data-slot=progress-track]]:h-1.5`}
              />
            </div>
          </Card>

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading px-1">
              Interactive Activity & Notes Log
            </h2>
            <ActivityTimeline entityType="LEAD" entityId={leadId} canEdit={canEdit} />
          </div>
        </div>

        {/* ================= RIGHT / STICKY SIDEBAR (1/3) ================= */}
        <div className="space-y-5 lg:sticky lg:top-20">
          {/* Pipeline Controls Card */}
          <Card className="p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading border-b border-border pb-2.5">
              Pipeline Management
            </h2>

            {/* Stage Selector */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Lead Stage
              </Label>
              <Select
                selectedKey={lead.stage}
                onSelectionChange={(key) => handleStageChange(key as LeadStage)}
                isDisabled={!canEdit || isUpdating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LeadStage).map((stg) => (
                    <SelectItem key={stg} id={stg}>
                      {stg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lost Reason Notice */}
            {lead.stage === LeadStage.LOST && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs space-y-1">
                <span className="font-semibold text-rose-500 dark:text-rose-300 block text-[11px] uppercase tracking-wider">
                  Reason for Loss:
                </span>
                <p className="text-rose-600 dark:text-rose-200 leading-relaxed font-medium">
                  {lead.lostReason || "No specific reason specified."}
                </p>
              </div>
            )}

            {/* Assigned Counselor */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Assigned Counselor
              </Label>
              <Select
                selectedKey={lead.assignedToUserId || "unassigned"}
                onSelectionChange={(key) => handleCounselorChange(String(key))}
                isDisabled={!canEdit || isUpdating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id="unassigned">-- Unassigned --</SelectItem>
                  {counselors.map((c) => (
                    <SelectItem key={c.id} id={c.id}>
                      {c.name || c.email} ({c.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* AI Conversations Summary Card */}
          {lead.conversations && lead.conversations.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  <span>AI Agent Logs</span>
                </h2>
                <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border">
                  {lead.conversations.length}
                </Badge>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto crm-scrollbar">
                {lead.conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation({ ...conv, lead })}
                    className="p-3 bg-muted/40 border border-border hover:border-border/80 rounded-xl text-xs space-y-1.5 cursor-pointer transition-all duration-150 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground group-hover:text-blue-500 transition-colors truncate">
                        {conv.agent?.name || "AI Assistant"} ({conv.channel})
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-muted-foreground line-clamp-2 text-[11px] italic">
                      "{conv.transcript}"
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="text-muted-foreground font-medium">
                        Outcome: <strong className="text-foreground">{conv.outcome}</strong>
                      </span>
                      <span className="text-blue-500 font-semibold group-hover:underline flex items-center gap-0.5">
                        <span>Transcript</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <LostReasonDialog
        isOpen={isLostModalOpen}
        leadName={lead.name}
        onConfirm={confirmLostReason}
        onCancel={() => setIsLostModalOpen(false)}
        isSubmitting={isUpdating}
      />

      <ConvertLeadDialog
        lead={lead}
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        onSuccess={(studentId) => {
          fetchLeadData();
          router.push(`/students/${studentId}`);
        }}
      />

      <TranscriptDialog
        isOpen={!!selectedConversation}
        onClose={() => setSelectedConversation(null)}
        conversation={selectedConversation}
      />
    </div>
  );
}
