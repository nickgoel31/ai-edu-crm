"use client";

import { useState } from "react";
import { LeadStage, LeadSource, Tag, PipelineTemplate, PipelineStage } from "@/types";
import {
  Plus,
  MoreVertical,
  MoreHorizontal,
  Phone,
  Mail,
  User,
  ExternalLink,
  GraduationCap,
  Layers,
} from "lucide-react";
import { LostReasonDialog } from "./lost-reason-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/leads/score-badge";
import { SlaBadge } from "@/components/leads/sla-badge";

export interface LeadItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  stage: LeadStage;
  program?: string | null;
  pipelineStageId?: string | null;
  pipelineStage?: PipelineStage | null;
  lostReason: string | null;
  assignedToUserId: string | null;
  score: number | null;
  scoreBreakdown?: string | null;
  slaDueBy?: string | Date | null;
  firstContactAt?: string | Date | null;
  slaBreached?: boolean;
  createdAt: string | Date;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  customFields?: Record<string, any>;
  tags?: Tag[];
}

interface LeadKanbanBoardProps {
  leads: LeadItem[];
  pipelineTemplates?: PipelineTemplate[];
  activeTemplateId?: string | null;
  onSelectTemplate?: (templateId: string) => void;
  canEdit: boolean;
  onSelectLead?: (leadId: string) => void;
  onStageChange: (leadId: string, targetStageIdOrStage: string, lostReason?: string | null) => Promise<void>;
  onAddLead?: (stageIdOrStage: string) => void;
}

interface DynamicColumn {
  id: string;
  stageKey: string;
  title: string;
  color: string;
  requiresReasonOnExit: boolean;
  mapsToBucket: string;
}

function formatLeadDate(dateInput: string | Date | undefined) {
  if (!dateInput) return "May 18";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "May 18";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "May 18";
  }
}

function getPriorityInfo(lead: LeadItem): { label: "High" | "Medium" | "Low"; badgeClass: string } {
  if (lead.stage === LeadStage.HOT || (lead.score !== null && lead.score >= 75)) {
    return {
      label: "High",
      badgeClass: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    };
  }
  if (lead.stage === LeadStage.WARM || (lead.score !== null && lead.score >= 40)) {
    return {
      label: "Medium",
      badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    };
  }
  return {
    label: "Low",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  };
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function LeadKanbanBoard({
  leads,
  pipelineTemplates = [],
  activeTemplateId,
  onSelectTemplate,
  canEdit,
  onSelectLead,
  onStageChange,
  onAddLead,
}: LeadKanbanBoardProps) {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [pendingReasonLead, setPendingReasonLead] = useState<{
    lead: LeadItem;
    targetStageId: string;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Active template resolution
  const activeTemplate =
    pipelineTemplates.find((t) => t.id === activeTemplateId) ||
    pipelineTemplates.find((t) => t.isDefault) ||
    pipelineTemplates[0];

  // Resolve dynamic columns from template stages or canonical fallback
  const columns: DynamicColumn[] =
    activeTemplate?.stages && activeTemplate.stages.length > 0
      ? activeTemplate.stages.map((s) => ({
          id: s.id,
          stageKey: s.id,
          title: s.name,
          color: s.color || "#3b82f6",
          requiresReasonOnExit: s.requiresReasonOnExit,
          mapsToBucket: s.mapsToBucket,
        }))
      : [
          { id: "COLD", stageKey: "COLD", title: "New / Inquiries", color: "#3b82f6", requiresReasonOnExit: false, mapsToBucket: "COLD" },
          { id: "WARM", stageKey: "WARM", title: "In Progress", color: "#f59e0b", requiresReasonOnExit: false, mapsToBucket: "WARM" },
          { id: "HOT", stageKey: "HOT", title: "Priority Review", color: "#f97316", requiresReasonOnExit: false, mapsToBucket: "HOT" },
          { id: "CONVERTING", stageKey: "CONVERTING", title: "Converting", color: "#8b5cf6", requiresReasonOnExit: false, mapsToBucket: "CONVERTING" },
          { id: "LOST", stageKey: "LOST", title: "Done / Closed", color: "#ef4444", requiresReasonOnExit: true, mapsToBucket: "LOST" },
        ];

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    if (!canEdit) return;
    setDraggedLeadId(leadId);
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== colId) {
      setDragOverColumnId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetCol: DynamicColumn) => {
    if (!canEdit) return;
    e.preventDefault();
    setDragOverColumnId(null);

    const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      setDraggedLeadId(null);
      return;
    }

    // Check if already in this stage
    if (lead.pipelineStageId === targetCol.id || lead.stage === targetCol.mapsToBucket) {
      setDraggedLeadId(null);
      return;
    }

    if (targetCol.requiresReasonOnExit || targetCol.mapsToBucket === "LOST") {
      setPendingReasonLead({
        lead,
        targetStageId: targetCol.id,
      });
      return;
    }

    try {
      setIsUpdating(true);
      await onStageChange(leadId, targetCol.id, null);
    } finally {
      setIsUpdating(false);
      setDraggedLeadId(null);
    }
  };

  const confirmExitReason = async (reason: string) => {
    if (!pendingReasonLead) return;
    try {
      setIsUpdating(true);
      await onStageChange(pendingReasonLead.lead.id, pendingReasonLead.targetStageId, reason);
    } finally {
      setIsUpdating(false);
      setPendingReasonLead(null);
      setDraggedLeadId(null);
    }
  };

  const getSourceDescription = (lead: LeadItem) => {
    const sourceLabel = lead.source.replace(/_/g, " ").toLowerCase();
    const sourceCapitalized = sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1);
    
    if (lead.program) {
      return `${lead.program} • ${sourceCapitalized} inquiry`;
    }
    if (lead.email && lead.phone) {
      return `${sourceCapitalized} inquiry • ${lead.phone} • ${lead.email}`;
    }
    return `Inquiry recorded via ${sourceCapitalized} channel for admissions review.`;
  };

  return (
    <>
      {/* Program Pipeline Template Switcher Tabs */}
      {pipelineTemplates.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0 pr-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            Pipeline:
          </span>
          {pipelineTemplates.map((tpl) => {
            const isSelected = tpl.id === activeTemplate?.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelectTemplate && onSelectTemplate(tpl.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/50"
                    : "bg-muted/60 text-muted-foreground border border-border hover:bg-muted hover:text-foreground dark:bg-[#202020] dark:text-zinc-400 dark:border-[#2e2e2e] dark:hover:bg-[#282828] dark:hover:text-zinc-200"
                }`}
              >
                {tpl.program && <GraduationCap className="w-3 h-3" />}
                <span>{tpl.name}</span>
                {tpl.isDefault && (
                  <span className="text-[10px] opacity-75 ml-0.5 font-mono">(Default)</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Dynamic Columns Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto pb-6 items-start">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => {
            if (l.pipelineStageId) {
              return l.pipelineStageId === col.id;
            }
            return l.stage === col.mapsToBucket;
          });
          const isOver = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
              className={`flex flex-col bg-muted/30 dark:bg-[#171717] rounded-2xl border border-border dark:border-[#262626] p-3 min-h-[620px] transition-all duration-200 ${
                isOver ? "border-indigo-500/80 bg-indigo-50/50 dark:bg-zinc-800/40 ring-1 ring-indigo-500/30" : ""
              }`}
            >
              {/* Column Header: Dot + Title on Left, Three Dots on Right */}
              <div className="flex items-center justify-between px-1 py-1.5 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="text-sm font-semibold text-foreground dark:text-neutral-100 truncate font-heading tracking-tight" title={col.title}>
                    {col.title}
                  </h3>
                  <span className="text-xs text-muted-foreground dark:text-neutral-400 font-mono">
                    {colLeads.length}
                  </span>
                </div>

                <button
                  type="button"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-[#262626] transition-colors"
                  title="Column options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Full-width Add Button Slot (+) */}
              <button
                type="button"
                onClick={() => {
                  if (onAddLead) onAddLead(col.id);
                }}
                className="h-10 w-full rounded-xl border border-border dark:border-[#2e2e2e] bg-card dark:bg-[#202020] hover:bg-muted dark:hover:bg-[#282828] hover:border-border dark:hover:border-[#383838] flex items-center justify-center text-muted-foreground hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200 transition-all duration-150 mb-3 shadow-xs cursor-pointer group"
                title={`Add lead to ${col.title}`}
              >
                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground dark:text-neutral-400 dark:group-hover:text-white transition-transform group-hover:scale-110" />
              </button>

              {/* Column Body / Drop Zone & Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[720px] crm-scrollbar">
                {colLeads.length === 0 ? (
                  <div
                    className={`h-36 flex flex-col items-center justify-center border border-dashed rounded-xl transition-all text-center p-3 ${
                      isOver
                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-[#262626]/40 text-foreground dark:text-neutral-200"
                        : "border-border dark:border-[#2e2e2e] bg-card/30 dark:bg-[#1a1a1a]/30 text-muted-foreground dark:text-neutral-500"
                    }`}
                  >
                    <p className="text-xs font-medium">
                      {isOver ? "Drop lead here" : `No leads in ${col.title}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 dark:text-neutral-500 mt-0.5">
                      Drag cards across stages
                    </p>
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const isBeingDragged = draggedLeadId === lead.id;
                    const priority = getPriorityInfo(lead);
                    const assigneeName = lead.assignedTo?.name || "Unassigned";
                    const assigneeInitials = getInitials(lead.assignedTo?.name);
                    const formattedDate = formatLeadDate(lead.createdAt);

                    return (
                      <div
                        key={lead.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => {
                          if (onSelectLead) onSelectLead(lead.id);
                        }}
                        className={`group relative bg-card dark:bg-[#202020] p-4 rounded-xl border border-border dark:border-[#2e2e2e] hover:border-border/80 dark:hover:border-[#3d3d3d] hover:bg-muted/40 dark:hover:bg-[#262626] transition-all duration-200 cursor-pointer shadow-xs ${
                          isBeingDragged
                            ? "opacity-30 scale-[0.98] rotate-1 bg-muted dark:bg-[#262626] border-border dark:border-[#3d3d3d]"
                            : "hover:-translate-y-0.5 hover:shadow-md"
                        }`}
                      >
                        {/* 1. Top row: Date + SLA Countdown (Left) + Score Badge (Right) */}
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="text-[11px] font-medium text-muted-foreground dark:text-neutral-400 shrink-0">
                              {formattedDate}
                            </span>
                            <SlaBadge
                              createdAt={lead.createdAt}
                              slaDueBy={lead.slaDueBy}
                              firstContactAt={lead.firstContactAt}
                              slaBreached={lead.slaBreached}
                              size="xs"
                            />
                          </div>
                          <ScoreBadge
                            score={lead.score ?? 50}
                            scoreBreakdown={lead.scoreBreakdown}
                            size="xs"
                          />
                        </div>

                        {/* 2. Main Title */}
                        <h4 className="text-sm font-semibold text-foreground dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug truncate">
                          {lead.name}
                        </h4>

                        {/* 3. Description / Subtext */}
                        <p className="text-xs text-muted-foreground dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {getSourceDescription(lead)}
                        </p>

                        {/* 4. Bottom row: Assignee Avatar + Name (Left), Priority Badge (Right) */}
                        <div className="flex items-center justify-between mt-4 pt-1">
                          {/* Assignee info */}
                          <div
                            className="flex items-center gap-2 min-w-0"
                            title={assigneeName}
                          >
                            <Avatar size="sm" className="w-6 h-6 border border-border dark:border-zinc-700/80 bg-muted dark:bg-zinc-800 shrink-0">
                              <AvatarFallback className="bg-muted dark:bg-zinc-800 text-muted-foreground dark:text-zinc-300 text-[10px] font-semibold">
                                {assigneeInitials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-muted-foreground dark:text-zinc-300 truncate max-w-[110px]">
                              {assigneeName}
                            </span>
                          </div>

                          {/* Priority Pill Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${priority.badgeClass}`}
                          >
                            {priority.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost / Exit Reason Dialog */}
      <LostReasonDialog
        isOpen={!!pendingReasonLead}
        leadName={pendingReasonLead?.lead?.name || "Lead"}
        onConfirm={confirmExitReason}
        onCancel={() => {
          setPendingReasonLead(null);
          setDraggedLeadId(null);
        }}
        isSubmitting={isUpdating}
      />
    </>
  );
}
