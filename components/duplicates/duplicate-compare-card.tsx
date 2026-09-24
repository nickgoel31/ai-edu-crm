"use client";

import React, { useState } from "react";
import {
  GitMerge,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Loader2,
  FileText,
  CreditCard,
  MessageSquare,
  Activity as ActivityIcon,
} from "lucide-react";
import { HydratedDuplicateMatch, DuplicateMatchStatus, CustomFieldDefinition } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagBadge } from "@/components/tags/tag-badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface DuplicateCompareCardProps {
  match: HydratedDuplicateMatch;
  onResolved: () => void;
}

export function DuplicateCompareCard({ match, onResolved }: DuplicateCompareCardProps) {
  const {
    id: matchId,
    entityType,
    status,
    matchedOn,
    createdAt,
    primaryEntity,
    duplicateEntity,
    primaryCustomFields = {},
    duplicateCustomFields = {},
    primaryTags = [],
    duplicateTags = [],
    customFieldDefinitions = [],
  } = match;

  const isLead = entityType === "LEAD";
  const isPending = status === DuplicateMatchStatus.PENDING;

  // Track winning selections: fieldKey -> "PRIMARY" | "DUPLICATE"
  const getInitialFieldChoices = () => {
    const choices: Record<string, "PRIMARY" | "DUPLICATE"> = {};
    const standardKeys = isLead
      ? ["name", "phone", "email", "stage", "source", "score"]
      : ["name", "phone", "email", "stage", "program", "cohort", "branch"];

    standardKeys.forEach((key) => {
      const primaryVal = primaryEntity?.[key];
      const dupVal = duplicateEntity?.[key];
      // Default to non-empty or newer/better if primary is missing
      if (!primaryVal && dupVal) {
        choices[key] = "DUPLICATE";
      } else {
        choices[key] = "PRIMARY";
      }
    });

    // Custom fields
    customFieldDefinitions.forEach((def) => {
      const pVal = primaryCustomFields[def.fieldKey];
      const dVal = duplicateCustomFields[def.fieldKey];
      if ((pVal === undefined || pVal === null || pVal === "") && (dVal !== undefined && dVal !== null && dVal !== "")) {
        choices[`cf_${def.fieldKey}`] = "DUPLICATE";
      } else {
        choices[`cf_${def.fieldKey}`] = "PRIMARY";
      }
    });

    return choices;
  };

  const [fieldChoices, setFieldChoices] = useState<Record<string, "PRIMARY" | "DUPLICATE">>(
    getInitialFieldChoices()
  );

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!primaryEntity || !duplicateEntity) {
    return (
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-zinc-500">
        One or both records are no longer available in the database.
      </div>
    );
  }

  // Quick Action: Choose all from Primary / Duplicate
  const handleSelectAll = (winner: "PRIMARY" | "DUPLICATE") => {
    const updated: Record<string, "PRIMARY" | "DUPLICATE"> = {};
    Object.keys(fieldChoices).forEach((key) => {
      updated[key] = winner;
    });
    setFieldChoices(updated);
  };

  // Toggle single field
  const toggleFieldChoice = (key: string, winner: "PRIMARY" | "DUPLICATE") => {
    setFieldChoices((prev) => ({
      ...prev,
      [key]: winner,
    }));
  };

  // Execute Merge
  const handleConfirmMerge = async () => {
    setIsSubmitting(true);
    try {
      // Build winning fields payload
      const standardKeys = isLead
        ? ["name", "phone", "email", "stage", "source", "score"]
        : ["name", "phone", "email", "stage", "program", "cohort", "branch"];

      const winningFields: Record<string, any> = {};
      standardKeys.forEach((key) => {
        const winner = fieldChoices[key] || "PRIMARY";
        winningFields[key] =
          winner === "PRIMARY" ? primaryEntity[key] : duplicateEntity[key];
      });

      // Build winning custom fields payload
      const winningCustomFields: Record<string, any> = {};
      customFieldDefinitions.forEach((def) => {
        const winner = fieldChoices[`cf_${def.fieldKey}`] || "PRIMARY";
        const val =
          winner === "PRIMARY"
            ? primaryCustomFields[def.fieldKey]
            : duplicateCustomFields[def.fieldKey];
        if (val !== undefined) {
          winningCustomFields[def.fieldKey] = val;
        }
      });

      const res = await fetch(`/api/duplicates/${matchId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winningFields,
          winningCustomFields,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to merge duplicate records.");
      }

      toast.success(data.message || "Records merged successfully.");
      setIsMergeModalOpen(false);
      onResolved();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge records.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Dismiss
  const handleConfirmDismiss = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/duplicates/${matchId}/dismiss`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dismiss match.");
      }

      toast.success("Duplicate match dismissed as false-positive.");
      setIsDismissModalOpen(false);
      onResolved();
    } catch (err: any) {
      toast.error(err.message || "Failed to dismiss duplicate match.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard fields configuration
  const standardFields = isLead
    ? [
        { key: "name", label: "Full Name", icon: User },
        { key: "phone", label: "Phone Number", icon: Phone },
        { key: "email", label: "Email Address", icon: Mail },
        { key: "stage", label: "Lead Stage", icon: Layers },
        { key: "source", label: "Lead Source", icon: Sparkles },
        { key: "score", label: "Lead Score", icon: ShieldCheck },
      ]
    : [
        { key: "name", label: "Full Name", icon: User },
        { key: "phone", label: "Phone Number", icon: Phone },
        { key: "email", label: "Email Address", icon: Mail },
        { key: "stage", label: "Student Stage", icon: Layers },
        { key: "program", label: "Program", icon: FileText },
        { key: "cohort", label: "Cohort", icon: Calendar },
        { key: "branch", label: "Campus / Branch", icon: Layers },
      ];

  // Count conflict differences
  let conflictCount = 0;
  standardFields.forEach(({ key }) => {
    const p = String(primaryEntity[key] ?? "").trim();
    const d = String(duplicateEntity[key] ?? "").trim();
    if (p !== d) conflictCount++;
  });
  customFieldDefinitions.forEach((def) => {
    const p = String(primaryCustomFields[def.fieldKey] ?? "").trim();
    const d = String(duplicateCustomFields[def.fieldKey] ?? "").trim();
    if (p !== d) conflictCount++;
  });

  return (
    <div className="bg-[#171717] border border-[#262626] rounded-xl shadow-lg overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="px-5 py-4 bg-[#1e1e1e]/60 border-b border-[#262626] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-white">
                Potential Duplicate {isLead ? "Lead" : "Student"}
              </span>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                Matched on {matchedOn.toUpperCase()}
              </Badge>
              {conflictCount > 0 ? (
                <Badge variant="outline" className="text-[10px] text-zinc-300 border-zinc-700 bg-zinc-800">
                  {conflictCount} field conflict{conflictCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Values identical
                </Badge>
              )}
              {status !== DuplicateMatchStatus.PENDING && (
                <Badge
                  variant="outline"
                  className={
                    status === DuplicateMatchStatus.MERGED
                      ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                      : "text-zinc-400 border-zinc-700 bg-zinc-800"
                  }
                >
                  {status}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Detected on {new Date(createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Quick select buttons */}
        {isPending && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll("PRIMARY")}
              className="text-[11px] h-7 px-2.5 bg-[#222222] border-[#333333] hover:bg-[#2a2a2a] text-zinc-300"
            >
              Use All Primary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll("DUPLICATE")}
              className="text-[11px] h-7 px-2.5 bg-[#222222] border-[#333333] hover:bg-[#2a2a2a] text-zinc-300"
            >
              Use All Duplicate
            </Button>
          </div>
        )}
      </div>

      {/* Comparison Grid */}
      <div className="p-5 space-y-4">
        {/* Columns Header */}
        <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-zinc-400 pb-2 border-b border-[#262626]">
          <div className="col-span-3">Field</div>
          <div className="col-span-4 flex items-center justify-between text-indigo-400">
            <span>Primary (Existing)</span>
            <span className="text-[10px] font-mono text-zinc-500">
              Created {new Date(primaryEntity.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="col-span-1 text-center text-zinc-600">vs</div>
          <div className="col-span-4 flex items-center justify-between text-amber-400">
            <span>Duplicate (New Entry)</span>
            <span className="text-[10px] font-mono text-zinc-500">
              Created {new Date(duplicateEntity.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {/* Standard Fields Rows */}
        <div className="space-y-2">
          {standardFields.map(({ key, label, icon: Icon }) => {
            const pVal = primaryEntity[key];
            const dVal = duplicateEntity[key];
            const isConflict = String(pVal ?? "").trim() !== String(dVal ?? "").trim();
            const chosen = fieldChoices[key] || "PRIMARY";

            return (
              <div
                key={key}
                className={`grid grid-cols-12 gap-3 items-center p-2.5 rounded-lg text-xs transition-colors ${
                  isConflict
                    ? "bg-amber-500/5 border border-amber-500/20"
                    : "bg-[#1b1b1b]/50 border border-transparent"
                }`}
              >
                {/* Field Label */}
                <div className="col-span-3 flex items-center gap-2 text-zinc-300 font-medium truncate">
                  <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{label}</span>
                </div>

                {/* Primary Option */}
                <div className="col-span-4">
                  <button
                    type="button"
                    disabled={!isPending}
                    onClick={() => toggleFieldChoice(key, "PRIMARY")}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      chosen === "PRIMARY"
                        ? "bg-indigo-600/20 border border-indigo-500/50 text-white font-medium"
                        : "bg-[#141414] border border-[#2a2a2a] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">{pVal !== null && pVal !== undefined && pVal !== "" ? String(pVal) : <em className="text-zinc-600">None</em>}</span>
                    {chosen === "PRIMARY" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                  </button>
                </div>

                {/* Arrow indicator */}
                <div className="col-span-1 text-center text-zinc-600">
                  <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                </div>

                {/* Duplicate Option */}
                <div className="col-span-4">
                  <button
                    type="button"
                    disabled={!isPending}
                    onClick={() => toggleFieldChoice(key, "DUPLICATE")}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      chosen === "DUPLICATE"
                        ? "bg-amber-600/20 border border-amber-500/50 text-white font-medium"
                        : "bg-[#141414] border border-[#2a2a2a] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">{dVal !== null && dVal !== undefined && dVal !== "" ? String(dVal) : <em className="text-zinc-600">None</em>}</span>
                    {chosen === "DUPLICATE" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Fields (if configured) */}
        {customFieldDefinitions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#262626]">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Custom Fields
            </span>
            {customFieldDefinitions.map((def) => {
              const choiceKey = `cf_${def.fieldKey}`;
              const pVal = primaryCustomFields[def.fieldKey];
              const dVal = duplicateCustomFields[def.fieldKey];
              const isConflict = String(pVal ?? "").trim() !== String(dVal ?? "").trim();
              const chosen = fieldChoices[choiceKey] || "PRIMARY";

              return (
                <div
                  key={def.id}
                  className={`grid grid-cols-12 gap-3 items-center p-2.5 rounded-lg text-xs transition-colors ${
                    isConflict
                      ? "bg-amber-500/5 border border-amber-500/20"
                      : "bg-[#1b1b1b]/50 border border-transparent"
                  }`}
                >
                  <div className="col-span-3 text-zinc-300 font-medium truncate">
                    <span className="truncate">{def.label}</span>
                  </div>

                  <div className="col-span-4">
                    <button
                      type="button"
                      disabled={!isPending}
                      onClick={() => toggleFieldChoice(choiceKey, "PRIMARY")}
                      className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        chosen === "PRIMARY"
                          ? "bg-indigo-600/20 border border-indigo-500/50 text-white font-medium"
                          : "bg-[#141414] border border-[#2a2a2a] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="truncate">{pVal !== null && pVal !== undefined && pVal !== "" ? String(pVal) : <em className="text-zinc-600">None</em>}</span>
                      {chosen === "PRIMARY" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                    </button>
                  </div>

                  <div className="col-span-1 text-center text-zinc-600">
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </div>

                  <div className="col-span-4">
                    <button
                      type="button"
                      disabled={!isPending}
                      onClick={() => toggleFieldChoice(choiceKey, "DUPLICATE")}
                      className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        chosen === "DUPLICATE"
                          ? "bg-amber-600/20 border border-amber-500/50 text-white font-medium"
                          : "bg-[#141414] border border-[#2a2a2a] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="truncate">{dVal !== null && dVal !== undefined && dVal !== "" ? String(dVal) : <em className="text-zinc-600">None</em>}</span>
                      {chosen === "DUPLICATE" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tags comparison */}
        {(primaryTags.length > 0 || duplicateTags.length > 0) && (
          <div className="p-3 bg-[#141414] border border-[#262626] rounded-lg text-xs space-y-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Tags to Combine
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(new Map([...primaryTags, ...duplicateTags].map((t) => [t.id, t])).values()).map(
                (tag) => (
                  <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
                )
              )}
            </div>
            <p className="text-[10px] text-zinc-500">
              All unique tags from both records will be merged onto the primary record automatically.
            </p>
          </div>
        )}

        {/* Linked Data Preview */}
        <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-[11px]">
            <ActivityIcon className="w-3.5 h-3.5" />
            <span>Automatic Data Migration upon Merge</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Merging will safely reassign all timeline activities, conversation threads, WhatsApp logs, documents, and payments from the duplicate record to the primary record, then archive the duplicate.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      {isPending && (
        <div className="px-5 py-4 bg-[#1c1c1c] border-t border-[#262626] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissModalOpen(true)}
            className="text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            <span>Dismiss (Not a Duplicate)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsMergeModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-4 shadow-md"
          >
            <GitMerge className="w-4 h-4" />
            <span>Merge Records</span>
          </Button>
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      <Dialog
        isOpen={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
            <GitMerge className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Confirm Merge
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            You are merging the duplicate entry into the primary record (
            <strong className="text-zinc-200">{primaryEntity.name}</strong>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-zinc-300">
          <div className="p-3 bg-[#121214] border border-[#27272a] rounded-lg space-y-1.5 text-[11px]">
            <p className="font-semibold text-zinc-200">Summary of actions:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Selected field values will be applied to the primary record.</li>
              <li>All timeline activities & conversation history will be transferred.</li>
              {entityType === "STUDENT" && <li>All uploaded documents & payment schedules will be transferred.</li>}
              <li>All tags will be unified without duplicate entries.</li>
              <li>The duplicate record will be archived and hidden from default active views.</li>
              <li>An audit log record will be permanently saved.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsMergeModalOpen(false)}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmMerge}
            isDisabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Merging...
              </>
            ) : (
              "Confirm & Merge"
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dismiss Confirmation Dialog */}
      <Dialog
        isOpen={isDismissModalOpen}
        onOpenChange={setIsDismissModalOpen}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <XCircle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Dismiss Duplicate Match?
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Mark this match as a false-positive (e.g., separate individuals who share a contact). Both records will remain active and untouched.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDismissModalOpen(false)}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmDismiss}
            isDisabled={isSubmitting}
          >
            {isSubmitting ? "Dismissing..." : "Dismiss Match"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
