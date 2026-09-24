"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  MessageCircle,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Play,
  ExternalLink,
  Database,
} from "lucide-react";
import { IntegrationType } from "@/types";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

interface IntegrationRecord {
  id: string;
  type: IntegrationType;
  isEnabled: boolean;
  webhookSecret: string;
  config: any;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  leadsImported: number;
}

export default function IntegrationsSettingsPage() {
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form field state mirrors
  const [metaSecret, setMetaSecret] = useState("");
  const [whatsappSecret, setWhatsappSecret] = useState("");
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [googleSheetSecret, setGoogleSheetSecret] = useState("");
  const [googleSheetRange, setGoogleSheetRange] = useState("Sheet1!A2:E");

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load integrations");

      const items: IntegrationRecord[] = data.integrations || [];
      setIntegrations(items);

      const meta = items.find((i) => i.type === "META_ADS");
      if (meta) setMetaSecret(meta.webhookSecret || "");

      const wa = items.find((i) => i.type === "WHATSAPP");
      if (wa) setWhatsappSecret(wa.webhookSecret || "");

      const sheets = items.find((i) => i.type === "GOOGLE_SHEETS");
      if (sheets) {
        setGoogleSheetSecret(sheets.webhookSecret || "");
        setGoogleSheetId(sheets.config?.sheetId || "");
        setGoogleSheetRange(sheets.config?.sheetRange || "Sheet1!A2:E");
      }
    } catch (err: any) {
      setMessage({ text: err?.message || "Error loading integrations", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveIntegration = async (
    type: IntegrationType,
    webhookSecret: string,
    config?: any
  ) => {
    setSavingType(type);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          webhookSecret,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");

      setMessage({ text: `${type.replace(/_/g, " ")} settings saved successfully!`, type: "success" });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Failed to save integration", type: "error" });
    } finally {
      setSavingType(null);
    }
  };

  const handleSimulateMetaLead = async () => {
    setTestingType("META_ADS");
    setMessage(null);
    try {
      const meta = integrations.find((i) => i.type === "META_ADS");
      const token = meta?.webhookSecret || metaSecret;
      const res = await fetch(`/api/webhooks/meta?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Siddhant Deshmukh (Meta Test)",
          phone: "+91 98700 12345",
          email: "siddhant.meta@gmail.com",
          adCampaign: "2026 Vocational Masterclass Campaign",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Meta test lead failed");

      setMessage({
        text: `Meta Ingestion Test: ${data.result} (Lead ID: ${data.leadId})`,
        type: "success",
      });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Meta test failed", type: "error" });
    } finally {
      setTestingType(null);
    }
  };

  const handleSimulateWhatsAppMessage = async () => {
    setTestingType("WHATSAPP");
    setMessage(null);
    try {
      const wa = integrations.find((i) => i.type === "WHATSAPP");
      const token = wa?.webhookSecret || whatsappSecret;
      const res = await fetch(`/api/webhooks/whatsapp?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "Tanvi Verma (WhatsApp Test)",
          phone: "+91 98700 54321",
          message: "Hi! Can you share details and fee structure for the Solar PV Installation program?",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "WhatsApp test failed");

      setMessage({
        text: `WhatsApp Ingestion Test: ${data.result} (Lead ID: ${data.leadId})`,
        type: "success",
      });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "WhatsApp test failed", type: "error" });
    } finally {
      setTestingType(null);
    }
  };

  const handleTriggerGoogleSheetsSync = async () => {
    setTestingType("GOOGLE_SHEETS");
    setMessage(null);
    try {
      const sheets = integrations.find((i) => i.type === "GOOGLE_SHEETS");
      const token = sheets?.webhookSecret || googleSheetSecret;
      const res = await fetch(`/api/webhooks/google-sheets?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sheets sync failed");

      setMessage({
        text: `${data.message}`,
        type: "success",
      });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Google Sheets sync failed", type: "error" });
    } finally {
      setTestingType(null);
    }
  };

  const metaIntegration = integrations.find((i) => i.type === "META_ADS");
  const whatsappIntegration = integrations.find((i) => i.type === "WHATSAPP");
  const sheetsIntegration = integrations.find((i) => i.type === "GOOGLE_SHEETS");

  const metaWebhookUrl = `${origin}/api/webhooks/meta?token=${metaSecret}`;
  const whatsappWebhookUrl = `${origin}/api/webhooks/whatsapp?token=${whatsappSecret}`;
  const sheetsCronUrl = `${origin}/api/webhooks/google-sheets?token=${googleSheetSecret}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <Breadcrumb className="mb-1.5">
            <BreadcrumbList className="text-2xs text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink render={(props: any) => <Link href="/settings" {...props} />}>
                  Settings
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground font-medium">Integrations</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-primary" />
            Lead Ingestion & Webhooks
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure org-scoped webhook endpoints for Meta Ads, WhatsApp, and Google Sheets synchronization.
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={fetchIntegrations}
          isDisabled={isLoading}
          title="Refresh Integration Status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Notifications */}
      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <AlertDescription className="text-xs font-medium text-inherit">{message.text}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-xs">Loading integration configurations...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Meta Lead Ads Card */}
          <Card className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Meta Lead Ads (Facebook & Instagram)
                  </h2>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Receives real-time lead submissions from Meta Lead Forms with phone deduplication.
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Webhook
                </Badge>
                <span className="text-2xs text-muted-foreground font-medium">
                  {metaIntegration?.leadsImported || 0} leads ingested
                </span>
              </div>
            </div>

            {/* Webhook URL Box */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                Webhook Callback URL (Paste into Meta App Dashboard)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={metaWebhookUrl}
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" onClick={() => copyToClipboard(metaWebhookUrl, "meta-url")}>
                  {copiedKey === "meta-url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "meta-url" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Secret & Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tenant Webhook Token / Secret
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={metaSecret}
                    onChange={(e) => setMetaSecret(e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    onClick={() => handleSaveIntegration("META_ADS", metaSecret)}
                    isDisabled={savingType === "META_ADS"}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <Button
                  variant="outline"
                  onClick={handleSimulateMetaLead}
                  isDisabled={testingType === "META_ADS"}
                  className="w-full text-blue-400 hover:text-blue-300 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20"
                >
                  {testingType === "META_ADS" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Simulate Test Meta Lead Form Submission</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* 2. WhatsApp Business API Card */}
          <Card className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    WhatsApp Business Cloud API
                  </h2>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Captures inbound student WhatsApp chats, creates/updates leads, and logs conversations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Listener
                </Badge>
                <span className="text-2xs text-muted-foreground font-medium">
                  {whatsappIntegration?.leadsImported || 0} leads ingested
                </span>
              </div>
            </div>

            {/* Webhook URL Box */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                WhatsApp Callback URL (Paste into Meta WhatsApp Cloud Settings)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={whatsappWebhookUrl}
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" onClick={() => copyToClipboard(whatsappWebhookUrl, "wa-url")}>
                  {copiedKey === "wa-url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "wa-url" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tenant Webhook Token / Verify Token
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={whatsappSecret}
                    onChange={(e) => setWhatsappSecret(e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    onClick={() => handleSaveIntegration("WHATSAPP", whatsappSecret)}
                    isDisabled={savingType === "WHATSAPP"}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <Button
                  variant="outline"
                  onClick={handleSimulateWhatsAppMessage}
                  isDisabled={testingType === "WHATSAPP"}
                  className="w-full text-emerald-400 hover:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  {testingType === "WHATSAPP" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Simulate Inbound WhatsApp Inquiry</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* 3. Google Sheets Sync Card */}
          <Card className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Google Sheets Scheduled Synchronization
                  </h2>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Syncs applicant spreadsheets on a schedule and upserts leads matched by phone number.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    sheetsIntegration?.lastSyncStatus === "SUCCESS"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {sheetsIntegration?.lastSyncStatus || "IDLE"}
                </Badge>
                <span className="text-2xs text-muted-foreground font-medium">
                  {sheetsIntegration?.leadsImported || 0} leads synced
                </span>
              </div>
            </div>

            {/* Sheet ID & Range Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Google Sheet ID
                </label>
                <Input
                  type="text"
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sheet Name / Range
                </label>
                <Input
                  type="text"
                  value={googleSheetRange}
                  onChange={(e) => setGoogleSheetRange(e.target.value)}
                  placeholder="Sheet1!A2:E"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Cron / Scheduled Trigger URL */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                Scheduled Cron Trigger URL (Runs automated background sync)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={sheetsCronUrl}
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" onClick={() => copyToClipboard(sheetsCronUrl, "sheets-cron")}>
                  {copiedKey === "sheets-cron" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "sheets-cron" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-2xs text-muted-foreground">
                {sheetsIntegration?.lastSyncAt ? (
                  <span>
                    Last Synced:{" "}
                    <strong className="text-foreground">
                      {new Date(sheetsIntegration.lastSyncAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </span>
                ) : (
                  <span>Never synced yet</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() =>
                    handleSaveIntegration("GOOGLE_SHEETS", googleSheetSecret, {
                      sheetId: googleSheetId,
                      sheetRange: googleSheetRange,
                    })
                  }
                  isDisabled={savingType === "GOOGLE_SHEETS"}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Sheet Config</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTriggerGoogleSheetsSync}
                  isDisabled={testingType === "GOOGLE_SHEETS"}
                  className="text-purple-400 hover:text-purple-300 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
                >
                  {testingType === "GOOGLE_SHEETS" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Sync Google Sheet Now</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* 4. Enterprise ERP Sync Card */}
          <Card className="space-y-5 border-blue-500/30 bg-blue-500/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      Enterprise ERP Synchronization
                    </h2>
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">NEW</Badge>
                  </div>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Automated outbound enrolled student push with field mapping & inbound webhook for fees, attendance, and exam grades.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/settings/integrations/erp"
                  className={buttonVariants({ className: "gap-1.5" })}
                >
                  <span>Configure ERP & Field Mapping</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-3.5 bg-card rounded-lg border border-border">
                <span className="text-muted-foreground block font-semibold text-2xs mb-1">Outbound Sync</span>
                <p className="text-foreground text-xs font-medium">
                  Dispatches student profile whenever a student enters <strong className="text-blue-400">ENROLLED</strong> stage.
                </p>
              </div>
              <div className="p-3.5 bg-card rounded-lg border border-border">
                <span className="text-muted-foreground block font-semibold text-2xs mb-1">Inbound Webhook</span>
                <p className="text-foreground text-xs font-medium">
                  Receives fee installments, attendance records, and exam results matched by external ID.
                </p>
              </div>
              <div className="p-3.5 bg-card rounded-lg border border-border">
                <span className="text-muted-foreground block font-semibold text-2xs mb-1">Field Mapping</span>
                <p className="text-foreground text-xs font-medium">
                  Customizable CRM to ERP JSON schema translation with real-time preview & activity logs.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
