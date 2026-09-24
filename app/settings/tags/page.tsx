"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Tag as TagIcon,
  Plus,
  ArrowLeft,
  Edit2,
  Trash2,
  Merge,
  ShieldAlert,
  Loader2,
  Search,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Tag } from "@/types";
import { TagBadge } from "@/components/tags/tag-badge";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#64748b", // Slate
];

export default function TagsSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  // Merge Modal State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceTag, setSourceTag] = useState<Tag | null>(null);
  const [targetTagId, setTargetTagId] = useState<string>("");

  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tags");
      setTags(data.tags || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchTags();
    }
  }, [session]);

  const handleOpenAdd = () => {
    setEditingTag(null);
    setTagName("");
    setTagColor(PRESET_COLORS[0]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setIsModalOpen(true);
  };

  const handleOpenMerge = (tag: Tag) => {
    setSourceTag(tag);
    const otherTags = tags.filter((t) => t.id !== tag.id);
    setTargetTagId(otherTags.length > 0 ? otherTags[0].id : "");
    setIsMergeModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tagName.trim();
    if (!trimmed) {
      toast.error("Tag name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTag) {
        // PATCH
        const res = await fetch(`/api/tags/${editingTag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            color: tagColor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update tag");
        toast.success(`Tag "${trimmed}" updated`);
      } else {
        // POST
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            color: tagColor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create tag");
        toast.success(`Tag "${trimmed}" created`);
      }
      setIsModalOpen(false);
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tags/${deletingTag.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete tag");
      toast.success(data.message || `Tag "${deletingTag.name}" deleted`);
      setIsDeleteModalOpen(false);
      setDeletingTag(null);
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMergeTags = async () => {
    if (!sourceTag || !targetTagId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTagId: sourceTag.id,
          targetTagId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to merge tags");
      toast.success(data.message || "Tags merged successfully");
      setIsMergeModalOpen(false);
      setSourceTag(null);
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge tags");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          Only organization administrators can configure or manage segmentation tags.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground mt-4"
        >
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
            <span className="text-xs text-zinc-300 font-medium">Tags & Segmentation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading flex items-center gap-2.5">
            <TagIcon className="w-6 h-6 text-purple-400" />
            <span>Tags & Segmentation</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Create, recolor, delete, and merge ad-hoc tags across Leads and Students.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Create Tag</span>
        </Button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="pl-9 h-9 text-xs bg-[#171717] border-[#262626]"
          />
        </div>

        <div className="text-xs text-zinc-400 font-mono self-end sm:self-center">
          <span>{tags.length} total tags defined</span>
        </div>
      </div>

      {/* Tags Grid / List Card */}
      <Card className="bg-[#171717] border-[#262626] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Loading tags...</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <TagIcon className="w-10 h-10 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-white">No tags found</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {searchQuery ? "No tags match your search query." : "Create your first tag to start segmenting leads and students."}
            </p>
            {!searchQuery && (
              <Button variant="outline" size="sm" onClick={handleOpenAdd} className="mt-2">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Tag
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#262626]">
            {filteredTags.map((tag) => {
              const usageCount = tag._count?.entityTags || 0;
              return (
                <div
                  key={tag.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#202020] transition-colors"
                >
                  {/* Left: Tag Badge & Usage */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <TagBadge name={tag.name} color={tag.color} size="md" />

                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono text-[11px] text-zinc-500">{tag.color}</span>
                      <span>•</span>
                      <span>
                        {usageCount} entity attachment{usageCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions (Edit, Merge, Delete) */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(tag)}
                      className="border-[#2e2e2e] bg-[#202020] hover:bg-[#282828] text-xs gap-1 h-8"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>

                    {tags.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenMerge(tag)}
                        className="border-[#2e2e2e] bg-[#202020] hover:bg-[#282828] text-xs gap-1 h-8 text-purple-400 hover:text-purple-300"
                      >
                        <Merge className="w-3.5 h-3.5" />
                        <span>Merge</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeletingTag(tag);
                        setIsDeleteModalOpen(true);
                      }}
                      className="border-[#2e2e2e] bg-[#202020] hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10 text-xs gap-1 h-8"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add / Edit Tag Modal */}
      <Dialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        isDismissable={!isSubmitting}
        className="sm:max-w-[420px]"
      >
        <form onSubmit={handleSaveTag}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-white">
              {editingTag ? "Edit Tag" : "Create New Tag"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="tagName" className="text-xs font-medium text-zinc-300">
                Tag Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="tagName"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. High Intent, VIP Applicant..."
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-zinc-300">
                  Tag Color <span className="text-rose-400">*</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                    title="Custom Color"
                  />
                  <span className="text-xs font-mono text-zinc-400">{tagColor}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTagColor(color)}
                    className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                      tagColor.toLowerCase() === color.toLowerCase()
                        ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  >
                    {tagColor.toLowerCase() === color.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div className="p-3 bg-[#121214] border border-[#27272a] rounded-lg space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Preview</span>
              <TagBadge name={tagName.trim() || "Tag Preview"} color={tagColor} size="md" />
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
            <Button type="submit" isDisabled={isSubmitting || !tagName.trim()} className="bg-blue-600 hover:bg-blue-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : editingTag ? (
                "Update Tag"
              ) : (
                "Create Tag"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <Trash2 className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Delete Tag?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-zinc-300">
          <p>
            Are you sure you want to delete the tag{" "}
            <strong className="text-white font-semibold">{deletingTag?.name}</strong>?
          </p>
          {(deletingTag?._count?.entityTags || 0) > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              This tag is currently attached to <strong>{deletingTag?._count?.entityTags}</strong> lead(s)/student(s).
              Deleting will remove this tag from all attached records.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteModalOpen(false)}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteTag}
            isDisabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete Tag"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Merge Tags Modal */}
      <Dialog
        isOpen={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        className="sm:max-w-[460px]"
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
            <Merge className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold font-heading text-white">
            Merge Tag
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Reassign all entity attachments from this tag to another tag, then delete the duplicate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs text-zinc-300">
          <div className="p-3 bg-[#121214] border border-[#27272a] rounded-lg space-y-1.5">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Source Tag (to be deleted)</span>
            {sourceTag && <TagBadge name={sourceTag.name} color={sourceTag.color} size="md" />}
            <span className="text-[11px] text-zinc-400 block pt-1">
              Currently assigned to <strong>{sourceTag?._count?.entityTags || 0}</strong> record(s).
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-300">
              Merge into Target Tag <span className="text-rose-400">*</span>
            </Label>
            <select
              value={targetTagId}
              onChange={(e) => setTargetTagId(e.target.value)}
              className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 [color-scheme:dark]"
            >
              {tags
                .filter((t) => t.id !== sourceTag?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t._count?.entityTags || 0} attachments)
                  </option>
                ))}
            </select>
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
            className="bg-purple-600 hover:bg-purple-500 text-white"
            onClick={handleMergeTags}
            isDisabled={isSubmitting || !targetTagId}
          >
            {isSubmitting ? "Merging..." : "Confirm & Merge"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
