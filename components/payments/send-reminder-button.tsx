"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Drop-in button for a payments list/detail view (e.g. inside a student's
 * fee/installment table) that fires the UPI-linked WhatsApp reminder for a
 * single Payment via POST /api/payments/[id]/send-reminder.
 *
 * Not wired into app/students/** by design (that tree is owned by another
 * engineer) — place this next to each PENDING/OVERDUE installment row,
 * passing that row's Payment id.
 */
export function SendReminderButton({
  paymentId,
  onSent,
}: {
  paymentId: string;
  onSent?: (message: string) => void;
}) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${paymentId}/send-reminder`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || data?.message || "Failed to send reminder.");
      }
      onSent?.(data.message);
    } catch (err: any) {
      setError(err?.message || "Failed to send reminder.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={handleSend} isDisabled={isSending} className="gap-1.5">
        {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        <span>Send Reminder</span>
      </Button>
      {error && <p className="text-2xs text-destructive">{error}</p>}
    </div>
  );
}
