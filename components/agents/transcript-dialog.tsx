"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  Globe,
  Coins,
  ExternalLink,
  Bot,
  User,
  ShieldAlert,
} from "lucide-react";
import { ConversationOutcome } from "@/types";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    id: string;
    channel: string;
    transcript: string;
    outcome: ConversationOutcome;
    costInPaise: number | null;
    createdAt: string;
    claimedByUserId?: string | null;
    claimedAt?: string | null;
    agent?: {
      id: string;
      name: string;
      type: string;
    } | null;
    lead?: {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      stage?: string | null;
    } | null;
    student?: {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      program?: string | null;
      stage?: string | null;
    } | null;
    claimedBy?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  } | null;
}

export function TranscriptDialog({
  isOpen,
  onClose,
  conversation,
}: TranscriptDialogProps) {
  // Parse lines into dialogue messages
  const dialogue = useMemo(() => {
    if (!conversation?.transcript) return [];

    const lines = conversation.transcript.split("\n");
    return lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0 && colonIndex < 20) {
          const speaker = line.slice(0, colonIndex).trim();
          const text = line.slice(colonIndex + 1).trim();
          const isAgent =
            speaker.toLowerCase().includes("agent") ||
            speaker.toLowerCase().includes("assistant") ||
            speaker.toLowerCase().includes("bot") ||
            speaker.toLowerCase().includes("ai");
          return { speaker, text, isAgent };
        }
        return { speaker: "Note", text: line, isAgent: false };
      });
  }, [conversation?.transcript]);

  if (!conversation) return null;

  const outcomeColors: Record<string, string> = {
    CONVERTED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    ESCALATED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    CONTINUED: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    NO_RESPONSE: "bg-muted/40 text-zinc-400 border-border",
  };

  const channelIcons: Record<string, any> = {
    VOICE_CALL: Phone,
    WHATSAPP: MessageSquare,
    WEBSITE_CHAT: Globe,
  };

  const ChannelIcon = channelIcons[conversation.channel] || MessageSquare;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
            <ChannelIcon className="w-5 h-5" />
          </div>
          <span>{conversation.agent?.name || "AI Agent Interaction"}</span>
          <Badge variant="outline" className={outcomeColors[conversation.outcome] || ""}>
            {conversation.outcome}
          </Badge>
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          Channel: <span className="font-semibold text-foreground">{conversation.channel}</span> •{" "}
          {new Date(conversation.createdAt).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </DialogHeader>

      {/* Metadata Strip */}
      <div className="px-1 py-2 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        {/* Linked Contact */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">Contact:</span>
          {conversation.student ? (
            <Link
              href={`/students/${conversation.student.id}`}
              className="font-bold text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Student: {conversation.student.name} ({conversation.student.phone})</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : conversation.lead ? (
            <Link
              href={`/leads/${conversation.lead.id}`}
              className="font-bold text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Lead: {conversation.lead.name} ({conversation.lead.phone})</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <span className="text-muted-foreground font-medium">Unknown Caller</span>
          )}
        </div>

        {/* Cost & Escalation info */}
        <div className="flex items-center gap-4">
          {conversation.costInPaise !== null && (
            <span className="flex items-center gap-1 font-semibold text-foreground font-mono">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>₹{(conversation.costInPaise / 100).toFixed(2)} ({conversation.costInPaise}p)</span>
            </span>
          )}

          {conversation.outcome === "ESCALATED" && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                conversation.claimedBy
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/25 animate-pulse"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {conversation.claimedBy
                  ? `Claimed by ${conversation.claimedBy.name || conversation.claimedBy.email}`
                  : "Unclaimed Escalation"}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Transcript Dialogue Content */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="py-4 space-y-4">
          {dialogue.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs italic">
              No detailed dialogue lines available.
            </div>
          ) : (
            dialogue.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  msg.isAgent ? "justify-start" : "justify-end"
                }`}
              >
                {msg.isAgent && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-0.5 ${
                    msg.isAgent
                      ? "bg-muted/40 border border-border text-zinc-200 rounded-tl-sm"
                      : "bg-indigo-600 text-white rounded-tr-sm"
                  }`}
                >
                  <span
                    className={`block font-bold text-[10px] uppercase tracking-wider ${
                      msg.isAgent ? "text-indigo-400" : "text-indigo-200"
                    }`}
                  >
                    {msg.speaker}
                  </span>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>

                {!msg.isAgent && (
                  <div className="w-8 h-8 rounded-full bg-muted/40 border border-border text-zinc-300 flex items-center justify-center text-xs shrink-0 shadow-sm mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <DialogFooter className="pt-2 border-t border-border sm:justify-between items-center">
        <span className="text-[11px] text-muted-foreground font-mono">
          ID: {conversation.id}
        </span>
        <Button variant="outline" onClick={onClose}>
          Close Transcript
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
