"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  FileCheck2,
  Calendar,
  Building,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CustomFieldsRenderer } from "@/components/custom-fields/custom-fields-renderer";

interface ConvertLeadDialogProps {
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (studentId: string) => void;
}

interface DocumentTemplate {
  id: string;
  program: string;
  requiredDocuments: string[];
}

const BRANCH_OPTIONS = [
  "Pune Industrial Campus",
  "Bangalore Central",
  "Delhi NCR Hub",
  "Hyderabad Skill Center",
  "Online / Distance Lab",
];

export function ConvertLeadDialog({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: ConvertLeadDialogProps) {
  const router = useRouter();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [cohort, setCohort] = useState<string>("2026-Q2");
  const [branch, setBranch] = useState<string>("Pune Industrial Campus");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>("15000");
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [stage, setStage] = useState<string>("ENROLLED");
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch document templates and active Student custom fields
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsLoadingTemplates(true);
      Promise.all([
        fetch("/api/document-templates").then((res) => res.json()),
        fetch("/api/custom-fields?entityType=STUDENT").then((res) => res.json()),
      ])
        .then(([templateData, customFieldData]) => {
          const list: DocumentTemplate[] = templateData.templates || [];
          setTemplates(list);
          if (list.length > 0 && !selectedProgram) {
            setSelectedProgram(list[0].program);
          }
          setCustomFieldDefinitions(customFieldData.definitions || []);
          setCustomFieldValues({});
        })
        .catch((err) => {
          console.error("Error loading templates or custom fields:", err);
          setError("Failed to load program details.");
        })
        .finally(() => {
          setIsLoadingTemplates(false);
        });
    }
  }, [isOpen]);

  const activeTemplate = templates.find((t) => t.program === selectedProgram);

  const handleCustomFieldChange = (key: string, val: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram || !cohort) {
      setError("Please select a program and cohort.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program: selectedProgram,
          cohort: cohort.trim(),
          branch: branch.trim() || null,
          stage,
          initialPaymentAmount: initialPaymentAmount ? Number(initialPaymentAmount) : 0,
          paymentDueDate: paymentDueDate || null,
          customFields: customFieldValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to convert lead to student.");
      }

      onClose();
      if (onSuccess) {
        onSuccess(data.studentId);
      } else {
        router.push(`/students/${data.studentId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable={!isSubmitting}
      className="max-w-2xl max-h-[85vh] overflow-y-auto"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span>Convert Lead to Enrolled Student</span>
        </DialogTitle>
        <p className="text-xs text-muted-foreground font-normal mt-0.5">
          Enrolling <span className="font-medium text-foreground">{lead.name}</span>
        </p>
      </DialogHeader>

      <form onSubmit={handleConvert} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Lead Details Readonly Summary */}
        <div className="p-3.5 bg-muted/40 border border-border rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-zinc-500 block font-medium">Full Name</span>
            <span className="text-zinc-200 font-semibold">{lead.name}</span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Phone</span>
            <span className="text-zinc-200 font-semibold">{lead.phone}</span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Email</span>
            <span className="text-zinc-200 font-semibold truncate block">{lead.email}</span>
          </div>
        </div>

        {/* Program Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4" />
            <span>Vocational Program *</span>
          </Label>
          {isLoadingTemplates ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading available programs...</span>
            </div>
          ) : (
            <Select
              selectedKey={selectedProgram}
              onSelectionChange={(key) => setSelectedProgram(String(key))}
              isRequired
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} id={t.program}>
                    {t.program}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Document Checklist Preview from Template */}
        {activeTemplate && (
          <div className="p-3.5 bg-blue-950/30 border border-blue-800/40 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                Auto-Instantiated Document Checklist ({activeTemplate.requiredDocuments.length} items)
              </span>
              <Badge variant="outline" className="text-blue-400 border-blue-500/20 bg-blue-500/10">
                Template
              </Badge>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-zinc-300">
              {activeTemplate.requiredDocuments.map((doc, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cohort & Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>Target Cohort *</span>
            </Label>
            <Input
              type="text"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              placeholder="e.g. 2026-Q2"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building className="w-4 h-4" />
              <span>Campus / Branch</span>
            </Label>
            <Select
              selectedKey={branch}
              onSelectionChange={(key) => setBranch(String(key))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANCH_OPTIONS.map((b) => (
                  <SelectItem key={b} id={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Initial Installment Milestone */}
        <div className="p-3.5 bg-muted/40 border border-border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Initial Fee Installment (Optional)
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              First milestone creation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Amount (₹ INR)
              </Label>
              <Input
                type="number"
                min="0"
                step="500"
                value={initialPaymentAmount}
                onChange={(e) => setInitialPaymentAmount(e.target.value)}
                placeholder="15000"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Due Date
              </Label>
              <Input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Student Custom Fields */}
        {customFieldDefinitions.length > 0 && (
          <div className="p-3.5 bg-muted/40 border border-border rounded-lg">
            <CustomFieldsRenderer
              definitions={customFieldDefinitions}
              values={customFieldValues}
              onChange={handleCustomFieldChange}
              columns={2}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isDisabled={isSubmitting || isLoadingTemplates}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Converting & Enrolling...</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4" />
                <span>Complete Student Enrollment</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
