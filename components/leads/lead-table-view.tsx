"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LeadStage, LeadSource } from "@/types";
import {
  Download,
  UserCheck,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  AlertCircle,
  ExternalLink,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import { LeadItem } from "./lead-kanban-board";
import { LostReasonDialog } from "./lost-reason-dialog";
import {
  BulkReassignModal,
  BulkStageChangeModal,
  BulkTagManageModal,
  BulkDeleteDialog,
} from "./bulk-modals";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CustomFieldDefinition, Tag as TagType } from "@/types";
import { Columns3, Tag as TagIcon, ArrowRightLeft, Trash2 } from "lucide-react";
import { TagBadge } from "@/components/tags/tag-badge";
import { ScoreBadge } from "@/components/leads/score-badge";
import { SlaBadge } from "@/components/leads/sla-badge";

interface Counselor {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface LeadTableViewProps {
  leads: LeadItem[];
  counselors: Counselor[];
  canEdit: boolean;
  isAdmin?: boolean;
  initialStage?: string;
  customFieldDefinitions?: CustomFieldDefinition[];
  onSelectLead?: (leadId: string) => void;
  onStageChange: (leadId: string, newStage: LeadStage, lostReason?: string | null) => Promise<void>;
  onBulkReassign: (leadIds: string[], counselorId: string) => Promise<void>;
  onBulkStageChange: (leadIds: string[], stage: string, lostReason?: string | null) => Promise<void>;
  onBulkTagAction: (
    leadIds: string[],
    params: { action: "add" | "remove"; tagId?: string; tagName?: string; tagColor?: string }
  ) => Promise<void>;
  onBulkDelete: (leadIds: string[]) => Promise<void>;
}

export function LeadTableView({
  leads,
  counselors,
  canEdit,
  isAdmin = false,
  initialStage = "ALL",
  customFieldDefinitions = [],
  onSelectLead,
  onStageChange,
  onBulkReassign,
  onBulkStageChange,
  onBulkTagAction,
  onBulkDelete,
}: LeadTableViewProps) {

  // Filters
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [selectedCounselor, setSelectedCounselor] = useState<string>("ALL");
  const [selectedStage, setSelectedStage] = useState<string>(initialStage || "ALL");
  const [dateRange, setDateRange] = useState<string>("ALL");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [visibleCustomFieldKeys, setVisibleCustomFieldKeys] = useState<string[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string>>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showTagFilterPicker, setShowTagFilterPicker] = useState(false);

  // Active custom field definitions
  const activeCustomFields = useMemo(() => {
    return customFieldDefinitions.filter((f) => f.isActive);
  }, [customFieldDefinitions]);

  // Unique tags present in leads
  const availableTags = useMemo(() => {
    const map = new Map<string, TagType>();
    leads.forEach((l) => {
      (l.tags || []).forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  // Keep selectedStage synced when initialStage prop changes from URL
  useMemo(() => {
    if (initialStage && initialStage !== selectedStage) {
      setSelectedStage(initialStage);
    }
  }, [initialStage]);

  // Sorting
  const [sortField, setSortField] = useState<"name" | "score" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  // Filtered and Sorted data
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        if (selectedSource !== "ALL" && lead.source !== selectedSource) return false;
        if (selectedStage !== "ALL" && lead.stage !== selectedStage) return false;
        if (selectedCounselor !== "ALL") {
          if (selectedCounselor === "UNASSIGNED" && lead.assignedToUserId !== null) return false;
          if (selectedCounselor !== "UNASSIGNED" && lead.assignedToUserId !== selectedCounselor)
            return false;
        }

        if (dateRange !== "ALL") {
          const leadDate = new Date(lead.createdAt);
          const now = new Date();
          if (dateRange === "TODAY") {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            if (leadDate < startOfDay) return false;
          } else if (dateRange === "7DAYS") {
            const past7 = new Date(now.setDate(now.getDate() - 7));
            if (leadDate < past7) return false;
          } else if (dateRange === "30DAYS") {
            const past30 = new Date(now.setDate(now.getDate() - 30));
            if (leadDate < past30) return false;
          }
        }

        // Multi-select Tag Filter (matches any selected tag)
        if (selectedTagIds.length > 0) {
          const leadTagIds = (lead.tags || []).map((t) => t.id);
          const hasMatch = selectedTagIds.some((id) => leadTagIds.includes(id));
          if (!hasMatch) return false;
        }

        // Custom field filters
        for (const [key, filterVal] of Object.entries(customFieldFilters)) {
          if (!filterVal || filterVal === "ALL") continue;
          const leadVal = lead.customFields?.[key];
          if (leadVal === undefined || leadVal === null || leadVal === "") return false;
          if (typeof leadVal === "boolean") {
            if (filterVal === "true" && !leadVal) return false;
            if (filterVal === "false" && leadVal) return false;
          } else {
            if (String(leadVal).toLowerCase() !== filterVal.toLowerCase()) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === "name") {
          comp = a.name.localeCompare(b.name);
        } else if (sortField === "score") {
          comp = (a.score ?? 0) - (b.score ?? 0);
        } else {
          comp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortOrder === "asc" ? comp : -comp;
      });
  }, [leads, selectedSource, selectedCounselor, selectedStage, dateRange, selectedTagIds, customFieldFilters, sortField, sortOrder]);

  const toggleSort = (field: "name" | "score" | "createdAt") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  const renderSortIndicator = (field: "name" | "score" | "createdAt") => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-400 transition-transform" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 transition-transform" />
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStageSelect = async (leadId: string, targetStage: LeadStage) => {
    if (!canEdit) return;
    if (targetStage === LeadStage.LOST) {
      setPendingLostLeadId(leadId);
    } else {
      try {
        await onStageChange(leadId, targetStage, null);
        toast.success(`Lead moved to ${targetStage}`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to update stage");
      }
    }
  };

  const confirmLostReason = async (reason: string) => {
    if (!pendingLostLeadId) return;
    try {
      setIsOperating(true);
      await onStageChange(pendingLostLeadId, LeadStage.LOST, reason);
      toast.success("Lead marked as lost");
    } catch (err: any) {
      toast.error(err?.message || "Failed to record lost reason");
    } finally {
      setIsOperating(false);
      setPendingLostLeadId(null);
    }
  };

  // Bulk CSV Export
  const handleExportCSV = () => {
    const leadsToExport =
      selectedIds.length > 0
        ? leads.filter((l) => selectedIds.includes(l.id))
        : filteredLeads;

    const headers = [
      "ID",
      "Name",
      "Phone",
      "Email",
      "Source",
      "Tags",
      "Stage",
      "Score",
      "Assigned To",
      ...visibleCustomFieldKeys.map((k) => activeCustomFields.find((f) => f.fieldKey === k)?.label || k),
      "Lost Reason",
      "Created At",
    ];

    const rows = leadsToExport.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.email}"`,
      l.source,
      `"${(l.tags || []).map((t) => t.name).join(", ").replace(/"/g, '""')}"`,
      l.stage,
      l.score ?? "",
      `"${(l.assignedTo?.name || "Unassigned").replace(/"/g, '""')}"`,
      ...visibleCustomFieldKeys.map((k) => `"${String(l.customFields?.[k] ?? "").replace(/"/g, '""')}"`),
      `"${(l.lostReason || "").replace(/"/g, '""')}"`,
      new Date(l.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const getSourceIconColor = (source: LeadSource) => {
    switch (source) {
      case "META_ADS":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25";
      case "WHATSAPP":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25";
      case "GOOGLE_SHEETS":
      case "GOOGLE_ADS":
        return "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25";
      case "WEBSITE_FORM":
        return "bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25";
      case "CALL_TRACKING":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25";
      case "CSV_IMPORT":
      case "REFERRAL":
      case "MANUAL":
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  const pendingLostLead = pendingLostLeadId
    ? leads.find((l) => l.id === pendingLostLeadId)
    : null;

  return (
    <div className="space-y-4">
      {/* Top Header Row matching screenshot toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Left: View title + item count */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">All Leads</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground font-normal">{filteredLeads.length}</span>
          </div>
        </div>

        {/* Right Toolbar Actions matching screenshot */}
        <div className="flex items-center gap-2">
          {/* Stage Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="ALL">All Stages</option>
              {Object.values(LeadStage).map((stg) => (
                <option key={stg} value={stg}>
                  {stg.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="ALL">Filter Source</option>
              {Object.values(LeadSource).map((src) => (
                <option key={src} value={src}>
                  {src.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Counselor select */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
            <select
              value={selectedCounselor}
              onChange={(e) => setSelectedCounselor(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          </div>

          {/* Tags Multi-select Filter Dropdown */}
          {availableTags.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagFilterPicker(!showTagFilterPicker)}
                className="gap-1.5"
              >
                <TagIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Tags</span>
                {selectedTagIds.length > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-purple-500/20 text-purple-300">
                    {selectedTagIds.length}
                  </Badge>
                )}
              </Button>

              {showTagFilterPicker && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">Filter by Tags</span>
                    {selectedTagIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTagIds([])}
                        className="text-[10px] text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 crm-scrollbar">
                    {availableTags.map((tag) => {
                      const isChecked = selectedTagIds.includes(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTagIds([...selectedTagIds, tag.id]);
                              } else {
                                setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                              }
                            }}
                            className="rounded border-border bg-background text-blue-600 focus:ring-0"
                          />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="truncate">{tag.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Fields Filter (if any active select/boolean fields) */}
          {activeCustomFields.filter((f) => f.fieldType === "SELECT" || f.fieldType === "BOOLEAN").map((field) => {
            const options: string[] = Array.isArray(field.options)
              ? field.options
              : typeof field.options === "string"
              ? JSON.parse(field.options)
              : [];
            return (
              <div key={field.id} className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
                <select
                  value={customFieldFilters[field.fieldKey] || "ALL"}
                  onChange={(e) =>
                    setCustomFieldFilters((prev) => ({
                      ...prev,
                      [field.fieldKey]: e.target.value,
                    }))
                  }
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer [&>option]:bg-card [&>option]:text-foreground max-w-[130px]"
                >
                  <option value="ALL">
                    {field.label}
                  </option>
                  {field.fieldType === "BOOLEAN" ? (
                    <>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </>
                  ) : (
                    options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))
                  )}
                </select>
              </div>
            );
          })}

          {/* Columns Toggle Dropdown */}
          {activeCustomFields.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="gap-1.5"
              >
                <Columns3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Columns</span>
                {visibleCustomFieldKeys.length > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-300">
                    +{visibleCustomFieldKeys.length}
                  </Badge>
                )}
              </Button>

              {showColumnPicker && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">Custom Columns</span>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCustomFieldKeys(
                          visibleCustomFieldKeys.length === activeCustomFields.length
                            ? []
                            : activeCustomFields.map((f) => f.fieldKey)
                        )
                      }
                      className="text-[10px] text-blue-500 hover:text-blue-600 dark:hover:text-blue-300"
                    >
                      {visibleCustomFieldKeys.length === activeCustomFields.length ? "Clear All" : "Select All"}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {activeCustomFields.map((field) => {
                      const isChecked = visibleCustomFieldKeys.includes(field.fieldKey);
                      return (
                        <label
                          key={field.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setVisibleCustomFieldKeys([...visibleCustomFieldKeys, field.fieldKey]);
                              } else {
                                setVisibleCustomFieldKeys(
                                  visibleCustomFieldKeys.filter((k) => k !== field.fieldKey)
                                );
                              }
                            }}
                            className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                          />
                          <span className="truncate">{field.label}</span>
                          <span className="ml-auto text-[10px] text-zinc-500 font-mono">
                            {field.fieldType.toLowerCase()}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sort button */}
          <Button
            variant="outline"
            onClick={() => {
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            }}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>Sort</span>
          </Button>

          {/* Export CSV button */}
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-3 h-3" />
            <span>Export</span>
          </Button>

          {/* Primary Action Button (+ New Lead) */}
          <Link
            href="/leads"
            onClick={() => {
              const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
              if (input) input.focus();
            }}
            className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
          >
            + New Lead
          </Link>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && canEdit && (
        <div className="bg-muted/40 border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-panel animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs text-zinc-400">leads ready for batch operations</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setIsStageModalOpen(true)}>
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Change Stage</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={() => setIsTagModalOpen(true)}>
              <TagIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Manage Tags</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={() => setIsReassignOpen(true)}>
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Bulk Reassign</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" />
              <span>Export Selected</span>
            </Button>

            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table Container - matching clean dark grid with sticky header and zebra striping */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="max-h-[700px] overflow-y-auto crm-scrollbar">
          <Table aria-label="Leads">
            <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur-md">
              <TableRow>
                <TableHead className="w-9">
                  <Checkbox
                    isSelected={selectedIds.length === filteredLeads.length && filteredLeads.length > 0}
                    isIndeterminate={selectedIds.length > 0 && selectedIds.length < filteredLeads.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("name")}
                  className="cursor-pointer hover:text-foreground transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {renderSortIndicator("name")}
                  </div>
                </TableHead>
                <TableHead>Emails</TableHead>
                <TableHead>Counselor</TableHead>
                <TableHead>Source / Channel</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Phone</TableHead>

                {/* Visible Custom Field Columns */}
                {visibleCustomFieldKeys.map((key) => {
                  const def = activeCustomFields.find((f) => f.fieldKey === key);
                  return (
                    <TableHead key={key} className="whitespace-nowrap">
                      {def?.label || key}
                    </TableHead>
                  );
                })}

                <TableHead
                  onClick={() => toggleSort("score")}
                  className="cursor-pointer hover:text-foreground text-right transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Score</span>
                    {renderSortIndicator("score")}
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("createdAt")}
                  className="cursor-pointer hover:text-foreground text-right transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Date Added</span>
                    {renderSortIndicator("createdAt")}
                  </div>
                </TableHead>
                <TableHead className="text-center">SLA Response</TableHead>
                <TableHead className="text-center">Stage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12 + visibleCustomFieldKeys.length} className="py-14 text-center text-muted-foreground">
                    No leads matching the specified filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedIds.includes(lead.id);
                  const initial = lead.name ? lead.name[0].toUpperCase() : "L";

                  return (
                    <TableRow
                      key={lead.id}
                      className={isSelected ? "bg-muted/60" : ""}
                    >
                      {/* Checkbox */}
                      <TableCell>
                        <Checkbox
                          isSelected={isSelected}
                          onChange={() => toggleSelectRow(lead.id)}
                          aria-label={`Select ${lead.name}`}
                        />
                      </TableCell>

                      {/* Name with entity avatar badge */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectLead) onSelectLead(lead.id);
                          }}
                          className="flex items-center gap-2 group text-left cursor-pointer"
                        >
                          <div className="w-5 h-5 rounded-[4px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {initial}
                          </div>
                          <span className="font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[150px]">
                            {lead.name}
                          </span>
                        </button>
                      </TableCell>

                      {/* Emails */}
                      <TableCell>
                        {lead.email ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-foreground font-mono truncate max-w-[160px]">
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      {/* Created by / Counselor */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-foreground">
                          <span className="text-[11px]">
                            {lead.assignedTo?.name || "Unassigned"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Company / Source badge */}
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-foreground">
                          <span className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[8px] font-bold ${getSourceIconColor(lead.source)}`}>
                            {lead.source[0]}
                          </span>
                          <span>{lead.source.replace(/_/g, " ")}</span>
                        </span>
                      </TableCell>

                      {/* Tags */}
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
                          {(lead.tags || []).length > 0 ? (
                            (lead.tags || []).map((t) => (
                              <TagBadge key={t.id} name={t.name} color={t.color} size="sm" />
                            ))
                          ) : (
                            <span className="text-muted-foreground/60 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Phones */}
                      <TableCell>
                        {lead.phone ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-foreground font-mono">
                            {lead.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      {/* Visible Custom Field Values */}
                      {visibleCustomFieldKeys.map((key) => {
                        const def = activeCustomFields.find((f) => f.fieldKey === key);
                        const val = lead.customFields?.[key];
                        if (val === undefined || val === null || val === "") {
                          return (
                            <TableCell key={key} className="text-muted-foreground/60 text-xs">
                              —
                            </TableCell>
                          );
                        }

                        if (def?.fieldType === "BOOLEAN") {
                          return (
                            <TableCell key={key}>
                              <Badge
                                variant="outline"
                                className={
                                  val === true || val === "true"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                                    : "bg-muted text-muted-foreground border-border text-[10px]"
                                }
                              >
                                {val === true || val === "true" ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                          );
                        }

                        if (def?.fieldType === "SELECT") {
                          return (
                            <TableCell key={key}>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-foreground">
                                {String(val)}
                              </span>
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell key={key} className="text-xs text-foreground font-mono">
                            {String(val)}
                          </TableCell>
                        );
                      })}

                      {/* Lead Score - Numbers Right Aligned */}
                      <TableCell className="text-right">
                        {lead.score !== null ? (
                          <ScoreBadge
                            score={lead.score}
                            scoreBreakdown={(lead as any).scoreBreakdown}
                            size="xs"
                          />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      {/* Creation date - Numbers / Dates Right Aligned */}
                      <TableCell className="text-[11px] text-muted-foreground text-right font-mono">
                        {new Date(lead.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>

                      {/* SLA Response Countdown / Overdue */}
                      <TableCell className="text-center">
                        <SlaBadge
                          createdAt={lead.createdAt}
                          slaDueBy={lead.slaDueBy}
                          firstContactAt={lead.firstContactAt}
                          slaBreached={lead.slaBreached}
                          size="xs"
                        />
                        {lead.firstContactAt && (
                          <span className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-1">
                            <span>Responded</span>
                          </span>
                        )}
                      </TableCell>

                      {/* Stage dropdown / badge */}
                      <TableCell className="text-center">
                        {canEdit ? (
                          <select
                            value={lead.stage}
                            onChange={(e) =>
                              handleStageSelect(lead.id, e.target.value as LeadStage)
                            }
                            className={cn(
                              "text-[11px] font-semibold px-2.5 py-1 rounded-md border focus:outline-none cursor-pointer transition-colors shadow-sm [&>option]:bg-card [&>option]:text-foreground",
                              lead.stage === "HOT" && "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25",
                              lead.stage === "WARM" && "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25",
                              lead.stage === "COLD" && "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25",
                              lead.stage === "CONVERTING" && "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/25",
                              lead.stage === "LOST" && "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            )}
                          >
                            <option value="COLD">Cold</option>
                            <option value="WARM">Warm</option>
                            <option value="HOT">Hot</option>
                            <option value="CONVERTING">Converting</option>
                            <option value="LOST">Lost</option>
                          </select>
                        ) : (
                          <Badge variant={getStageBadgeVariant(lead.stage)}>{lead.stage}</Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                          <DropdownMenu placement="bottom end">
                            <DropdownMenuItem
                              onAction={() => {
                                if (onSelectLead) onSelectLead(lead.id);
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open Lead Drawer</span>
                            </DropdownMenuItem>
                            {canEdit && lead.stage !== "LOST" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onAction={() => setPendingLostLeadId(lead.id)}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Mark as Lost</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenu>
                        </DropdownMenuTrigger>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Bottom Summary Row matching the reference screenshot */}
        <div className="bg-muted/30 border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-6">
            <span className="font-medium text-foreground cursor-pointer hover:underline transition-colors">
              Calculate
            </span>
            <span>
              Unique of Emails: <strong className="text-foreground font-semibold">{new Set(filteredLeads.map((l) => l.email).filter(Boolean)).size}</strong>
            </span>
            <span>
              Phones Recorded: <strong className="text-foreground font-semibold">{filteredLeads.filter((l) => l.phone).length}</strong>
            </span>
          </div>
          <div>
            <span>Total: <strong className="text-foreground font-semibold">{filteredLeads.length}</strong> records</span>
          </div>
        </div>
      </div>

      {/* Lost Reason Dialog */}
      <LostReasonDialog
        isOpen={!!pendingLostLeadId}
        leadName={pendingLostLead?.name || "Lead"}
        onConfirm={confirmLostReason}
        onCancel={() => setPendingLostLeadId(null)}
        isSubmitting={isOperating}
      />

      {/* Bulk Reassign Modal */}
      <BulkReassignModal
        isOpen={isReassignOpen}
        selectedCount={selectedIds.length}
        counselors={counselors}
        onConfirm={async (counselorId) => {
          setIsOperating(true);
          try {
            await onBulkReassign(selectedIds, counselorId);
            setIsReassignOpen(false);
            setSelectedIds([]);
          } finally {
            setIsOperating(false);
          }
        }}
        onCancel={() => setIsReassignOpen(false)}
        isSubmitting={isOperating}
      />

      {/* Bulk Stage Change Modal */}
      <BulkStageChangeModal
        isOpen={isStageModalOpen}
        entityType="LEAD"
        selectedCount={selectedIds.length}
        onConfirm={async (stage, lostReason) => {
          setIsOperating(true);
          try {
            await onBulkStageChange(selectedIds, stage, lostReason);
            setIsStageModalOpen(false);
            setSelectedIds([]);
          } finally {
            setIsOperating(false);
          }
        }}
        onCancel={() => setIsStageModalOpen(false)}
        isSubmitting={isOperating}
      />

      {/* Bulk Tag Manage Modal */}
      <BulkTagManageModal
        isOpen={isTagModalOpen}
        entityType="LEAD"
        selectedCount={selectedIds.length}
        availableTags={availableTags}
        onConfirm={async (params) => {
          setIsOperating(true);
          try {
            await onBulkTagAction(selectedIds, params);
            setIsTagModalOpen(false);
            setSelectedIds([]);
          } finally {
            setIsOperating(false);
          }
        }}
        onCancel={() => setIsTagModalOpen(false)}
        isSubmitting={isOperating}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        isOpen={isDeleteModalOpen}
        entityType="LEAD"
        selectedCount={selectedIds.length}
        onConfirm={async () => {
          setIsOperating(true);
          try {
            await onBulkDelete(selectedIds);
            setIsDeleteModalOpen(false);
            setSelectedIds([]);
          } finally {
            setIsOperating(false);
          }
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
        isSubmitting={isOperating}
      />
    </div>
  );
}
