"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  MessageSquareText,
  Plus,
  Loader2,
  ShieldCheck,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface Campaign {
  id: string;
  name: string;
  templateMessage: string;
  segmentType: "LEADS" | "STUDENTS";
  segmentFilter: string | null;
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  optedOutSkipped: number;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  SENDING: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SENT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
};

const LEAD_STAGES = ["COLD", "WARM", "HOT", "CONVERTING", "LOST"];
const STUDENT_STAGES = ["ENQUIRY", "ENROLLED", "ACTIVE", "ALUMNI"];

export default function BroadcastsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [segmentType, setSegmentType] = useState<"LEADS" | "STUDENTS">("LEADS");
  const [stageFilter, setStageFilter] = useState<string>("__any__");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [sendingCampaign, setSendingCampaign] = useState<Campaign | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcasts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load campaigns.");
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetCreateForm() {
    setName("");
    setTemplateMessage("");
    setSegmentType("LEADS");
    setStageFilter("__any__");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !templateMessage.trim()) {
      setCreateError("Name and message are required.");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          templateMessage,
          segmentType,
          segmentFilter: stageFilter !== "__any__" ? { stage: stageFilter } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign.");

      setIsCreateOpen(false);
      resetCreateForm();
      await loadCampaigns();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create campaign.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSend() {
    if (!sendingCampaign) return;
    setIsSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/broadcasts/${sendingCampaign.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send campaign.");
      setSendingCampaign(null);
      await loadCampaigns();
    } catch (err: any) {
      setSendError(err.message || "Failed to send campaign.");
    } finally {
      setIsSending(false);
    }
  }

  const stageOptions = segmentType === "LEADS" ? LEAD_STAGES : STUDENT_STAGES;

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Admins only</AlertTitle>
          <AlertDescription>
            WhatsApp broadcast campaigns can only be managed by an organization admin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-semibold flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-primary" />
            WhatsApp Broadcasts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Admissions-season campaigns to your leads or students segment.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </Button>
      </div>

      <Alert>
        <ShieldCheck className="w-4 h-4" />
        <AlertTitle>DLT compliance</AlertTitle>
        <AlertDescription>
          WhatsApp broadcast messaging in India is governed by TRAI&apos;s DLT regulations. This
          tool only messages contacts with recorded opt-in consent (<code>whatsappOptIn</code>) —
          obtain consent before enabling broadcasts for a contact. Contacts without opt-in are
          automatically skipped and counted, never messaged.
        </AlertDescription>
      </Alert>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground text-center py-6">
            No campaigns yet. Create one to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-heading text-sm font-semibold">{c.name}</h3>
                    <Badge variant="outline" className={STATUS_STYLES[c.status]}>
                      {c.status}
                    </Badge>
                    <Badge variant="secondary">{c.segmentType}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {c.templateMessage}
                  </p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span>Total opted-in: <strong className="text-foreground">{c.totalRecipients}</strong></span>
                    <span>Sent: <strong className="text-emerald-500">{c.sentCount}</strong></span>
                    <span>Failed: <strong className="text-destructive">{c.failedCount}</strong></span>
                    <span>Skipped (no opt-in): <strong className="text-amber-500">{c.optedOutSkipped}</strong></span>
                  </div>
                </div>
                {c.status === "DRAFT" && (
                  <Button size="sm" onClick={() => setSendingCampaign(c)}>
                    <Send className="w-3.5 h-3.5" />
                    Send Now
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        isDismissable={!isCreating}
      >
        <DialogHeader>
          <DialogTitle>New Broadcast Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <DialogDescription>
            Creates a draft campaign. Only contacts who have opted in to WhatsApp marketing will
            ever be counted or messaged.
          </DialogDescription>

          <div className="space-y-1.5">
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Admissions Open - Sept Batch" />
          </div>

          <div className="space-y-1.5">
            <Label>Segment</Label>
            <Select
              selectedKey={segmentType}
              onSelectionChange={(key) => {
                setSegmentType(key as "LEADS" | "STUDENTS");
                setStageFilter("__any__");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="LEADS" textValue="Leads">Leads</SelectItem>
                <SelectItem id="STUDENTS" textValue="Students">Students</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Stage filter (optional)</Label>
            <Select selectedKey={stageFilter} onSelectionChange={(key) => setStageFilter(key as string)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="__any__" textValue="Any stage">Any stage</SelectItem>
                {stageOptions.map((s) => (
                  <SelectItem key={s} id={s} textValue={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              value={templateMessage}
              onChange={(e) => setTemplateMessage(e.target.value)}
              placeholder="Hi {{name}}, admissions are now open for..."
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground">
              Use <code>{"{{name}}"}</code> to personalize per recipient.
            </p>
          </div>

          <Alert>
            <ShieldCheck className="w-3.5 h-3.5" />
            <AlertDescription>
              Only sent to contacts who have opted in to WhatsApp marketing. The exact opted-in
              count is computed and shown once the draft is created.
            </AlertDescription>
          </Alert>

          {createError && <p className="text-xs text-destructive">{createError}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} isDisabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" isDisabled={isCreating}>
              {isCreating ? "Creating..." : "Create Draft"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Send confirmation dialog */}
      <Dialog
        isOpen={!!sendingCampaign}
        onOpenChange={(open) => {
          if (!open) {
            setSendingCampaign(null);
            setSendError(null);
          }
        }}
        isDismissable={!isSending}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Confirm Send
          </DialogTitle>
        </DialogHeader>

        {sendingCampaign && (
          <div className="space-y-3">
            <DialogDescription>
              This will immediately send &quot;{sendingCampaign.name}&quot; to{" "}
              <strong className="text-foreground">{sendingCampaign.totalRecipients}</strong>{" "}
              opted-in {sendingCampaign.segmentType.toLowerCase()}. This action is irreversible.
            </DialogDescription>

            {sendError && <p className="text-xs text-destructive">{sendError}</p>}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setSendingCampaign(null)} isDisabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSend} isDisabled={isSending}>
                {isSending ? "Sending..." : `Send to ${sendingCampaign.totalRecipients} contacts`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  );
}
