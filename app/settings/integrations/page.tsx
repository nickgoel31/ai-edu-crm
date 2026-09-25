"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
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
  ChevronDown,
  ChevronRight,
  Phone,
  Globe,
  Linkedin,
  Zap,
  Users,
  Building2,
  Code2,
  UploadCloud,
  FileText,
} from "lucide-react";
import {
  IntegrationType,
  LEAD_CHANNEL_TYPES,
  INTEGRATION_TYPE_META,
  INTEGRATION_CATEGORY_LABELS,
  IntegrationCategory,
} from "@/types";
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

const CHANNEL_ICONS: Record<IntegrationType, typeof Megaphone> = {
  META_ADS: Megaphone,
  GOOGLE_ADS: Megaphone,
  WHATSAPP: MessageCircle,
  CALL_TRACKING: Phone,
  WEBSITE_FORM: Globe,
  LINKEDIN_LEAD_GEN: Linkedin,
  REFERRAL: Users,
  INDIAMART: Building2,
  GOOGLE_SHEETS: FileSpreadsheet,
  CSV_IMPORT: UploadCloud,
  ZAPIER: Zap,
  CUSTOM_API: Code2,
  ERP: Database,
};

function webhookPathFor(type: IntegrationType): string {
  if (type === "META_ADS") return "/api/webhooks/meta";
  if (type === "WHATSAPP") return "/api/webhooks/whatsapp";
  if (type === "GOOGLE_SHEETS") return "/api/webhooks/google-sheets";
  return `/api/webhooks/lead/${type.toLowerCase()}`;
}

export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<IntegrationType | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [origin, setOrigin] = useState("");

  // Per-channel local field state, keyed by type
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [sheetId, setSheetId] = useState("");
  const [sheetRange, setSheetRange] = useState("Sheet1!A2:E");

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load integrations");
      const items: IntegrationRecord[] = data.integrations || [];
      setIntegrations(items);

      const nextSecrets: Record<string, string> = {};
      items.forEach((i) => (nextSecrets[i.type] = i.webhookSecret || ""));
      setSecrets((prev) => ({ ...nextSecrets, ...prev }));

      const sheets = items.find((i) => i.type === "GOOGLE_SHEETS");
      if (sheets) {
        setSheetId(sheets.config?.sheetId || "");
        setSheetRange(sheets.config?.sheetRange || "Sheet1!A2:E");
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

  const byType = useMemo(() => {
    const map = new Map<string, IntegrationRecord>();
    integrations.forEach((i) => map.set(i.type, i));
    return map;
  }, [integrations]);

  const categorized = useMemo(() => {
    const groups = new Map<IntegrationCategory, IntegrationType[]>();
    for (const type of LEAD_CHANNEL_TYPES) {
      const category = INTEGRATION_TYPE_META[type].category;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(type);
    }
    return groups;
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSave = async (type: IntegrationType, config?: any) => {
    setSavingType(type);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, webhookSecret: secrets[type] || undefined, isEnabled: true, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setMessage({ text: `${INTEGRATION_TYPE_META[type].label} saved successfully.`, type: "success" });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Failed to save integration.", type: "error" });
    } finally {
      setSavingType(null);
    }
  };

  const handleSendTestLead = async (type: IntegrationType) => {
    setTestingType(type);
    setMessage(null);
    try {
      const token = byType.get(type)?.webhookSecret || secrets[type];
      if (!token) throw new Error("Save this channel first to generate a webhook token.");

      const path = webhookPathFor(type);
      let payload: any = {
        name: "Test Lead",
        phone: "+91 98700 12345",
        email: "test.lead@example.com",
      };
      if (type === "META_ADS") payload = { ...payload, name: "Siddhant Deshmukh (Meta Test)", adCampaign: "Test Campaign" };
      if (type === "WHATSAPP") payload = { senderName: "Tanvi Verma (WhatsApp Test)", phone: payload.phone, message: "Hi, can you share the fee structure?" };

      const res = await fetch(`${path}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Test lead failed.");
      setMessage({ text: `Test lead sent for ${INTEGRATION_TYPE_META[type].label}: ${data.message || data.result || "success"}`, type: "success" });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Test lead failed.", type: "error" });
    } finally {
      setTestingType(null);
    }
  };

  const handleSyncSheets = async () => {
    setTestingType("GOOGLE_SHEETS");
    setMessage(null);
    try {
      const token = byType.get("GOOGLE_SHEETS")?.webhookSecret || secrets["GOOGLE_SHEETS"];
      const res = await fetch(`/api/webhooks/google-sheets?token=${encodeURIComponent(token)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sheets sync failed");
      setMessage({ text: data.message, type: "success" });
      fetchIntegrations();
    } catch (err: any) {
      setMessage({ text: err?.message || "Google Sheets sync failed", type: "error" });
    } finally {
      setTestingType(null);
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setIsImporting(true);
    setCsvResult(null);
    setMessage(null);
    try {
      const csvText = await csvFile.text();
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed.");
      setCsvResult(data);
      setMessage({ text: `Imported ${data.created} lead(s) from ${data.totalRows} row(s).`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err?.message || "CSV import failed.", type: "error" });
    } finally {
      setIsImporting(false);
    }
  };

  const renderChannelCard = (type: IntegrationType) => {
    const meta = INTEGRATION_TYPE_META[type];
    const record = byType.get(type);
    const Icon = CHANNEL_ICONS[type];
    const isExpanded = expandedType === type;
    const isConnected = !!record;
    const webhookUrl = `${origin}${webhookPathFor(type)}?token=${secrets[type] || ""}`;

    return (
      <Card key={type} className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedType(isExpanded ? null : type)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">{meta.label}</h3>
              <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }
            >
              {isConnected ? "Connected" : "Not connected"}
            </Badge>
            {isConnected && (
              <span className="text-2xs text-muted-foreground font-medium hidden sm:inline">
                {record!.leadsImported} leads
              </span>
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border p-4 space-y-4 text-xs">
            {type === "CSV_IMPORT" ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Upload a CSV with columns <code className="text-foreground">name, phone, email, program, notes</code>. A
                  <code className="text-foreground"> phone</code> column is required.
                </p>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  <Button onClick={handleCsvImport} isDisabled={!csvFile || isImporting}>
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    <span>Import</span>
                  </Button>
                </div>
                {csvResult && (
                  <div className="rounded-lg border border-border p-3 space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Rows processed</span><span className="text-foreground font-medium">{csvResult.totalRows}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-emerald-400 font-medium">{csvResult.created}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Duplicates flagged</span><span className="text-amber-400 font-medium">{csvResult.duplicates}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Skipped</span><span className="text-rose-400 font-medium">{csvResult.skipped}</span></div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Webhook URL
                  </label>
                  <div className="flex items-center gap-2">
                    <Input type="text" readOnly value={webhookUrl} className="flex-1 font-mono text-xs" />
                    <Button variant="outline" onClick={() => copyToClipboard(webhookUrl, `${type}-url`)}>
                      {copiedKey === `${type}-url` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {type === "GOOGLE_SHEETS" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Sheet ID</label>
                      <Input value={sheetId} onChange={(e) => setSheetId(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Range</label>
                      <Input value={sheetRange} onChange={(e) => setSheetRange(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Webhook Secret / Token</label>
                  <Input
                    value={secrets[type] || ""}
                    onChange={(e) => setSecrets((prev) => ({ ...prev, [type]: e.target.value }))}
                    className="font-mono text-xs"
                    placeholder="Leave blank to auto-generate on save"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() =>
                      handleSave(type, type === "GOOGLE_SHEETS" ? { sheetId, sheetRange } : undefined)
                    }
                    isDisabled={savingType === type}
                  >
                    {savingType === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save</span>
                  </Button>
                  {type === "GOOGLE_SHEETS" ? (
                    <Button variant="outline" onClick={handleSyncSheets} isDisabled={testingType === type}>
                      {testingType === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Sync Now</span>
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => handleSendTestLead(type)} isDisabled={testingType === type}>
                      {testingType === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      <span>Send Test Lead</span>
                    </Button>
                  )}
                </div>

                {record?.lastSyncAt && (
                  <p className="text-2xs text-muted-foreground">
                    Last synced: {new Date(record.lastSyncAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <Breadcrumb className="mb-1.5">
            <BreadcrumbList className="text-2xs text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink render={(props: any) => <Link href="/settings" {...props} />}>Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground font-medium">Lead Channels</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-primary" />
            Lead Channel Integrations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Connect every channel leads come in from — ads, messaging, forms, spreadsheets, and file imports — all landing in the same pipeline.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchIntegrations} isDisabled={isLoading} title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={message.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          <AlertDescription className="text-xs font-medium text-inherit">{message.text}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-xs">Loading integration configurations...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(categorized.entries()).map(([category, types]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {INTEGRATION_CATEGORY_LABELS[category]}
              </h2>
              <div className="space-y-2.5">{types.map(renderChannelCard)}</div>
            </div>
          ))}

          {/* Enterprise ERP Sync — separate concern (student data sync, not lead ingestion) */}
          <Card className="space-y-5 border-blue-500/30 bg-blue-500/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Enterprise ERP Synchronization</h2>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Automated outbound enrolled student push with field mapping & inbound webhook for fees, attendance, and exam grades.
                  </p>
                </div>
              </div>
              <Link href="/settings/integrations/erp" className={buttonVariants({ className: "gap-1.5" })}>
                <span>Configure ERP & Field Mapping</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
