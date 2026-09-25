"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Loader2,
  AlertCircle,
  Rocket,
  Save,
  ChevronLeft,
  ChevronRight,
  Database,
  Plus,
  CheckCircle2,
  Lock,
  X,
} from "lucide-react";
import { AgentChannel, AgentRole, AGENT_ROLE_META } from "@/types";
import { getAgentConfigSchema, type AgentConfigField } from "@/lib/agent-config-schemas";
import { SECRET_SET_SENTINEL } from "@/lib/agent-config";
import type { AgentCatalogEntry } from "@/lib/agent-catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CHANNEL_ICONS: Record<AgentChannel, typeof Phone> = {
  VOICE: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  WEBSITE_CHAT: Globe,
};

interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
}

interface DynamicAgentFormProps {
  role: AgentRole;
  mode: "create" | "edit";
  entry?: AgentCatalogEntry; // required for create mode (catalog name/description)
  agentId?: string; // required for edit mode
  initialName?: string;
  initialConfig?: Record<string, any>;
  initialKnowledgeBaseIds?: string[];
}

function fieldVisible(field: AgentConfigField, values: Record<string, any>): boolean {
  if (!field.showIf) return true;
  const current = values[field.showIf.field];
  return field.showIf.equals.includes(current);
}

export function DynamicAgentForm({
  role,
  mode,
  entry,
  agentId,
  initialName,
  initialConfig,
  initialKnowledgeBaseIds,
}: DynamicAgentFormProps) {
  const router = useRouter();
  const meta = AGENT_ROLE_META[role];
  const Icon = CHANNEL_ICONS[meta.channel] || Bot;
  const sections = useMemo(() => getAgentConfigSchema(role), [role]);

  const [name, setName] = useState(initialName ?? entry?.name ?? meta.label);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue;
      }
    }
    return { ...defaults, ...(initialConfig || {}) };
  });
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(initialKnowledgeBaseIds || []);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [showNewKbDialog, setShowNewKbDialog] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDescription, setNewKbDescription] = useState("");
  const [creatingKb, setCreatingKb] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Steps: 0 = identity, 1..N = schema sections, last = review
  const steps = useMemo(
    () => [
      { id: "identity", title: "Agent Identity" },
      ...sections.map((s) => ({ id: s.id, title: s.title })),
      { id: "review", title: "Review & Deploy" },
    ],
    [sections]
  );

  useEffect(() => {
    fetch("/api/knowledge-bases")
      .then((res) => res.json())
      .then((data) => setKnowledgeBases(data.knowledgeBases || []))
      .catch(() => {})
      .finally(() => setKbLoading(false));
  }, []);

  const setField = (key: string, value: any) => setValues((prev) => ({ ...prev, [key]: value }));

  const currentSection = stepIndex >= 1 && stepIndex <= sections.length ? sections[stepIndex - 1] : null;

  const validateCurrentStep = (): string | null => {
    if (stepIndex === 0) {
      if (!name.trim()) return "Agent name is required.";
      return null;
    }
    if (currentSection) {
      for (const field of currentSection.fields) {
        if (!fieldVisible(field, values)) continue;
        if (field.required) {
          const v = values[field.key];
          if (v === undefined || v === null || String(v).trim() === "") {
            return `${field.label} is required.`;
          }
        }
      }
    }
    return null;
  };

  const goNext = () => {
    const err = validateCurrentStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleCreateKnowledgeBase = async () => {
    if (!newKbName.trim()) return;
    setCreatingKb(true);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKbName.trim(), description: newKbDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create knowledge base.");
      const created: KnowledgeBaseSummary = { ...data.knowledgeBase, documentCount: 0 };
      setKnowledgeBases((prev) => [created, ...prev]);
      setKnowledgeBaseIds((prev) => [...prev, created.id]);
      setShowNewKbDialog(false);
      setNewKbName("");
      setNewKbDescription("");
    } catch (err: any) {
      setError(err?.message || "Failed to create knowledge base.");
    } finally {
      setCreatingKb(false);
    }
  };

  const handleSubmit = async () => {
    const err = validateCurrentStep();
    if (err) {
      setError(err);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const endpoint = mode === "create" ? "/api/agents" : `/api/agents/${agentId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body: Record<string, any> =
        mode === "create"
          ? { name: name.trim(), role, channel: meta.channel, status: "LIVE", configValues: values, knowledgeBaseIds }
          : { name: name.trim(), configValues: values, knowledgeBaseIds };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save agent.");

      if (mode === "create") {
        router.push(`/agents/${data.agent.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save agent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: AgentConfigField) => {
    if (!fieldVisible(field, values)) return null;
    const value = values[field.key] ?? "";

    if (field.type === "select") {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label className="font-semibold text-zinc-300">
            <span>{field.label}{field.required && <span className="text-rose-400"> *</span>}</span>
          </Label>
          <Select selectedKey={value || undefined} onSelectionChange={(key) => setField(field.key, String(key))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} id={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helpText && <p className="text-[10px] text-zinc-500">{field.helpText}</p>}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label className="font-semibold text-zinc-300">
            <span>{field.label}{field.required && <span className="text-rose-400"> *</span>}</span>
          </Label>
          <Textarea
            value={value}
            onChange={(e) => setField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
          {field.helpText && <p className="text-[10px] text-zinc-500">{field.helpText}</p>}
        </div>
      );
    }

    if (field.secret) {
      const isAlreadySet = value === SECRET_SET_SENTINEL;
      return (
        <div key={field.key} className="space-y-1.5">
          <Label className="font-semibold text-zinc-300">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{field.label}{field.required && <span className="text-rose-400"> *</span>}</span>
          </Label>
          {isAlreadySet ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 h-9 px-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Already configured</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setField(field.key, "")}>
                Change
              </Button>
            </div>
          ) : (
            <Input
              type="password"
              value={value}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              autoComplete="off"
            />
          )}
          {field.helpText && <p className="text-[10px] text-zinc-500">{field.helpText}</p>}
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1.5">
        <Label className="font-semibold text-zinc-300">
          <span>{field.label}{field.required && <span className="text-rose-400"> *</span>}</span>
        </Label>
        <Input
          type={field.type === "number" ? "number" : field.type}
          value={value}
          onChange={(e) => setField(field.key, e.target.value)}
          placeholder={field.placeholder}
        />
        {field.helpText && <p className="text-[10px] text-zinc-500">{field.helpText}</p>}
      </div>
    );
  };

  const isKnowledgeStep = currentSection?.id === "knowledge";
  const isReviewStep = steps[stepIndex]?.id === "review";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-6 flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm shrink-0">
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{entry?.name || meta.label}</h1>
          {entry?.description && (
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{entry.description}</p>
          )}
          <span className="inline-block mt-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-muted/40">
            {mode === "create" ? "Not deployed" : "Editing"} · {meta.channel.replace(/_/g, " ")}
          </span>
        </div>
      </Card>

      {/* Step progress */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-center gap-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
              i === stepIndex
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : i < stepIndex
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-muted/30 text-zinc-500 border-border"
            }`}
          >
            {i < stepIndex && <CheckCircle2 className="w-3 h-3" />}
            <span>{step.title}</span>
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-5">
        <div className="border-b border-border/60 pb-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {steps[stepIndex]?.title}
          </h2>
          {currentSection?.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{currentSection.description}</p>
          )}
        </div>

        <div className="space-y-4 text-xs">
          {stepIndex === 0 && (
            <div className="space-y-1.5">
              <Label className="font-semibold text-zinc-300">
                <Bot className="w-3.5 h-3.5 text-zinc-500" />
                <span>Agent Name</span>
              </Label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          {currentSection && !isKnowledgeStep && currentSection.fields.map(renderField)}

          {isKnowledgeStep && (
            <div className="space-y-3">
              {kbLoading ? (
                <div className="flex items-center gap-2 text-zinc-500 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading knowledge bases...</span>
                </div>
              ) : knowledgeBases.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Database className="w-6 h-6 text-zinc-600 mx-auto" />
                  <p className="text-zinc-500">No knowledge bases yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledgeBases.map((kb) => {
                    const checked = knowledgeBaseIds.includes(kb.id);
                    return (
                      <label
                        key={kb.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked ? "border-blue-500/40 bg-blue-500/5" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          isSelected={checked}
                          onChange={(isChecked) =>
                            setKnowledgeBaseIds((prev) =>
                              isChecked ? [...prev, kb.id] : prev.filter((id) => id !== kb.id)
                            )
                          }
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-zinc-200">{kb.name}</p>
                          {kb.description && <p className="text-[11px] text-zinc-500 mt-0.5">{kb.description}</p>}
                          <p className="text-[10px] text-zinc-600 mt-0.5">{kb.documentCount} document(s)</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewKbDialog(true)}>
                <Plus className="w-3.5 h-3.5" />
                <span>New Knowledge Base</span>
              </Button>
            </div>
          )}

          {isReviewStep && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Agent name</span>
                  <span className="text-zinc-200 font-medium">{name}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Channel</span>
                  <span className="text-zinc-200 font-medium">{meta.channel.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Knowledge bases</span>
                  <span className="text-zinc-200 font-medium">{knowledgeBaseIds.length || "None"}</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">
                Review the steps above with the progress bar, or hit {mode === "create" ? "Deploy" : "Save"} to
                {mode === "create" ? " deploy this agent." : " save your changes."}
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={goBack} isDisabled={stepIndex === 0}>
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Button>

        {isReviewStep ? (
          <Button type="button" onClick={handleSubmit} isDisabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : mode === "create" ? (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Deploy Agent</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <Dialog
        isOpen={showNewKbDialog}
        onOpenChange={(open) => setShowNewKbDialog(open)}
        isDismissable={!creatingKb}
      >
        <DialogHeader>
          <DialogTitle>New Knowledge Base</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={newKbName} onChange={(e) => setNewKbName(e.target.value)} placeholder="e.g. Programs & Fees FAQ" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={newKbDescription} onChange={(e) => setNewKbDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowNewKbDialog(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreateKnowledgeBase} isDisabled={creatingKb || !newKbName.trim()}>
            {creatingKb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
