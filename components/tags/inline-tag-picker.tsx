"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Tag as TagIcon, Check, Search, Loader2 } from "lucide-react";
import { Tag } from "@/types";
import { TagBadge } from "./tag-badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

interface InlineTagPickerProps {
  entityType: "LEAD" | "STUDENT";
  entityId: string;
  initialTags?: Tag[];
  allAvailableTags?: Tag[];
  canEdit?: boolean;
  onTagsChange?: (tags: Tag[]) => void;
  className?: string;
}

export function InlineTagPicker({
  entityType,
  entityId,
  initialTags = [],
  allAvailableTags,
  canEdit = true,
  onTagsChange,
  className = "",
}: InlineTagPickerProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [availableTags, setAvailableTags] = useState<Tag[]>(allAvailableTags || []);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initialTags
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  // Load available tags if not provided or when opening
  const loadAvailableTags = async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (res.ok && data.tags) {
        setAvailableTags(data.tags);
      }
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAvailableTags();
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Attach a tag to entity
  const handleAttachTag = async (tag: Tag) => {
    // Check if already attached
    if (tags.some((t) => t.id === tag.id)) {
      // Toggle off (detach)
      handleDetachTag(tag.id);
      return;
    }

    const nextTags = [...tags, tag];
    setTags(nextTags);
    if (onTagsChange) onTagsChange(nextTags);

    try {
      const res = await fetch("/api/tags/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          tagId: tag.id,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to attach tag");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to attach tag");
      setTags(tags); // Rollback
      if (onTagsChange) onTagsChange(tags);
    }
  };

  // Detach a tag from entity
  const handleDetachTag = async (tagId: string) => {
    const nextTags = tags.filter((t) => t.id !== tagId);
    setTags(nextTags);
    if (onTagsChange) onTagsChange(nextTags);

    try {
      const res = await fetch("/api/tags/entity", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          tagId,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to detach tag");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to detach tag");
      setTags(tags); // Rollback
      if (onTagsChange) onTagsChange(tags);
    }
  };

  // Create new tag on the fly and attach
  const handleCreateAndAttach = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = (newTagName || searchQuery).trim();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      // 1. Create tag
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          color: newTagColor,
        }),
      });
      const data = await res.json();

      let createdOrExistingTag: Tag = data.tag;
      if (!res.ok) {
        if (res.status === 409 && data.tag) {
          createdOrExistingTag = data.tag;
        } else {
          throw new Error(data.error || "Failed to create tag");
        }
      }

      // 2. Attach to current entity
      await handleAttachTag(createdOrExistingTag);

      // 3. Update available tags
      setAvailableTags((prev) => {
        if (prev.some((t) => t.id === createdOrExistingTag.id)) return prev;
        return [...prev, createdOrExistingTag];
      });

      setNewTagName("");
      setSearchQuery("");
      setIsCreating(false);
      toast.success(`Tag "${createdOrExistingTag.name}" created and assigned`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create tag");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTags = availableTags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exactMatchExists = availableTags.some(
    (t) => t.name.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  return (
    <div className={`relative inline-flex flex-wrap items-center gap-1.5 ${className}`} ref={containerRef}>
      {/* Rendered Tag Badges */}
      {tags.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          onRemove={canEdit ? () => handleDetachTag(tag.id) : undefined}
        />
      ))}

      {/* Add Tag Trigger Button */}
      {canEdit && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setIsCreating(false);
              setSearchQuery("");
            }}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none h-5.5"
          >
            <Plus className="w-3 h-3" />
            <span>Tag</span>
          </button>

          {/* Autocomplete & Creation Popover */}
          {isOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
              {!isCreating ? (
                <>
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search or add tag..."
                      className="w-full bg-[#121214] border border-[#27272a] rounded-lg pl-7 pr-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>

                  {/* Existing Tags List */}
                  <div className="max-h-44 overflow-y-auto space-y-0.5 crm-scrollbar">
                    {filteredTags.length === 0 && searchQuery.trim() === "" ? (
                      <div className="py-3 text-center text-zinc-500 text-[11px]">
                        No tags yet. Create one below!
                      </div>
                    ) : (
                      filteredTags.map((tag) => {
                        const isAttached = tags.some((t) => t.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleAttachTag(tag)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/70 text-left text-xs text-zinc-200 transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="truncate">{tag.name}</span>
                            </div>
                            {isAttached && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Create New Option Button */}
                  {searchQuery.trim() !== "" && !exactMatchExists && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTagName(searchQuery.trim());
                        setIsCreating(true);
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors cursor-pointer border border-blue-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create &quot;{searchQuery.trim()}&quot;</span>
                    </button>
                  )}

                  {!searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTagName("");
                        setIsCreating(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Create New Tag</span>
                    </button>
                  )}
                </>
              ) : (
                /* On-The-Fly Tag Creator with Tiny Color Picker */
                <form onSubmit={handleCreateAndAttach} className="space-y-2.5 pt-0.5">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-1.5">
                    <span className="text-xs font-semibold text-zinc-300">New Tag</span>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200"
                    >
                      Back
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-medium">Tag Name</label>
                    <Input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="e.g. Scholarship, VIP, Urgent..."
                      className="h-7 text-xs bg-[#121214]"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-zinc-400 font-medium">Color</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Custom Color"
                        />
                        <span className="text-[10px] font-mono text-zinc-500">{newTagColor}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTagColor(color)}
                          className={`w-4.5 h-4.5 rounded-full transition-transform ${
                            newTagColor.toLowerCase() === color.toLowerCase()
                              ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-zinc-900"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Color ${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreating(false)}
                      className="h-6 text-[11px] px-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      isDisabled={isLoading || !newTagName.trim()}
                      className="h-6 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-500"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create & Tag"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
