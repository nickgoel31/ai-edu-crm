"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const LOST_REASONS = [
  "Not Interested",
  "Budget",
  "Timing",
  "Competitor",
  "Unresponsive",
  "Other",
] as const;

export type LostReasonType = (typeof LOST_REASONS)[number];

interface LostReasonDialogProps {
  isOpen: boolean;
  leadName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function LostReasonDialog({
  isOpen,
  leadName,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: LostReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<LostReasonType>("Not Interested");
  const [additionalNote, setAdditionalNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = additionalNote.trim()
      ? `${selectedReason}: ${additionalNote.trim()}`
      : selectedReason;
    onConfirm(finalReason);
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
          <div className="p-1.5 rounded-lg bg-destructive/15 text-destructive border border-destructive/25">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span>Mark Lead as Lost</span>
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogDescription>
          Please specify why <span className="font-semibold text-foreground">{leadName}</span> is being moved to the <span className="font-semibold text-destructive">Lost</span> stage. This is required for pipeline analytics.
        </DialogDescription>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reason for Loss <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={selectedReason}
            onChange={(value) => setSelectedReason(value as LostReasonType)}
            className="grid grid-cols-2 gap-2"
          >
            {LOST_REASONS.map((reason) => (
              <Label
                key={reason}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedReason === reason
                    ? "border-destructive/50 bg-destructive/15 text-destructive font-medium shadow-sm ring-1 ring-destructive/30"
                    : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <RadioGroupItem value={reason} />
                <span>{reason}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Supplementary Notes (Optional)
          </Label>
          <Textarea
            value={additionalNote}
            onChange={(e) => setAdditionalNote(e.target.value)}
            placeholder="e.g. Enrolled with competitor XYZ, offered 40% discount"
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" isDisabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Confirm & Move to Lost"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
