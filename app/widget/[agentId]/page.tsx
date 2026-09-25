"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, MessageCircle } from "lucide-react";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface WidgetMeta {
  id: string;
  name: string;
  welcomeMessage: string;
  widgetColor: string;
}

// Standalone, unauthenticated page — the real embeddable website chat
// widget. Institutions embed this via <iframe src="/widget/{agentId}">.
// It talks to /api/widget/[agentId]/chat, which runs an actual multi-turn
// LLM conversation using the agent's configured system prompt, model, and
// knowledge base.
export default function WidgetPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;

  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/widget/${agentId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This chat agent is not available.");
        setMeta(data);
        setTurns([{ role: "assistant", content: data.welcomeMessage }]);
      })
      .catch((err) => setMetaError(err.message));
  }, [agentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setIsSending(true);

    try {
      const res = await fetch(`/api/widget/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConversationId(data.conversationId);
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setError(err.message || "Failed to send message.");
      setTurns((prev) => prev.slice(0, -1)); // roll back the optimistic user turn
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  if (metaError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
        {metaError}
      </div>
    );
  }

  const accent = meta?.widgetColor || "#2563eb";

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3" style={{ backgroundColor: accent }}>
        <MessageCircle className="h-5 w-5 text-white" />
        <span className="font-semibold text-white">{meta?.name || "Chat with us"}</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                turn.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {turn.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {error && <div className="px-4 pb-1 text-xs text-destructive">{error}</div>}

      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          disabled={!meta || isSending}
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          disabled={!meta || isSending || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
