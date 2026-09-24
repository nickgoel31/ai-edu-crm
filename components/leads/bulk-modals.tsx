"use client";

import { useState, useMemo } from "react";
import { UserCheck, Tag as TagIcon, ArrowRightLeft, Trash2, AlertTriangle, Check, Plus, MinusCircle } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagBadge } from "@/components/tags/tag-badge";
import { Tag as TagType, LeadStage, StudentStage } from "@/types";
import { LOST_REASONS, LostReasonType } from "./lost-reason-dialog";

interface Counselor {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const PRESET_TAG_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#64748b", // Slate
];

// ==========================================
// 1. Bulk Reassign Modal (Leads)
// ==========================================
interface BulkReassignModalProps {
  isOpen: boolean;
  selectedCount: number;
  counselors: Counselor[];
  onConfirm: (counselorId: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BulkReassignModal({
  isOpen,
  selectedCount,
  counselors,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: BulkReassignModalProps) {
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(
    counselors[0]?.id || "unassigned"
  );

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      isDismissable={!isSubmitting}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <UserCheck className="w-4 h-4" />
          </div>
          <span>Bulk Reassign Counselor</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Reassign <span className="font-semibold text-foreground">{selectedCount}</span> selected leads to an admissions counselor.
        </p>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Select Counselor
          </Label>
          <Select
            selectedKey={selectedCounselorId}
            onSelectionChange={(key) => setSelectedCounselorId(String(key))}
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

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(selectedCounselorId)} isDisabled={isSubmitting}>
            {isSubmitting ? "Reassigning..." : "Confirm Reassign"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

// ==========================================
// 2. Bulk Stage Change Modal (Leads & Students)
// ==========================================
interface BulkStageChangeModalProps {
  isOpen: boolean;
  entityType: "LEAD" | "STUDENT";
  selectedCount: number;
  onConfirm: (stage: string, lostReason?: string | null) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BulkStageChangeModal({
  isOpen,
  entityType,
  selectedCount,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: BulkStageChangeModalProps) {
  const leadStages = [
    { value: LeadStage.COLD, label: "Cold", desc: "Fresh inbound inquiry" },
    { value: LeadStage.WARM, label: "Warm", desc: "Contact established / qualified" },
    { value: LeadStage.HOT, label: "Hot", desc: "Counseling & high intent" },
    { value: LeadStage.CONVERTING, label: "Converting", desc: "Registration in progress" },
    { value: LeadStage.LOST, label: "Lost", desc: "Disqualified / opted out" },
  ];

  const studentStages = [
    { value: StudentStage.ENQUIRY, label: "Enquiry", desc: "Prospective applicant evaluating programs" },
    { value: StudentStage.ENROLLED, label: "Enrolled", desc: "Offer accepted & document verification" },
    { value: StudentStage.ACTIVE, label: "Active", desc: "Attending classes, labs & workshops" },
    { value: StudentStage.ALUMNI, label: "Alumni", desc: "Graduated with vocational credentials" },
  ];

  const stageOptions = entityType === "LEAD" ? leadStages : studentStages;

  const [selectedStage, setSelectedStage] = useState<string>(
    entityType === "LEAD" ? LeadStage.WARM : StudentStage.ENROLLED
  );
  const [selectedLostReason, setSelectedLostReason] = useState<LostReasonType>("Not Interested");
  const [lostNote, setLostNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entityType === "LEAD" && selectedStage === LeadStage.LOST) {
      const finalLostReason = lostNote.trim()
        ? `${selectedLostReason}: ${lostNote.trim()}`
        : selectedLostReason;
      onConfirm(selectedStage, finalLostReason);
    } else {
      onConfirm(selectedStage, null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      isDismissable={!isSubmitting}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <span>Bulk Change Stage ({entityType === "LEAD" ? "Leads" : "Students"})</span>
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Move <span className="font-semibold text-foreground">{selectedCount}</span> selected {entityType.toLowerCase()}s to a new pipeline stage.
        </p>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Target Stage
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {stageOptions.map((s) => (
              <label
                key={s.value}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedStage === s.value
                    ? s.value === LeadStage.LOST
                      ? "border-destructive/60 bg-destructive/15 text-destructive font-medium shadow-sm ring-1 ring-destructive/30"
                      : "border-blue-500/60 bg-blue-500/15 text-blue-300 font-medium shadow-sm ring-1 ring-blue-500/30"
                    : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="bulkStage"
                  value={s.value}
                  checked={selectedStage === s.value}
                  onChange={() => setSelectedStage(s.value)}
                  className="mt-0.5 rounded-full border-zinc-700 text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-[11px] opacity-80">{s.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* If LEAD and LOST is selected, require Lost Reason */}
        {entityType === "LEAD" && selectedStage === LeadStage.LOST && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Required: Reason for Loss</span>
            </div>
            <RadioGroup
              value={selectedLostReason}
              onChange={(value) => setSelectedLostReason(value as LostReasonType)}
              className="grid grid-cols-2 gap-1.5"
            >
              {LOST_REASONS.map((reason) => (
                <Label
                  key={reason}
                  className={`flex items-center gap-1.5 p-2 rounded border text-[11px] cursor-pointer transition-all ${
                    selectedLostReason === reason
                      ? "border-destructive bg-destructive/20 text-destructive font-semibold"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <RadioGroupItem value={reason} />
                  <span>{reason}</span>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Supplementary Notes (Optional)
              </Label>
              <Textarea
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                placeholder="Applied to all selected leads..."
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={selectedStage === LeadStage.LOST ? "destructive" : "default"}
            isDisabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : `Update ${selectedCount} Records`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ==========================================
// 3. Bulk Tag Manage Modal (Add / Remove)
// ==========================================
interface BulkTagManageModalProps {
  isOpen: boolean;
  entityType: "LEAD" | "STUDENT";
  selectedCount: number;
  availableTags: TagType[];
  onConfirm: (params: {
    action: "add" | "remove";
    tagId?: string;
    tagName?: string;
    tagColor?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BulkTagManageModal({
  isOpen,
  entityType,
  selectedCount,
  availableTags,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: BulkTagManageModalProps) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [selectedTagId, setSelectedTagId] = useState<string>(
    availableTags[0]?.id || "NEW"
  );
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_TAG_COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "remove") {
      if (!selectedTagId || selectedTagId === "NEW") return;
      onConfirm({ action: "remove", tagId: selectedTagId });
    } else {
      if (selectedTagId === "NEW") {
        if (!newTagName.trim()) return;
        onConfirm({
          action: "add",
          tagName: newTagName.trim(),
          tagColor: newTagColor,
        });
      } else {
        onConfirm({ action: "add", tagId: selectedTagId });
      }
    }
  };

  const isNew = mode === "add" && selectedTagId === "NEW";

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      isDismissable={!isSubmitting}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <TagIcon className="w-4 h-4" />
          </div>
          <span>Bulk Tag Operations ({entityType === "LEAD" ? "Leads" : "Students"})</span>
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMode("add")}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === "add"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tag</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("remove");
              if (selectedTagId === "NEW" && availableTags.length > 0) {
                setSelectedTagId(availableTags[0].id);
              }
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === "remove"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Remove Tag</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {mode === "add"
            ? `Attach a tag across all ${selectedCount} selected ${entityType.toLowerCase()}s.`
            : `Detach a specific tag from all ${selectedCount} selected ${entityType.toLowerCase()}s.`}
        </p>

        {/* Existing Tag Dropdown */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {mode === "add" ? "Select Existing Tag or Create New" : "Select Tag to Remove"}
          </Label>
          <Select
            selectedKey={selectedTagId}
            onSelectionChange={(key) => setSelectedTagId(String(key))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mode === "add" && <SelectItem id="NEW">+ Create New Tag On-The-Fly</SelectItem>}
              {availableTags.map((t) => (
                <SelectItem key={t.id} id={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* New Tag Creator Inputs */}
        {isNew && (
          <div className="p-3 bg-muted/20 border border-purple-500/20 rounded-lg space-y-3 animate-in fade-in">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                New Tag Name
              </Label>
              <Input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g. High-Scholarship, 2026-Batch"
                className="text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tag Color
              </Label>
              <div className="flex items-center gap-2">
                {PRESET_TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {newTagColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === "remove" ? "destructive" : "default"}
            isDisabled={
              isSubmitting ||
              (mode === "add" && selectedTagId === "NEW" && !newTagName.trim()) ||
              (mode === "remove" && (!selectedTagId || selectedTagId === "NEW"))
            }
          >
            {isSubmitting
              ? "Applying..."
              : mode === "add"
              ? `Apply Tag to ${selectedCount} Records`
              : `Remove Tag from ${selectedCount} Records`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ==========================================
// 4. Bulk Delete Dialog (ADMIN Only)
// ==========================================
interface BulkDeleteDialogProps {
  isOpen: boolean;
  entityType: "LEAD" | "STUDENT";
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BulkDeleteDialog({
  isOpen,
  entityType,
  selectedCount,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: BulkDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      isDismissable={!isSubmitting}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-destructive/15 text-destructive border border-destructive/25">
            <Trash2 className="w-4 h-4" />
          </div>
          <span>Bulk Delete Confirmation</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <DialogDescription className="space-y-2">
          <p>
            Are you sure you want to soft delete{" "}
            <span className="font-semibold text-foreground">{selectedCount}</span> selected{" "}
            <span className="font-semibold text-destructive">{entityType.toLowerCase()} records</span>?
          </p>
          <p className="text-[11px] text-zinc-400">
            This action flags the records as archived and records an individual compliance{" "}
            <span className="font-mono text-zinc-300">AuditLog</span> entry per affected record.
          </p>
        </DialogDescription>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            isDisabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : `Delete ${selectedCount} ${entityType === "LEAD" ? "Leads" : "Students"}`}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

