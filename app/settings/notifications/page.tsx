"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Headphones,
  Send,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationPreference {
  id: string;
  userId: string;
  organizationId: string;
  stalledLeadsInApp: boolean;
  stalledLeadsEmail: boolean;
  stalledLeadsWhatsapp: boolean;
  overduePaymentsInApp: boolean;
  overduePaymentsEmail: boolean;
  overduePaymentsWhatsapp: boolean;
  escalationsInApp: boolean;
  escalationsEmail: boolean;
  escalationsWhatsapp: boolean;
  preferredChannel: "EMAIL" | "WHATSAPP";
  whatsappNumber: string | null;
}

export default function NotificationSettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [pref, setPref] = useState<NotificationPreference>({
    id: "",
    userId: "",
    organizationId: "",
    stalledLeadsInApp: true,
    stalledLeadsEmail: true,
    stalledLeadsWhatsapp: false,
    overduePaymentsInApp: true,
    overduePaymentsEmail: true,
    overduePaymentsWhatsapp: false,
    escalationsInApp: true,
    escalationsEmail: false,
    escalationsWhatsapp: true,
    preferredChannel: "EMAIL",
    whatsappNumber: "",
  });

  useEffect(() => {
    async function loadPreferences() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/notifications");
        if (res.ok) {
          const data = await res.json();
          if (data.preference) {
            setPref({
              ...data.preference,
              whatsappNumber: data.preference.whatsappNumber || "",
            });
          }
        }
      } catch (err) {
        console.error("Failed to load preferences:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pref),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update notification settings");
      }

      setMessage({ type: "success", text: "Notification preferences saved successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestDigest = async (channel: "EMAIL" | "WHATSAPP") => {
    try {
      setTestSending(true);
      setMessage(null);

      if (channel === "WHATSAPP" && !pref.whatsappNumber) {
        setMessage({
          type: "error",
          text: "Please enter a valid WhatsApp phone number with country code before testing.",
        });
        setTestSending(false);
        return;
      }

      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          whatsappNumber: pref.whatsappNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch test notification");
      }

      setMessage({
        type: "success",
        text: `Test ${channel === "WHATSAPP" ? "WhatsApp message" : "Email digest"} sent successfully! (Summary: ${data.summary?.stalledLeadsCount || 0} stalled leads, ${data.summary?.overduePaymentsCount || 0} overdue installments)`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Test notification dispatch failed" });
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Bell className="w-6 h-6 text-primary" />
          Notification Preferences
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Customize in-app alerts, daily digest emails, and WhatsApp summaries. Overdue payments and stalled leads are delivered as a consolidated daily digest to protect your focus.
        </p>
      </div>

      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <AlertDescription className="text-xs text-inherit">{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Digest Delivery Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Smartphone className="w-4 h-4 text-primary" />
            Digest Delivery Channel
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Choose where you want to receive your daily morning digest. Counselors who prefer WhatsApp can receive a formatted Markdown summary directly on their phone.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div
              onClick={() => setPref({ ...pref, preferredChannel: "EMAIL" })}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                pref.preferredChannel === "EMAIL"
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                  : "border-border bg-card/60 hover:border-zinc-700 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    pref.preferredChannel === "EMAIL"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Email Digest</h4>
                  <p className="text-2xs text-muted-foreground mt-0.5">Delivered to {session?.user?.email}</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setPref({ ...pref, preferredChannel: "WHATSAPP" })}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                pref.preferredChannel === "WHATSAPP"
                  ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-sm"
                  : "border-border bg-card/60 hover:border-zinc-700 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    pref.preferredChannel === "WHATSAPP"
                      ? "bg-emerald-500 text-white font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">WhatsApp Digest</h4>
                  <p className="text-2xs text-muted-foreground mt-0.5">Instant summary via WhatsApp Cloud API</p>
                </div>
              </div>
            </div>
          </div>

          {pref.preferredChannel === "WHATSAPP" && (
            <div className="mt-4 pt-4 border-t border-border space-y-1.5">
              <Label className="block text-xs font-medium text-foreground">
                Your WhatsApp Phone Number (with Country Code)
              </Label>
              <Input
                type="tel"
                placeholder="+919876543210"
                value={pref.whatsappNumber || ""}
                onChange={(e) => setPref({ ...pref, whatsappNumber: e.target.value })}
                className="w-full sm:w-80"
              />
              <p className="text-2xs text-muted-foreground">
                Example: +919876543210 (E.164 format for WhatsApp Business routing)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trigger Matrix */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">Trigger Matrix</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure how each critical CRM event is delivered to you.
          </p>
        </div>

        <div className="divide-y divide-border">
          {/* Stalled Leads */}
          <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">Stalled Leads (3+ Days Inactive)</h4>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Alerts when assigned leads have had no follow-up notes, stage changes, or calls in 3+ days.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pl-11 sm:pl-0">
              <Switch
                isSelected={pref.stalledLeadsInApp}
                onChange={(checked) => setPref({ ...pref, stalledLeadsInApp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                In-App
              </Switch>

              <Switch
                isSelected={pref.stalledLeadsEmail}
                onChange={(checked) => setPref({ ...pref, stalledLeadsEmail: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                Email Digest
              </Switch>

              <Switch
                isSelected={pref.stalledLeadsWhatsapp}
                onChange={(checked) => setPref({ ...pref, stalledLeadsWhatsapp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                WhatsApp
              </Switch>
            </div>
          </div>

          {/* Overdue Fee Payments */}
          <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">Overdue Fee Payments</h4>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Triggers for student installment schedules that have passed their due date without payment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pl-11 sm:pl-0">
              <Switch
                isSelected={pref.overduePaymentsInApp}
                onChange={(checked) => setPref({ ...pref, overduePaymentsInApp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                In-App
              </Switch>

              <Switch
                isSelected={pref.overduePaymentsEmail}
                onChange={(checked) => setPref({ ...pref, overduePaymentsEmail: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                Email Digest
              </Switch>

              <Switch
                isSelected={pref.overduePaymentsWhatsapp}
                onChange={(checked) => setPref({ ...pref, overduePaymentsWhatsapp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                WhatsApp
              </Switch>
            </div>
          </div>

          {/* Unclaimed AI Escalations */}
          <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-rose-500/5">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Unclaimed AI Escalations</span>
                  <Badge variant="destructive">Real-time</Badge>
                </h4>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Immediate alerts when an AI voice/chat agent transfers an agitated student or complex enquiry.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pl-11 sm:pl-0">
              <Switch
                isSelected={pref.escalationsInApp}
                onChange={(checked) => setPref({ ...pref, escalationsInApp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                In-App
              </Switch>

              <Switch
                isSelected={pref.escalationsEmail}
                onChange={(checked) => setPref({ ...pref, escalationsEmail: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                Email
              </Switch>

              <Switch
                isSelected={pref.escalationsWhatsapp}
                onChange={(checked) => setPref({ ...pref, escalationsWhatsapp: checked })}
                className="text-xs text-muted-foreground data-selected:text-foreground"
              >
                WhatsApp
              </Switch>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSendTestDigest(pref.preferredChannel)}
            isDisabled={testSending}
          >
            <Send className="w-3.5 h-3.5 text-muted-foreground" />
            <span>
              {testSending
                ? "Sending Test..."
                : `Send Test ${pref.preferredChannel === "WHATSAPP" ? "WhatsApp" : "Email"} Digest`}
            </span>
          </Button>
          <span className="text-2xs text-muted-foreground">
            Preview current digest with active CRM data
          </span>
        </div>

        <Button onClick={handleSave} isDisabled={saving}>
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Saving..." : "Save Preferences"}</span>
        </Button>
      </div>
    </div>
  );
}
