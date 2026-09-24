"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  Phone,
  Mail,
  MessageSquare,
  Flame,
  UserCheck,
  Calendar,
  GraduationCap,
  Copy,
  Check,
  Building,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Bot,
  PhoneCall,
  Volume2,
} from "lucide-react";
import { LeadStage, LeadSource, Tag } from "@/types";
import { updateLeadStageAction, assignLeadCounselorAction } from "@/app/actions/leads";
import { LostReasonDialog } from "./lost-reason-dialog";
import { ConvertLeadDialog } from "@/components/students/convert-lead-dialog";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { CustomFieldsRenderer } from "@/components/custom-fields/custom-fields-renderer";
import { InlineTagPicker } from "@/components/tags/inline-tag-picker";
import { CustomFieldDefinition } from "@/types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LeadDetailDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onLeadUpdated?: (updatedLead: any) => void;
}

export function LeadDetailDrawer({
  leadId,
  isOpen,
  canEdit,
  onClose,
  onLeadUpdated,
}: LeadDetailDrawerProps) {
  const [lead, setLead] = useState<any | null>(null);
  const [counselors, setCounselors] = useState<any[]>([]);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [isSavingCustomFields, setIsSavingCustomFields] = useState(false);
  const [hasCustomFieldChanges, setHasCustomFieldChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAiCalling, setIsAiCalling] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Modals
  const [isLostReasonOpen, setIsLostReasonOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch full lead details when drawer opens
  const fetchLeadDetails = () => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load lead details.");
        return res.json();
      })
      .then((data) => {
        setLead(data.lead);
        setCounselors(data.counselors || []);
        setCustomFieldDefinitions(data.customFieldDefinitions || []);
        setCustomFieldValues(data.customFieldValues || {});
        setHasCustomFieldChanges(false);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load lead details.");
      });
  };

  useEffect(() => {
    if (!leadId || !isOpen) {
      setLead(null);
      setCustomFieldValues({});
      setCustomFieldDefinitions([]);
      setHasCustomFieldChanges(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/leads/${leadId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load lead details.");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setLead(data.lead);
          setCounselors(data.counselors || []);
          setCustomFieldDefinitions(data.customFieldDefinitions || []);
          setCustomFieldValues(data.customFieldValues || {});
          setHasCustomFieldChanges(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          toast.error(err.message || "Failed to load lead details.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [leadId, isOpen]);

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasCustomFieldChanges(true);
  };

  const handleSaveCustomFields = async () => {
    if (!leadId || !canEdit || isSavingCustomFields) return;
    setIsSavingCustomFields(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: customFieldValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save custom fields.");
      toast.success("Custom attributes saved.");
      setHasCustomFieldChanges(false);
      if (onLeadUpdated && data.lead) {
        onLeadUpdated({
          ...data.lead,
          customFields: customFieldValues,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save custom attributes.");
    } finally {
      setIsSavingCustomFields(false);
    }
  };

  if (!isOpen) return null;

  // AI Agent Call Trigger
  const handleTriggerAiCall = async () => {
    if (!lead || isAiCalling) return;

    try {
      setIsAiCalling(true);
      toast.info(`Connecting to AI Voice Caller for ${lead.name}...`);

      const res = await fetch(`/api/leads/${lead.id}/ai-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "Vocational course qualification & practical demo scheduling",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate AI call.");
      }

      toast.success(data.message || `AI Voice Call completed for ${lead.name}!`);
      
      // Refresh lead details and timeline
      fetchLeadDetails();
      setTimelineKey((prev) => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Error triggering AI call.");
    } finally {
      setIsAiCalling(false);
    }
  };

  const handleStageSelect = async (targetStage: LeadStage) => {
    if (!lead || !canEdit || isUpdating) return;

    if (targetStage === LeadStage.LOST) {
      setIsLostReasonOpen(true);
      return;
    }

    try {
      setIsUpdating(true);
      const res = await updateLeadStageAction(lead.id, targetStage, null);
      if (res.success && res.lead) {
        const updated = { ...lead, stage: targetStage, lostReason: null };
        setLead(updated);
        toast.success(`Stage updated to ${targetStage}`);
        if (onLeadUpdated) onLeadUpdated(updated);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update lead stage.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLostReasonConfirm = async (reason: string) => {
    if (!lead) return;
    try {
      setIsUpdating(true);
      const res = await updateLeadStageAction(lead.id, LeadStage.LOST, reason);
      if (res.success && res.lead) {
        const updated = { ...lead, stage: LeadStage.LOST, lostReason: reason };
        setLead(updated);
        toast.success("Lead marked as lost");
        if (onLeadUpdated) onLeadUpdated(updated);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark lead as lost.");
    } finally {
      setIsUpdating(false);
      setIsLostReasonOpen(false);
    }
  };

  const handleCounselorChange = async (counselorId: string) => {
    if (!lead || !canEdit || isUpdating) return;

    try {
      setIsUpdating(true);
      const res = await assignLeadCounselorAction(lead.id, counselorId);
      if (res.success && res.lead) {
        const selectedCounselor = counselors.find((c) => c.id === counselorId) || null;
        const updated = {
          ...lead,
          assignedToUserId: counselorId === "unassigned" ? null : counselorId,
          assignedTo: selectedCounselor,
        };
        setLead(updated);
        toast.success(
          selectedCounselor
            ? `Assigned to ${selectedCounselor.name || selectedCounselor.email}`
            : "Lead unassigned"
        );
        if (onLeadUpdated) onLeadUpdated(updated);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reassign lead.");
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

  const initial = lead?.name ? lead.name[0].toUpperCase() : "L";

  const getStageBadgeStyle = (stage: LeadStage) => {
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
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
      />

      {/* Drawer Container - matching website background */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-xl md:max-w-2xl bg-background border-l border-border text-foreground shadow-2xl flex flex-col transition-transform duration-300 ease-out animate-in slide-in-from-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-muted text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground tracking-tight truncate">
                {isLoading ? "Loading lead..." : lead?.name || "Lead Details"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {lead && (
                  <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${getStageBadgeStyle(lead.stage)}`}>
                    {lead.stage}
                  </Badge>
                )}
                {lead?.source && (
                  <span className="text-[11px] text-muted-foreground">
                    via {lead.source.replace(/_/g, " ")}
                  </span>
                )}
                {lead && (
                  <InlineTagPicker
                    entityType="LEAD"
                    entityId={lead.id}
                    initialTags={lead.tags || []}
                    canEdit={canEdit}
                    onTagsChange={(newTags) => {
                      if (lead) {
                        const updated = { ...lead, tags: newTags };
                        setLead(updated);
                        if (onLeadUpdated) onLeadUpdated(updated);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {lead && (
              <Link
                href={`/leads/${lead.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Open full page in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 crm-scrollbar">
          {isLoading || !lead ? (
            <div className="py-24 flex flex-col items-center justify-center text-muted-foreground space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              <p className="text-xs">Fetching lead details...</p>
            </div>
          ) : (
            <>
              {/* Quick Communication, AI Caller & Conversion Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* 1. Direct Call */}
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors text-xs font-semibold"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>Call</span>
                </a>

                {/* 2. WhatsApp */}
                <a
                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors text-xs font-semibold"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>

                {/* 3. Email */}
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors text-xs font-semibold"
                >
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>Email</span>
                </a>

                {/* 4. Let AI Agent Call (NEW OPTION) */}
                <button
                  type="button"
                  onClick={handleTriggerAiCall}
                  disabled={isAiCalling || !canEdit}
                  className="relative col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 transition-all text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 group"
                  title="Dispatch autonomous AI Voice Agent to call this lead immediately"
                >
                  {isAiCalling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      <span>Calling...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                      <span className="truncate">AI Call</span>
                    </>
                  )}
                </button>

                {/* 5. Convert / Enrolled status */}
                {lead.students && lead.students.length > 0 ? (
                  <Link
                    href={`/students/${lead.students[0].id}`}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors text-xs font-semibold"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enrolled</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConvertModalOpen(true)}
                    disabled={!canEdit}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Convert</span>
                  </button>
                )}
              </div>

              {/* AI Calling Pulse Notice Banner (when calling) */}
              {isAiCalling && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-rose-300">AI Voice Screener Calling {lead.name}...</p>
                    <p className="text-rose-200/75 text-[11px]">Executing automated qualification script & voice demo booking.</p>
                  </div>
                </div>
              )}

              {/* Pipeline Management Card */}
              <Card className="p-4 space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Pipeline Management
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Stage Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold">
                      Stage Transition
                    </Label>
                    <select
                      value={lead.stage}
                      onChange={(e) => handleStageSelect(e.target.value as LeadStage)}
                      disabled={!canEdit || isUpdating}
                      className={cn(
                        "w-full text-xs font-semibold px-3 py-2 rounded-lg border focus:outline-none cursor-pointer [color-scheme:dark] transition-colors",
                        getStageBadgeStyle(lead.stage)
                      )}
                    >
                      <option value="COLD" className="bg-[#18181b] text-cyan-300">Cold Inquiries</option>
                      <option value="WARM" className="bg-[#18181b] text-amber-300">Warm Prospects</option>
                      <option value="HOT" className="bg-[#18181b] text-rose-300">Hot Priority</option>
                      <option value="CONVERTING" className="bg-[#18181b] text-purple-300">Converting</option>
                      <option value="LOST" className="bg-[#18181b] text-zinc-400">Lost / Closed</option>
                    </select>
                  </div>

                  {/* Counselor Reassign */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold">
                      Assigned Counselor
                    </Label>
                    <select
                      value={lead.assignedToUserId || "unassigned"}
                      onChange={(e) => handleCounselorChange(e.target.value)}
                      disabled={!canEdit || isUpdating}
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none cursor-pointer [color-scheme:dark] [&>option]:bg-[#18181b] [&>option]:text-zinc-200"
                    >
                      <option value="unassigned">-- Unassigned --</option>
                      {counselors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.email} ({c.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lost Reason Banner if lost */}
                {lead.stage === LeadStage.LOST && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-xs space-y-1">
                    <span className="font-semibold text-rose-300 block text-[11px] uppercase tracking-wider">
                      Reason for Loss:
                    </span>
                    <p className="text-rose-200 font-medium">
                      {lead.lostReason || "No specific reason specified."}
                    </p>
                  </div>
                )}
              </Card>

              {/* Contact Information Card */}
              <Card className="p-4 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Contact Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Phone */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                    <div className="space-y-0.5 truncate">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Phone</span>
                      <span className="font-mono text-foreground font-medium">{lead.phone}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lead.phone, "phone")}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy phone"
                    >
                      {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Email */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                    <div className="space-y-0.5 truncate">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Email</span>
                      <span className="font-mono text-foreground font-medium truncate block">{lead.email}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lead.email, "email")}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Copy email"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Score */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Lead Score</span>
                    {lead.score !== null ? (
                      <Badge variant="outline" className={cn(
                        "font-mono text-[11px] font-bold",
                        lead.score >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                        lead.score >= 50 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                        "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      )}>
                        {lead.score} pts
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono">—</span>
                    )}
                  </div>

                  {/* Date Created */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Date Added</span>
                    <span className="text-foreground font-mono text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Dynamic Custom Fields Card (if definitions exist) */}
              {customFieldDefinitions.length > 0 && (
                <Card className="p-4 space-y-4">
                  <CustomFieldsRenderer
                    definitions={customFieldDefinitions}
                    values={customFieldValues}
                    onChange={handleCustomFieldChange}
                    disabled={!canEdit || isSavingCustomFields}
                    columns={2}
                  />

                  {canEdit && hasCustomFieldChanges && (
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveCustomFields}
                        isDisabled={isSavingCustomFields}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        {isSavingCustomFields ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>Save Custom Attributes</span>
                        )}
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {/* AI Agent Conversations Transcript Summary */}
              {lead.conversations && lead.conversations.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-rose-400" />
                      <span>AI Agent Interactions ({lead.conversations.length})</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">Voice / WhatsApp logs</span>
                  </div>
                  <div className="space-y-2">
                    {lead.conversations.slice(0, 3).map((conv: any) => (
                      <div
                        key={conv.id}
                        className="p-3 bg-muted/40 border border-border rounded-lg text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {conv.agent?.name || "AI Agent"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(conv.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {conv.transcript && (
                          <p className="text-muted-foreground text-[11px] line-clamp-2 italic leading-relaxed">
                            "{conv.transcript.split("\n")[0]}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Interactive Activity & Notes Timeline */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block px-1">
                  Activity Log & Counselor Notes
                </span>
                <ActivityTimeline key={timelineKey} entityType="LEAD" entityId={lead.id} canEdit={canEdit} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lost Reason Dialog */}
      <LostReasonDialog
        isOpen={isLostReasonOpen}
        leadName={lead?.name || "Lead"}
        onConfirm={handleLostReasonConfirm}
        onCancel={() => setIsLostReasonOpen(false)}
        isSubmitting={isUpdating}
      />

      {/* Convert Lead to Student Modal */}
      {lead && (
        <ConvertLeadDialog
          lead={lead}
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          onSuccess={(studentId) => {
            setIsConvertModalOpen(false);
            toast.success("Lead converted to student successfully!");
            fetchLeadDetails();
          }}
        />
      )}
    </>
  );
}
