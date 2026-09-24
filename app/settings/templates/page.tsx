"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Eye,
  Loader2,
  ChevronDown,
  X,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { MessageTemplate, MessageTemplateChannel } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Merge field definitions ────────────────────────────────────────────────

const LEAD_FIELDS = [
  { label: "Lead Name", key: "{{lead.name}}" },
  { label: "Lead Phone", key: "{{lead.phone}}" },
  { label: "Lead Email", key: "{{lead.email}}" },
  { label: "Lead Program", key: "{{lead.program}}" },
  { label: "Lead Source", key: "{{lead.source}}" },
  { label: "Lead Stage", key: "{{lead.stage}}" },
  { label: "Counselor Name", key: "{{lead.counselor}}" },
];

const STUDENT_FIELDS = [
  { label: "Student Name", key: "{{student.name}}" },
  { label: "Student Phone", key: "{{student.phone}}" },
  { label: "Student Email", key: "{{student.email}}" },
  { label: "Student Program", key: "{{student.program}}" },
  { label: "Student Cohort", key: "{{student.cohort}}" },
  { label: "Counselor Name", key: "{{student.counselor}}" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function channelBadge(channel: string) {
  if (channel === "EMAIL")
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
        <Mail className="w-3 h-3 mr-1" /> Email
      </Badge>
    );
  if (channel === "SMS")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
        <MessageSquare className="w-3 h-3 mr-1" /> SMS
      </Badge>
    );
  return (
    <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
      <MessageSquare className="w-3 h-3 mr-1" /> WhatsApp
    </Badge>
  );
}

/** Insert text at the textarea cursor position */
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  text: string,
  onChange: (val: string) => void
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const newVal = el.value.slice(0, start) + text + el.value.slice(end);
  onChange(newVal);
  // Restore focus & cursor after state update
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

// ─── Merge Field Picker ───────────────────────────────────────────────────────

function MergeFieldPicker({
  entityType,
  onInsert,
}: {
  entityType: "LEAD" | "STUDENT";
  onInsert: (key: string) => void;
}) {
  const fields = entityType === "LEAD" ? LEAD_FIELDS : STUDENT_FIELDS;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onInsert(f.key)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors font-mono"
          title={`Insert ${f.key}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTemplates({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20">
        <Mail className="w-8 h-8 text-indigo-400" />
      </div>
      <p className="text-zinc-300 font-medium">No message templates yet</p>
      <p className="text-zinc-500 text-sm max-w-xs">
        Create reusable Email, SMS, and WhatsApp templates with dynamic merge fields.
      </p>
      <Button onClick={onCreate} className="mt-2">
        <Plus className="w-4 h-4 mr-1.5" /> New Template
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MessageTemplatesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<"ALL" | "EMAIL" | "SMS" | "WHATSAPP">("ALL");

  // ─── Create / Edit modal state ────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState<MessageTemplateChannel>(MessageTemplateChannel.EMAIL);
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // ─── Delete confirm modal ─────────────────────────────────────────────────
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // ─── Preview panel ────────────────────────────────────────────────────────
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [previewEntityType, setPreviewEntityType] = useState<"LEAD" | "STUDENT">("LEAD");
  const [previewBody, setPreviewBody] = useState("");
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // ─── Merge field entity type (for editor) ────────────────────────────────
  const [editorEntityType, setEditorEntityType] = useState<"LEAD" | "STUDENT">("LEAD");

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/message-templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load templates.");
      setTemplates(data.templates || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch templates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchTemplates();
  }, [session]);

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormChannel(MessageTemplateChannel.EMAIL);
    setFormSubject("");
    setFormBody("");
    setEditorEntityType("LEAD");
    setIsModalOpen(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormChannel(t.channel);
    setFormSubject(t.subject || "");
    setFormBody(t.body);
    setEditorEntityType("LEAD");
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Template name is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        channel: formChannel,
        subject: formChannel === "EMAIL" ? formSubject : null,
        body: formBody,
      };

      const url = editingTemplate
        ? `/api/message-templates/${editingTemplate.id}`
        : "/api/message-templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template.");

      toast.success(editingTemplate ? "Template updated." : "Template created.");
      setIsModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDelete = (t: MessageTemplate) => {
    setDeletingTemplate(t);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      const res = await fetch(`/api/message-templates/${deletingTemplate.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete template.");
      toast.success("Template deleted.");
      setIsDeleteModalOpen(false);
      setDeletingTemplate(null);
      if (previewTemplate?.id === deletingTemplate.id) setPreviewTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template.");
    }
  };

  const loadPreview = useCallback(
    async (template: MessageTemplate, entityType: "LEAD" | "STUDENT") => {
      setIsPreviewLoading(true);
      try {
        const res = await fetch("/api/message-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.id, entityType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Preview failed.");
        setPreviewBody(data.body ?? "");
        setPreviewSubject(data.subject ?? null);
      } catch (err: any) {
        toast.error(err.message || "Preview failed.");
      } finally {
        setIsPreviewLoading(false);
      }
    },
    []
  );

  const openPreview = (t: MessageTemplate) => {
    setPreviewTemplate(t);
    setPreviewEntityType("LEAD");
    loadPreview(t, "LEAD");
  };

  const handlePreviewEntityChange = (type: "LEAD" | "STUDENT") => {
    setPreviewEntityType(type);
    if (previewTemplate) loadPreview(previewTemplate, type);
  };

  const filtered = activeChannel === "ALL"
    ? templates
    : templates.filter((t) => t.channel === activeChannel);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Message Templates</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Create reusable Email, SMS, and WhatsApp templates with dynamic merge fields
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" /> New Template
          </Button>
        )}
      </div>

      {/* ─── Channel Filter Tabs ─────────────────────────────────────────── */}
      <Tabs selectedKey={activeChannel} onSelectionChange={(k) => setActiveChannel(k as any)}>
        <TabsList>
          <TabsTrigger id="ALL">All</TabsTrigger>
          <TabsTrigger id="EMAIL">Email</TabsTrigger>
          <TabsTrigger id="SMS">SMS</TabsTrigger>
          <TabsTrigger id="WHATSAPP">WhatsApp</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Two-column layout: list + preview ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
        {/* Template List */}
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyTemplates onCreate={openCreate} />
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all ${
                    previewTemplate?.id === t.id
                      ? "ring-1 ring-indigo-500/50 bg-zinc-800/60"
                      : "hover:bg-zinc-800/40"
                  }`}
                  onClick={() => openPreview(t)}
                >
                  <CardContent className="flex items-start justify-between gap-3 py-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {channelBadge(t.channel)}
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {t.name}
                        </span>
                      </div>
                      {t.channel === "EMAIL" && t.subject && (
                        <p className="text-xs text-zinc-400 truncate">
                          Subject: {t.subject}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 truncate">{t.body}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t);
                          }}
                          className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(t);
                          }}
                          className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div>
          {previewTemplate ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 h-full flex flex-col overflow-hidden">
              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-300">
                    Preview — {previewTemplate.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Sample:</span>
                  <select
                    value={previewEntityType}
                    onChange={(e) =>
                      handlePreviewEntityChange(e.target.value as "LEAD" | "STUDENT")
                    }
                    className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
                  >
                    <option value="LEAD">Lead</option>
                    <option value="STUDENT">Student</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(null)}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Preview body */}
              {isPreviewLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : (
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {previewTemplate.channel === "EMAIL" && (
                    <div className="text-xs space-y-1">
                      <span className="text-zinc-500 font-medium">Subject:</span>
                      <p className="text-zinc-300 bg-zinc-800 rounded px-2 py-1">
                        {previewSubject || "(no subject)"}
                      </p>
                    </div>
                  )}
                  <div className="text-xs space-y-1">
                    <span className="text-zinc-500 font-medium">Body:</span>
                    <pre className="text-zinc-300 bg-zinc-800 rounded p-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {previewBody || "(empty body)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 h-full flex flex-col items-center justify-center py-20 text-center gap-2">
              <Eye className="w-8 h-8 text-zinc-700" />
              <p className="text-zinc-600 text-sm">Click a template to preview it</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create / Edit Modal ─────────────────────────────────────────── */}
      <Dialog isOpen={isModalOpen} onOpenChange={setIsModalOpen} isDismissable>
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? "Edit Template" : "New Message Template"}
          </DialogTitle>
          <DialogDescription>
            {editingTemplate
              ? "Update the template details below."
              : "Create a reusable template with merge fields like {{lead.name}}."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Template Name</Label>
            <Input
              placeholder="e.g. Welcome Email, Admission Offer SMS"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select
              selectedKey={formChannel}
              onSelectionChange={(key) => setFormChannel(key as MessageTemplateChannel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="EMAIL" textValue="Email">Email</SelectItem>
                <SelectItem id="SMS" textValue="SMS">SMS</SelectItem>
                <SelectItem id="WHATSAPP" textValue="WhatsApp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject (EMAIL only) */}
          {formChannel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label>Subject Line</Label>
              <Input
                ref={subjectRef as any}
                placeholder="e.g. Your admission to {{lead.program}} is confirmed!"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>
          )}

          {/* Merge field inserter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400">Merge Fields</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Entity:</span>
                <select
                  value={editorEntityType}
                  onChange={(e) => setEditorEntityType(e.target.value as "LEAD" | "STUDENT")}
                  className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
                >
                  <option value="LEAD">Lead</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
            </div>
            <MergeFieldPicker
              entityType={editorEntityType}
              onInsert={(key) => insertAtCursor(bodyRef, key, setFormBody)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              ref={bodyRef}
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Hi {{lead.name}}, thanks for your interest in {{lead.program}}..."
              rows={8}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setIsModalOpen(false)}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} isDisabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : null}
            {editingTemplate ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Delete Confirm Modal ─────────────────────────────────────────── */}
      <Dialog isOpen={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} isDismissable>
        <DialogHeader>
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong className="text-zinc-200">&ldquo;{deletingTemplate?.name}&rdquo;</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Any automation or agent trigger referencing this template will lose its body.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            Delete Template
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
