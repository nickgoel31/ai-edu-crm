"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  GitFork,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Loader2,
  Columns,
  GraduationCap,
  Shield,
} from "lucide-react";
import { PipelineTemplate, PipelineStage, PipelineStageBucket } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BUCKET_OPTIONS = [
  { value: "COLD", label: "COLD (Initial / Top of Funnel)", color: "text-blue-400" },
  { value: "WARM", label: "WARM (Engaged / Qualified)", color: "text-amber-400" },
  { value: "HOT", label: "HOT (High Intent / Evaluation)", color: "text-orange-400" },
  { value: "CONVERTING", label: "CONVERTING (Application / Enrolling)", color: "text-purple-400" },
  { value: "LOST", label: "LOST (Disqualified / Closed)", color: "text-rose-400" },
];

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#64748b", // Slate
];

export default function PipelinesSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Template Create / Edit Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PipelineTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateProgram, setTemplateProgram] = useState("");
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  // Stage Editor Modal State
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#3b82f6");
  const [stageBucket, setStageBucket] = useState<PipelineStageBucket>("COLD");
  const [stageRequiresReason, setStageRequiresReason] = useState(false);
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  // Delete Template Confirmation Modal State
  const [deletingTemplate, setDeletingTemplate] = useState<PipelineTemplate | null>(null);
  const [isDeleteTemplateModalOpen, setIsDeleteTemplateModalOpen] = useState(false);

  // Delete Stage Confirmation Modal State
  const [deletingStage, setDeletingStage] = useState<PipelineStage | null>(null);
  const [isDeleteStageModalOpen, setIsDeleteStageModalOpen] = useState(false);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pipelines");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pipelines.");
      setTemplates(data.templates || []);
      if (data.templates?.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data.templates[0].id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Error loading pipelines.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Open Template Modal
  const openNewTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateProgram("");
    setIsTemplateModalOpen(true);
  };

  const openEditTemplateModal = (t: PipelineTemplate) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateProgram(t.program || "");
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error("Template name is required.");
      return;
    }

    setIsSubmittingTemplate(true);
    try {
      if (editingTemplate) {
        // Update template
        const res = await fetch(`/api/pipelines/${editingTemplate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim(),
            program: templateProgram.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update pipeline.");
        toast.success("Pipeline template updated successfully.");
      } else {
        // Create template
        const res = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim(),
            program: templateProgram.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create pipeline.");
        toast.success("New pipeline template created.");
        setSelectedTemplateId(data.template.id);
      }

      setIsTemplateModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save pipeline template.");
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!deletingTemplate) return;
    try {
      const res = await fetch(`/api/pipelines/${deletingTemplate.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete pipeline template.");
      toast.success(data.message || "Pipeline template deleted.");
      setIsDeleteTemplateModalOpen(false);
      setDeletingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Error deleting pipeline.");
    }
  };

  // Stage Operations
  const openNewStageModal = () => {
    setEditingStage(null);
    setStageName("");
    setStageColor("#3b82f6");
    setStageBucket("COLD");
    setStageRequiresReason(false);
    setIsStageModalOpen(true);
  };

  const openEditStageModal = (s: PipelineStage) => {
    setEditingStage(s);
    setStageName(s.name);
    setStageColor(s.color);
    setStageBucket(s.mapsToBucket);
    setStageRequiresReason(s.requiresReasonOnExit);
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim()) {
      toast.error("Stage name is required.");
      return;
    }

    if (!currentTemplate) return;

    setIsSubmittingStage(true);
    try {
      const currentStages = currentTemplate.stages || [];
      let updatedStages: any[] = [];

      if (editingStage) {
        updatedStages = currentStages.map((s) =>
          s.id === editingStage.id
            ? {
                ...s,
                name: stageName.trim(),
                color: stageColor,
                mapsToBucket: stageBucket,
                requiresReasonOnExit: stageRequiresReason,
              }
            : s
        );
      } else {
        const newStage = {
          name: stageName.trim(),
          color: stageColor,
          mapsToBucket: stageBucket,
          requiresReasonOnExit: stageRequiresReason,
          displayOrder: currentStages.length,
        };
        updatedStages = [...currentStages, newStage];
      }

      const res = await fetch(`/api/pipelines/${currentTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: updatedStages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update pipeline stages.");
      toast.success(editingStage ? "Stage updated." : "New stage added to pipeline.");
      setIsStageModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save stage.");
    } finally {
      setIsSubmittingStage(false);
    }
  };

  const handleMoveStage = async (stageIndex: number, direction: "up" | "down") => {
    if (!currentTemplate || !currentTemplate.stages) return;
    const stages = [...currentTemplate.stages];
    const targetIndex = direction === "up" ? stageIndex - 1 : stageIndex + 1;

    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const temp = stages[stageIndex];
    stages[stageIndex] = stages[targetIndex];
    stages[targetIndex] = temp;

    // Reassign displayOrder
    const reordered = stages.map((s, idx) => ({ ...s, displayOrder: idx }));

    try {
      const res = await fetch(`/api/pipelines/${currentTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: reordered }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reorder stages.");
      toast.success("Stages reordered.");
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stage order.");
    }
  };

  const handleDeleteStageConfirm = async () => {
    if (!currentTemplate || !deletingStage) return;
    try {
      const remainingStages = (currentTemplate.stages || []).filter(
        (s) => s.id !== deletingStage.id
      );

      if (remainingStages.length === 0) {
        toast.error("A pipeline must have at least one stage.");
        return;
      }

      const res = await fetch(`/api/pipelines/${currentTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: remainingStages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete stage.");
      toast.success("Stage deleted.");
      setIsDeleteStageModalOpen(false);
      setDeletingStage(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Error deleting stage.");
    }
  };

  if (!isAdmin && status === "authenticated") {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white font-heading">Access Denied</h2>
        <p className="text-sm text-zinc-400 mt-2">
          Only organization administrators have permissions to configure admissions pipelines and stages.
        </p>
        <Link
          href="/leads"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 mt-6 transition-colors"
        >
          Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & Back link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <Link
              href="/settings"
              className="hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </Link>
            <span>/</span>
            <span className="text-zinc-200 font-medium">Pipelines & Stages</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <GitFork className="w-6 h-6 text-indigo-400" />
            <span>Configurable Pipelines</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Customize lead pipelines per program, configure custom stages, exit requirements, and maintain backward-compatible analytics bucket mapping.
          </p>
        </div>

        <Button
          onClick={openNewTemplateModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Program Pipeline
        </Button>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Pipeline Templates List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Available Pipelines
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              {templates.length}
            </span>
          </div>

          <div className="space-y-2">
            {templates.map((tpl) => {
              const isSelected = tpl.id === (currentTemplate?.id || selectedTemplateId);
              const stageCount = tpl.stages?.length ?? tpl._count?.stages ?? 0;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#202020] border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20"
                      : "bg-[#171717] border-[#262626] hover:bg-[#1f1f1f] hover:border-[#333333]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-semibold text-zinc-200 truncate">
                          {tpl.name}
                        </h4>
                        {tpl.isDefault && (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0">
                            Default
                          </Badge>
                        )}
                      </div>
                      {tpl.program ? (
                        <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1 font-medium truncate">
                          <GraduationCap className="w-3 h-3 shrink-0" />
                          <span>{tpl.program}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-500 mt-1">
                          General admissions fallback
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#262626] text-[11px] text-zinc-400">
                    <span>{stageCount} stages</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditTemplateModal(tpl);
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#2c2c2c] transition-colors"
                        title="Edit Pipeline Name/Program"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!tpl.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTemplate(tpl);
                            setIsDeleteTemplateModalOpen(true);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Pipeline"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Pipeline Stages Editor */}
        <div className="lg:col-span-3 space-y-4">
          {currentTemplate ? (
            <Card className="bg-[#171717] border-[#262626] p-6 space-y-6">
              {/* Template Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-heading">
                      {currentTemplate.name}
                    </h2>
                    {currentTemplate.isDefault && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
                        Default Organization Pipeline
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {currentTemplate.program
                      ? `Scoped strictly to inquiries in the "${currentTemplate.program}" program.`
                      : "Serves as the default pipeline for all programs without a dedicated template."}
                  </p>
                </div>

                <Button
                  onClick={openNewStageModal}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Stage
                </Button>
              </div>

              {/* Bucket Compatibility Info Alert */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs text-blue-200">
                <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-white">Backward Compatibility Guarantee:</strong> Each stage maps to an analytics bucket (`COLD`, `WARM`, `HOT`, `CONVERTING`, `LOST`). Funnel analytics, conversion reports, and scoring engine rules continue working seamlessly.
                </div>
              </div>

              {/* Stages List */}
              <div className="space-y-3">
                {(!currentTemplate.stages || currentTemplate.stages.length === 0) ? (
                  <div className="p-8 text-center border border-dashed border-[#2e2e2e] rounded-xl text-zinc-400">
                    <Columns className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-zinc-300">No stages configured</p>
                    <p className="text-xs text-zinc-500 mt-1">Click "Add Stage" to create stages for this pipeline.</p>
                  </div>
                ) : (
                  currentTemplate.stages.map((stage, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === (currentTemplate.stages?.length ?? 1) - 1;
                    const leadCount = stage._count?.leads ?? 0;

                    return (
                      <div
                        key={stage.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#202020] border border-[#2e2e2e] hover:border-[#3d3d3d] transition-colors"
                      >
                        {/* Left: Drag Handle / Stage Color / Name & Badges */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-white/20 shadow-sm"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-zinc-100 truncate">
                                {stage.name}
                              </span>
                              <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono">
                                Bucket: {stage.mapsToBucket}
                              </Badge>
                              {stage.requiresReasonOnExit && (
                                <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                                  Requires Exit Reason
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {leadCount} active leads currently in this stage
                            </p>
                          </div>
                        </div>

                        {/* Right: Stage Controls & Reordering */}
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          {/* Reorder Up */}
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveStage(idx, "up")}
                            className="p-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] text-zinc-400 hover:text-zinc-200 hover:bg-[#282828] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Stage Left / Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Reorder Down */}
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveStage(idx, "down")}
                            className="p-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] text-zinc-400 hover:text-zinc-200 hover:bg-[#282828] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Stage Right / Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Stage */}
                          <button
                            type="button"
                            onClick={() => openEditStageModal(stage)}
                            className="p-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] text-zinc-400 hover:text-indigo-300 hover:bg-[#282828] transition-colors"
                            title="Edit Stage"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Stage */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingStage(stage);
                              setIsDeleteStageModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Stage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : (
            <div className="p-12 text-center text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <span>Loading pipeline details...</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. Template Create / Edit Modal */}
      <Dialog
        isOpen={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        className="sm:max-w-[500px]"
      >
        <form onSubmit={handleSaveTemplate}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-white">
              {editingTemplate ? "Edit Pipeline Template" : "Create Program Pipeline"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Define a specialized admissions pipeline scoped to a specific program or educational course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Pipeline Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Data Science Masters Admissions"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Program Tag (Optional)</Label>
              <Input
                value={templateProgram}
                onChange={(e) => setTemplateProgram(e.target.value)}
                placeholder="e.g. Master of Data Science"
              />
              <p className="text-[11px] text-zinc-500">
                Leads with this program name will automatically use this pipeline. Leave blank for general pipelines.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateModalOpen(false)}
              isDisabled={isSubmittingTemplate}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={isSubmittingTemplate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isSubmittingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingTemplate ? (
                "Update Pipeline"
              ) : (
                "Create Pipeline"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* 2. Stage Create / Edit Modal */}
      <Dialog
        isOpen={isStageModalOpen}
        onOpenChange={setIsStageModalOpen}
        className="sm:max-w-[500px]"
      >
        <form onSubmit={handleSaveStage}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-white">
              {editingStage ? "Edit Pipeline Stage" : "Add Pipeline Stage"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure stage name, color highlight, analytical bucket mapping, and transition requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Stage Name *</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Document Verification / Aptitude Test"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Analytics Bucket Mapping *</Label>
              <Select
                selectedKey={stageBucket}
                onSelectionChange={(key) => setStageBucket(key as PipelineStageBucket)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} id={opt.value} textValue={opt.label}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-zinc-500">
                Maps this custom stage to standard conversion funnel metrics without breaking historical reports.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Stage Color Badge</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStageColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      stageColor === c ? "border-white scale-110 shadow-md" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  type="text"
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="w-24 h-8 text-xs font-mono ml-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Checkbox
                id="requiresReason"
                isSelected={stageRequiresReason}
                onChange={setStageRequiresReason}
              />
              <Label htmlFor="requiresReason" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Require exit reason when moving leads out of this stage (e.g. Lost reasons)
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStageModalOpen(false)}
              isDisabled={isSubmittingStage}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={isSubmittingStage}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isSubmittingStage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingStage ? (
                "Update Stage"
              ) : (
                "Add Stage"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* 3. Delete Template Modal */}
      <Dialog
        isOpen={isDeleteTemplateModalOpen}
        onOpenChange={setIsDeleteTemplateModalOpen}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Delete Pipeline Template?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-zinc-300">
          <p>
            Are you sure you want to delete the pipeline template <strong className="text-white font-semibold">"{deletingTemplate?.name}"</strong>?
          </p>
          <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-xs text-rose-300">
            Any leads currently tracked in this pipeline will be safely migrated to the organization's default admissions pipeline.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteTemplateModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteTemplateConfirm}
            className="bg-rose-600 hover:bg-rose-500"
          >
            Delete Pipeline
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 4. Delete Stage Modal */}
      <Dialog
        isOpen={isDeleteStageModalOpen}
        onOpenChange={setIsDeleteStageModalOpen}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Delete Pipeline Stage?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-zinc-300">
          <p>
            Are you sure you want to delete the stage <strong className="text-white font-semibold">"{deletingStage?.name}"</strong>?
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-300">
            Any active leads currently in this stage will be automatically shifted to the pipeline's fallback initial stage.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteStageModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteStageConfirm}
            className="bg-rose-600 hover:bg-rose-500"
          >
            Delete Stage
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
