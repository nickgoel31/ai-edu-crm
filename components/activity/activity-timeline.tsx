"use client";

import { useEffect, useState, useCallback } from "react";
import {
  StickyNote,
  Phone,
  Mail,
  ArrowRightLeft,
  UserCheck,
  FileCheck2,
  CreditCard,
  Bot,
  Loader2,
  Send,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ActivityEntityType = "LEAD" | "STUDENT";

type ActivityKind =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "STAGE_CHANGE"
  | "ASSIGNMENT_CHANGE"
  | "DOCUMENT_UPDATE"
  | "PAYMENT_UPDATE"
  | "AGENT_CONVERSATION";

interface ActivityUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ActivityEntry {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityKind;
  content: string | null;
  metadata: Record<string, any> | null;
  createdByUserId: string | null;
  createdAt: string;
  createdBy?: ActivityUser | null;
  isPending?: boolean;
}

interface ActivityTimelineProps {
  entityType: ActivityEntityType;
  entityId: string;
  canEdit: boolean;
}

const MANUAL_TYPES: { value: ActivityKind; label: string }[] = [
  { value: "NOTE", label: "Note" },
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
];

const TYPE_META: Record<
  ActivityKind,
  { icon: typeof StickyNote; label: string; color: string; isSystem: boolean }
> = {
  NOTE: { icon: StickyNote, label: "Note", color: "blue", isSystem: false },
  CALL: { icon: Phone, label: "Call", color: "emerald", isSystem: false },
  EMAIL: { icon: Mail, label: "Email", color: "purple", isSystem: false },
  STAGE_CHANGE: { icon: ArrowRightLeft, label: "Stage Changed", color: "slate", isSystem: true },
  ASSIGNMENT_CHANGE: { icon: UserCheck, label: "Assignment Changed", color: "slate", isSystem: true },
  DOCUMENT_UPDATE: { icon: FileCheck2, label: "Document Updated", color: "slate", isSystem: true },
  PAYMENT_UPDATE: { icon: CreditCard, label: "Payment Updated", color: "slate", isSystem: true },
  AGENT_CONVERSATION: { icon: Bot, label: "AI Agent Conversation", color: "slate", isSystem: true },
};

function initials(name: string | null | undefined, email: string | undefined) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function dayLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dayKey(dateStr: string) {
  return new Date(dateStr).toDateString();
}

function renderDescription(activity: ActivityEntry): string {
  const meta = activity.metadata || {};
  switch (activity.type) {
    case "STAGE_CHANGE":
      return `Stage changed from ${meta.oldStage ?? "—"} to ${meta.newStage ?? "—"}${
        meta.lostReason ? ` (${meta.lostReason})` : ""
      }`;
    case "ASSIGNMENT_CHANGE":
      return `Reassigned from ${meta.oldAssigneeName || "Unassigned"} to ${
        meta.newAssigneeName || "Unassigned"
      }`;
    case "DOCUMENT_UPDATE":
      return `${meta.documentName || "Document"}: ${meta.oldStatus ?? "—"} → ${meta.newStatus ?? "—"}`;
    case "PAYMENT_UPDATE":
      return `Installment #${meta.installmentNumber ?? "—"} (₹${(meta.amount ?? 0).toLocaleString()}): ${
        meta.oldStatus ?? "—"
      } → ${meta.newStatus ?? "—"}`;
    case "AGENT_CONVERSATION":
      return `${meta.agentName || "AI Agent"} via ${meta.channel || "channel"} • Outcome: ${
        meta.outcome || "—"
      }`;
    default:
      return "";
  }
}

export function ActivityTimeline({ entityType, entityId, canEdit }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [activityType, setActivityType] = useState<ActivityKind>("NOTE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPage = useCallback(
    async (afterCursor: string | null) => {
      const params = new URLSearchParams({ entityType, entityId });
      if (afterCursor) params.set("cursor", afterCursor);

      const res = await fetch(`/api/activities?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load activity timeline.");
      }
      return data as { activities: ActivityEntry[]; nextCursor: string | null };
    },
    [entityType, entityId]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchPage(null)
      .then((data) => {
        if (cancelled) return;
        setActivities(data.activities);
        setCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Failed to load activity timeline.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(cursor);
      setActivities((prev) => [...prev, ...data.activities]);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (err: any) {
      setError(err?.message || "Failed to load more activity.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !content.trim() || isSubmitting) return;

    const trimmed = content.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: ActivityEntry = {
      id: tempId,
      entityType,
      entityId,
      type: activityType,
      content: trimmed,
      metadata: null,
      createdByUserId: "me",
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    setActivities((prev) => [optimisticEntry, ...prev]);
    setContent("");
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, type: activityType, content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to log activity.");
      }

      setActivities((prev) =>
        prev.map((a) => (a.id === tempId ? { ...data.activity, isPending: false } : a))
      );
    } catch (err: any) {
      setError(err?.message || "Failed to log activity.");
      setActivities((prev) => prev.filter((a) => a.id !== tempId));
      setContent(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group activities by calendar day, preserving newest-first order.
  const groups: { key: string; label: string; items: ActivityEntry[] }[] = [];
  for (const activity of activities) {
    const key = dayKey(activity.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.items.push(activity);
    } else {
      groups.push({ key, label: dayLabel(activity.createdAt), items: [activity] });
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <Card>
          <form onSubmit={handleSubmit} className="px-4 space-y-3">
            <div className="flex items-center gap-2">
              {MANUAL_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant={activityType === t.value ? "default" : "outline"}
                  onClick={() => setActivityType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Log a note, call summary, or email exchange..."
                className="flex-1"
              />
              <Button
                type="submit"
                isDisabled={!content.trim() || isSubmitting}
                className="self-end shrink-0"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Post</span>
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="p-3 bg-muted/40 border border-border rounded-lg text-center text-xs text-muted-foreground font-medium">
          Read-only accounts cannot add activity entries.
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-5">
        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
            <p className="text-xs font-medium">Loading activity timeline...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-xs">
            No activity recorded yet.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 bg-card py-1 z-10">
                  {group.label}
                </div>
                <div className="relative border-l border-border ml-3 space-y-4">
                  {group.items.map((activity) => {
                    const meta = TYPE_META[activity.type];
                    const Icon = meta.icon;
                    const isManual = !meta.isSystem;
                    const author = activity.createdBy;

                    return (
                      <div key={activity.id} className="relative pl-6">
                        <div
                          className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 border-card shadow-xs flex items-center justify-center ${
                            isManual
                              ? meta.color === "blue"
                                ? "bg-blue-600 text-white"
                                : meta.color === "emerald"
                                ? "bg-emerald-600 text-white"
                                : "bg-purple-600 text-white"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                        </div>

                        <div
                          className={`rounded-lg p-3 space-y-1.5 border transition-all ${
                            isManual
                              ? "bg-card border-border shadow-xs"
                              : "bg-muted/30 border-border"
                          } ${activity.isPending ? "opacity-60" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isManual && author && (
                                <Avatar size="sm" className="size-4">
                                  <AvatarFallback className="bg-blue-600 text-white text-[8px] font-bold">
                                    {initials(author.name, author.email)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <span
                                className={`text-[11px] font-semibold uppercase tracking-wider ${
                                  isManual ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {meta.label}
                              </span>
                              {isManual && author && (
                                <span className="text-[10px] text-muted-foreground">
                                  by {author.name || author.email}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                              {activity.isPending
                                ? "Sending..."
                                : new Date(activity.createdAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                            </span>
                          </div>

                          {isManual ? (
                            <p
                              className={`text-xs leading-relaxed ${
                                activity.isPending
                                  ? "text-muted-foreground"
                                  : "text-foreground bg-muted/40 p-2.5 rounded border border-border"
                              }`}
                            >
                              {activity.content}
                            </p>
                          ) : (
                            <p className="text-xs text-foreground/80 font-medium">{renderDescription(activity)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  isDisabled={isLoadingMore}
                  className="mx-auto"
                >
                  {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{isLoadingMore ? "Loading..." : "Load more"}</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
