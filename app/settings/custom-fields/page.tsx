"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Sliders,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  PowerOff,
  Power,
  Sparkles,
  Layers,
  Database,
  ShieldAlert,
  Loader2,
  HelpCircle,
  X,
} from "lucide-react";
import { CustomFieldDefinition, CustomFieldEntityType, CustomFieldType } from "@/types";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export default function CustomFieldsSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<"LEAD" | "STUDENT">("LEAD");
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formType, setFormType] = useState<CustomFieldType>(CustomFieldType.TEXT);
  const [formRequired, setFormRequired] = useState(false);
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deactivation / Delete Warning Modal State
  const [deactivatingField, setDeactivatingField] = useState<CustomFieldDefinition | null>(null);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);

  const fetchFields = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/custom-fields?includeInactive=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load custom fields.");
      setFields(data.definitions || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch custom fields.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchFields();
    }
  }, [session]);

  const currentTabFields = fields
    .filter((f) => f.entityType === activeTab)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Auto-slugify label for key during field creation
  const handleLabelChange = (val: string) => {
    setFormLabel(val);
    if (!editingField) {
      const generatedKey = val
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_");
      setFormKey(generatedKey);
    }
  };

  const handleOpenAdd = () => {
    setEditingField(null);
    setFormLabel("");
    setFormKey("");
    setFormType(CustomFieldType.TEXT);
    setFormRequired(false);
    setFormOptions([]);
    setOptionInput("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setFormLabel(field.label);
    setFormKey(field.fieldKey);
    setFormType(field.fieldType);
    setFormRequired(field.required);
    setFormOptions(field.options || []);
    setOptionInput("");
    setIsModalOpen(true);
  };

  const handleAddOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    if (formOptions.includes(trimmed)) {
      toast.error("Option already exists.");
      return;
    }
    setFormOptions([...formOptions, trimmed]);
    setOptionInput("");
  };

  const handleRemoveOption = (opt: string) => {
    setFormOptions(formOptions.filter((o) => o !== opt));
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      toast.error("Label is required.");
      return;
    }
    if (!formKey.trim()) {
      toast.error("Field key is required.");
      return;
    }
    if (formType === CustomFieldType.SELECT && formOptions.length === 0) {
      toast.error("SELECT fields require at least one option.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingField) {
        // PATCH
        const res = await fetch(`/api/custom-fields/${editingField.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formLabel.trim(),
            required: formRequired,
            options: formType === CustomFieldType.SELECT ? formOptions : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update custom field.");
        toast.success("Custom field updated.");
      } else {
        // POST
        const res = await fetch(`/api/custom-fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: activeTab,
            fieldKey: formKey.trim(),
            label: formLabel.trim(),
            fieldType: formType,
            options: formType === CustomFieldType.SELECT ? formOptions : null,
            required: formRequired,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create custom field.");
        toast.success("Custom field created successfully.");
      }
      setIsModalOpen(false);
      fetchFields();
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reorder field handler
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTabFields.length) return;

    const listCopy = [...currentTabFields];
    const [moved] = listCopy.splice(index, 1);
    listCopy.splice(targetIndex, 0, moved);

    const reorderedItems = listCopy.map((item, idx) => ({
      id: item.id,
      displayOrder: idx,
    }));

    // Optimistic UI update
    setFields((prev) =>
      prev.map((f) => {
        const match = reorderedItems.find((r) => r.id === f.id);
        return match ? { ...f, displayOrder: match.displayOrder } : f;
      })
    );

    try {
      const res = await fetch(`/api/custom-fields/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reorderedItems }),
      });
      if (!res.ok) {
        throw new Error("Failed to save field order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder fields.");
      fetchFields();
    }
  };

  // Toggle active / deactivate handler with safety check
  const handleToggleActiveClick = (field: CustomFieldDefinition) => {
    if (field.isActive) {
      // Deactivating: check if it has existing values
      setDeactivatingField(field);
      setIsDeactivateModalOpen(true);
    } else {
      // Re-activating: safe to execute directly
      executeToggleActive(field.id, true);
    }
  };

  const executeToggleActive = async (fieldId: string, newActiveState: boolean) => {
    try {
      const res = await fetch(`/api/custom-fields/${fieldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActiveState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update field status.");
      toast.success(newActiveState ? "Field activated." : "Field deactivated.");
      setIsDeactivateModalOpen(false);
      setDeactivatingField(null);
      fetchFields();
    } catch (err: any) {
      toast.error(err.message || "Failed to update field status.");
    }
  };

  const handleDeletePermanent = async (fieldId: string) => {
    try {
      const res = await fetch(`/api/custom-fields/${fieldId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete custom field.");
      toast.success(data.message || "Custom field removed.");
      setIsDeactivateModalOpen(false);
      setDeactivatingField(null);
      fetchFields();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete custom field.");
    }
  };

  const getFieldTypeBadge = (type: CustomFieldType) => {
    switch (type) {
      case "TEXT":
        return <Badge variant="outline" className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/25">Text</Badge>;
      case "NUMBER":
        return <Badge variant="outline" className="text-[11px] bg-purple-500/10 text-purple-400 border-purple-500/25">Number</Badge>;
      case "DATE":
        return <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-400 border-amber-500/25">Date</Badge>;
      case "SELECT":
        return <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-400 border-emerald-500/25">Select</Badge>;
      case "BOOLEAN":
        return <Badge variant="outline" className="text-[11px] bg-cyan-500/10 text-cyan-400 border-cyan-500/25">Boolean</Badge>;
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white font-heading">Admin Access Required</h2>
        <p className="text-xs text-zinc-400">
          Only organization administrators can configure or modify custom fields.
        </p>
        <Link href="/settings" className={buttonVariants({ variant: "outline", className: "mt-4 gap-2" })}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-300 font-medium">Custom Fields</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-400" />
            <span>Configurable Custom Fields</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Customize inquiry parameters and student onboarding attributes specific to your organization.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Add Custom Field</span>
        </Button>
      </div>

      {/* Entity Type Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(val) => setActiveTab(String(val) as "LEAD" | "STUDENT")}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-[#171717] border border-[#262626]">
            <TabsTrigger id="LEAD" className="gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Lead Fields</span>
              <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-[#262626] text-zinc-300">
                {fields.filter((f) => f.entityType === "LEAD").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger id="STUDENT" className="gap-2 text-xs">
              <Layers className="w-3.5 h-3.5" />
              <span>Student Fields</span>
              <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 bg-[#262626] text-zinc-300">
                {fields.filter((f) => f.entityType === "STUDENT").length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Fields List Card */}
      <Card className="bg-[#171717] border-[#262626] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white font-heading">
              {activeTab === "LEAD" ? "Lead Custom Fields" : "Student Custom Fields"}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Drag or use arrows to adjust display order on forms and tables.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {currentTabFields.length} total defined
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Loading custom fields...</p>
          </div>
        ) : currentTabFields.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Database className="w-10 h-10 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-white">No custom fields defined yet</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Add your first custom {activeTab.toLowerCase()} field to capture specialized program, scholarship, or inquiry criteria.
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenAdd} className="mt-2">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Field
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#262626]">
            {currentTabFields.map((field, idx) => {
              const recordedCount = field._count?.values || 0;

              return (
                <div
                  key={field.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors ${
                    !field.isActive ? "opacity-60 bg-zinc-900/30" : "hover:bg-[#202020]"
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, "up")}
                        className="p-1 rounded hover:bg-[#262626] text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === currentTabFields.length - 1}
                        onClick={() => handleMove(idx, "down")}
                        className="p-1 rounded hover:bg-[#262626] text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white">
                          {field.label}
                        </span>
                        <span className="text-xs font-mono text-zinc-500 bg-[#262626] px-1.5 py-0.5 rounded border border-[#333333]">
                          {field.fieldKey}
                        </span>
                        {getFieldTypeBadge(field.fieldType)}
                        {field.required && (
                          <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/25">
                            Required
                          </Badge>
                        )}
                        {!field.isActive && (
                          <Badge variant="outline" className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {/* Options preview for SELECT */}
                      {field.fieldType === CustomFieldType.SELECT && field.options && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] text-zinc-500 font-medium">Options:</span>
                          {field.options.map((opt) => (
                            <span
                              key={opt}
                              className="text-[11px] px-1.5 py-0.5 rounded bg-[#242424] text-zinc-300 border border-[#333333]"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                        <span>
                          {recordedCount} record{recordedCount === 1 ? "" : "s"} with values
                        </span>
                        <span>•</span>
                        <span>Order #{field.displayOrder + 1}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(field)}
                      className="border-[#2e2e2e] bg-[#202020] hover:bg-[#282828] text-xs gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActiveClick(field)}
                      className={`text-xs gap-1 border-[#2e2e2e] ${
                        field.isActive
                          ? "hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10"
                          : "hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                    >
                      {field.isActive ? (
                        <>
                          <PowerOff className="w-3.5 h-3.5" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add / Edit Field Modal */}
      <Dialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        isDismissable={!isSubmitting}
        className="sm:max-w-[500px]"
      >
        <form onSubmit={handleSaveField}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-white">
              {editingField ? `Edit ${editingField.label}` : `Add New ${activeTab} Custom Field`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Field Label */}
            <div className="space-y-1.5">
              <Label htmlFor="fieldLabel" className="text-xs font-medium text-zinc-300">
                Field Label <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="fieldLabel"
                value={formLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g., Scholarship Eligibility, Entrance Rank..."
                required
              />
            </div>

            {/* Field Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="fieldKey" className="text-xs font-medium text-zinc-300">
                  Field Key <span className="text-rose-400">*</span>
                </Label>
                <span className="text-[10px] text-zinc-500">Unique identifier for API/DB</span>
              </div>
              <Input
                id="fieldKey"
                disabled={!!editingField}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="e.g., scholarship_eligibility"
                className="font-mono text-xs"
                required
              />
            </div>

            {/* Field Type (only editable during creation) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">
                Data Type <span className="text-rose-400">*</span>
              </Label>
              <Select
                isDisabled={!!editingField}
                selectedKey={formType}
                onSelectionChange={(key) => setFormType(key as CustomFieldType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id={CustomFieldType.TEXT} textValue="Text (single line / string)">
                    Text (single line / string)
                  </SelectItem>
                  <SelectItem id={CustomFieldType.NUMBER} textValue="Number (numeric / score)">
                    Number (numeric / score)
                  </SelectItem>
                  <SelectItem id={CustomFieldType.DATE} textValue="Date (calendar picker)">
                    Date (calendar picker)
                  </SelectItem>
                  <SelectItem id={CustomFieldType.SELECT} textValue="Select (dropdown choices)">
                    Select (dropdown choices)
                  </SelectItem>
                  <SelectItem id={CustomFieldType.BOOLEAN} textValue="Boolean (checkbox / yes-no)">
                    Boolean (checkbox / yes-no)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options builder for SELECT */}
            {formType === CustomFieldType.SELECT && (
              <div className="space-y-2 p-3 rounded-lg bg-[#202020] border border-[#2e2e2e]">
                <Label className="text-xs font-medium text-zinc-300">
                  Dropdown Choices <span className="text-rose-400">*</span>
                </Label>

                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    placeholder="Type option and press Add..."
                    className="text-xs"
                  />
                  <Button type="button" size="sm" onClick={handleAddOption} className="shrink-0 bg-zinc-800 hover:bg-zinc-700">
                    Add
                  </Button>
                </div>

                {formOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                    {formOptions.map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#292929] text-zinc-200 border border-[#383838]"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt)}
                          className="text-zinc-400 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-400/80 pt-1">
                    Please add at least one option for users to select.
                  </p>
                )}
              </div>
            )}

            {/* Required Toggle */}
            <div className="flex items-center gap-2.5 pt-1">
              <Checkbox
                id="formRequired"
                isSelected={formRequired}
                onChange={setFormRequired}
              />
              <Label htmlFor="formRequired" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Require this field on create and conversion forms
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isDisabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingField ? (
                "Update Field"
              ) : (
                "Create Field"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Deactivation Safety Warning Modal */}
      <Dialog
        isOpen={isDeactivateModalOpen}
        onOpenChange={setIsDeactivateModalOpen}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Deactivate Custom Field?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-zinc-300">
          <p>
            Are you sure you want to deactivate{" "}
            <strong className="text-white font-semibold">{deactivatingField?.label}</strong>?
          </p>

          {(deactivatingField?._count?.values || 0) > 0 ? (
            <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-300">
              <AlertDescription className="text-xs leading-relaxed">
                <strong>Warning:</strong> This field currently has{" "}
                <strong>{deactivatingField?._count?.values}</strong> recorded value(s).
                Deactivating will hide this field from create forms, detail drawers, and table views.
                <br />
                <span className="opacity-90 block mt-1">
                  ✓ All existing historical values will be preserved and will reappear if re-activated.
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-zinc-400">
              This field currently has 0 recorded values. It can be safely deactivated or permanently removed.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeactivateModalOpen(false)}
          >
            Cancel
          </Button>

          {(deactivatingField?._count?.values || 0) === 0 && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => deactivatingField && handleDeletePermanent(deactivatingField.id)}
            >
              Delete Permanently
            </Button>
          )}

          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-500 text-white"
            onClick={() => deactivatingField && executeToggleActive(deactivatingField.id, false)}
          >
            Confirm Deactivation
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
