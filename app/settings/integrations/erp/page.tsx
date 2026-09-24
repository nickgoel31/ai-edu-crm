"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Save,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  ArrowRight,
  Database,
  Send,
  DownloadCloud,
  Code,
  Eye,
  X,
} from "lucide-react";
import { transformStudentForErp } from "@/lib/erp-sync";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

interface CrmFieldOption {
  key: string;
  label: string;
  type: string;
}

interface ErpSyncLogItem {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  action: string;
  status: "SUCCESS" | "FAILED";
  entityId: string | null;
  payload: any;
  response: any;
  errorMessage: string | null;
  createdAt: string;
}

export default function ErpSettingsPage() {
  const { data: session } = useSession();
  const isReadonly = session?.user?.role === "READONLY";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Integration settings state
  const [isEnabled, setIsEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [externalIdField, setExternalIdField] = useState("externalId");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [availableFields, setAvailableFields] = useState<CrmFieldOption[]>([]);
  const [defaultMapping, setDefaultMapping] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<ErpSyncLogItem[]>([]);
  const [sampleStudent, setSampleStudent] = useState<any>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"outbound" | "inbound" | "logs">("outbound");
  const [logFilter, setLogFilter] = useState<"ALL" | "OUTBOUND" | "INBOUND" | "FAILED">("ALL");
  const [selectedLog, setSelectedLog] = useState<ErpSyncLogItem | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // New mapping row inputs
  const [newCrmField, setNewCrmField] = useState("");
  const [newErpKey, setNewErpKey] = useState("");

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const fetchErpSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings/integrations/erp");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load ERP settings");

      setIsEnabled(data.integration.isEnabled);
      setWebhookSecret(data.integration.webhookSecret);
      setEndpointUrl(data.integration.config.endpointUrl || "");
      setAuthHeader(data.integration.config.authHeader || "");
      setExternalIdField(data.integration.config.externalIdField || "externalId");
      setFieldMapping(data.integration.config.fieldMapping || data.defaultMapping || {});
      setAvailableFields(data.availableFields || []);
      setDefaultMapping(data.defaultMapping || {});
      setLogs(data.recentLogs || []);
      setSampleStudent(data.sampleStudent || null);
    } catch (err: any) {
      setToastMessage({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErpSettings();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSave = async (overrides?: Partial<{ isEnabled: boolean; regenerateToken: boolean }>) => {
    if (isReadonly) return;
    setIsSaving(true);
    setToastMessage(null);

    try {
      const payload = {
        isEnabled: overrides?.isEnabled !== undefined ? overrides.isEnabled : isEnabled,
        endpointUrl,
        authHeader,
        externalIdField,
        fieldMapping,
        regenerateToken: overrides?.regenerateToken || false,
      };

      const res = await fetch("/api/settings/integrations/erp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save ERP configuration");

      if (data.integration.webhookSecret) {
        setWebhookSecret(data.integration.webhookSecret);
      }
      setIsEnabled(data.integration.isEnabled);
      setToastMessage({ text: "ERP configuration successfully saved!", type: "success" });
    } catch (err: any) {
      setToastMessage({ text: err.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPush = async () => {
    if (isReadonly) return;
    setIsTesting(true);
    setTestResult(null);
    setToastMessage(null);

    try {
      const res = await fetch("/api/settings/integrations/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        setToastMessage({ text: "Outbound test push succeeded!", type: "success" });
      } else {
        setToastMessage({
          text: data.testResult?.error || data.error || "Outbound test push failed.",
          type: "error",
        });
      }
      // Refresh logs
      fetchErpSettings();
    } catch (err: any) {
      setToastMessage({ text: err.message, type: "error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleMappingChange = (crmKey: string, erpKey: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [crmKey]: erpKey,
    }));
  };

  const handleRemoveMapping = (crmKey: string) => {
    setFieldMapping((prev) => {
      const updated = { ...prev };
      delete updated[crmKey];
      return updated;
    });
  };

  const handleAddMapping = () => {
    if (!newCrmField.trim() || !newErpKey.trim()) return;
    setFieldMapping((prev) => ({
      ...prev,
      [newCrmField.trim()]: newErpKey.trim(),
    }));
    setNewCrmField("");
    setNewErpKey("");
  };

  const handleResetMapping = () => {
    setFieldMapping(defaultMapping);
    setToastMessage({ text: "Field mapping reset to default configuration.", type: "success" });
  };

  // Compute live preview payload using the sample student
  const previewPayload = useMemo(() => {
    if (!sampleStudent) return {};
    return transformStudentForErp(sampleStudent, fieldMapping);
  }, [sampleStudent, fieldMapping]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logFilter === "ALL") return true;
      if (logFilter === "OUTBOUND") return log.direction === "OUTBOUND";
      if (logFilter === "INBOUND") return log.direction === "INBOUND";
      if (logFilter === "FAILED") return log.status === "FAILED";
      return true;
    });
  }, [logs, logFilter]);

  const inboundWebhookUrl = origin ? `${origin}/api/webhooks/erp-sync/${webhookSecret}` : `/api/webhooks/erp-sync/${webhookSecret}`;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">Loading ERP synchronization settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <Alert
          variant={toastMessage.type === "error" ? "destructive" : "default"}
          className={
            toastMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center justify-between"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400 flex items-center justify-between"
          }
        >
          <div className="flex items-center space-x-2.5">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <AlertTitle className="text-xs font-medium text-inherit">{toastMessage.text}</AlertTitle>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs font-semibold"
          >
            ✕
          </button>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <Breadcrumb className="mb-1.5">
            <BreadcrumbList className="text-2xs text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink render={(props: any) => <Link href="/settings" {...props} />}>
                  Settings
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink render={(props: any) => <Link href="/settings/integrations" {...props} />}>
                  Integrations
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground font-medium">ERP Sync</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Database className="w-6 h-6 text-primary" />
            Enterprise ERP Integration
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configurable bi-directional synchronization with institutional ERPs (SAP, Ellucian, Campus365, Fedena).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
            <span className="text-xs text-muted-foreground">Sync:</span>
            <Button
              variant={isEnabled ? "default" : "secondary"}
              size="sm"
              isDisabled={isReadonly || isSaving}
              onClick={() => {
                const next = !isEnabled;
                setIsEnabled(next);
                handleSave({ isEnabled: next });
              }}
              className={isEnabled ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
              <span>{isEnabled ? "ACTIVE" : "DISABLED"}</span>
            </Button>
          </div>

          <Button onClick={() => handleSave()} isDisabled={isReadonly || isSaving}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as "outbound" | "inbound" | "logs")}
      >
        <TabsList variant="line" className="border-b border-border rounded-none w-full justify-start h-auto p-0">
          <TabsTrigger id="outbound" className="py-2 px-3 gap-2 rounded-none data-selected:border-b-2 data-selected:border-primary">
            <Send className="w-3.5 h-3.5" />
            <span>Outbound Push & Field Mapping</span>
          </TabsTrigger>
          <TabsTrigger id="inbound" className="py-2 px-3 gap-2 rounded-none data-selected:border-b-2 data-selected:border-primary">
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Inbound Webhook (ERP → CRM)</span>
          </TabsTrigger>
          <TabsTrigger id="logs" className="py-2 px-3 gap-2 rounded-none data-selected:border-b-2 data-selected:border-primary">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Activity Log</span>
            <Badge variant="secondary">{logs.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OUTBOUND PUSH & FIELD MAPPING */}
        <TabsContent id="outbound" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 spans): Config & Mapper */}
            <div className="lg:col-span-2 space-y-6">
              {/* Endpoint Connection Settings */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">ERP Endpoint Connection</h2>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      When a Student reaches the <strong className="text-foreground">ENROLLED</strong> stage, CRM automatically sends their dossier here.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestPush}
                    isDisabled={isReadonly || isTesting || !endpointUrl.trim()}
                    className="text-blue-400 hover:text-blue-300 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20"
                  >
                    {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Test Outbound Push</span>
                  </Button>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Client ERP Webhook URL <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      type="url"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      disabled={isReadonly}
                      placeholder="https://erp.clientuniversity.edu/api/v1/admissions/sync"
                      className="font-mono text-xs"
                    />
                    <p className="text-2xs text-muted-foreground">
                      HTTP POST endpoint on your student information system or API gateway.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Authorization Header (Optional)
                      </label>
                      <Input
                        type="text"
                        value={authHeader}
                        onChange={(e) => setAuthHeader(e.target.value)}
                        disabled={isReadonly}
                        placeholder="Bearer sec_erp_token_xyz"
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        ERP Student ID Field Key
                      </label>
                      <Input
                        type="text"
                        value={externalIdField}
                        onChange={(e) => setExternalIdField(e.target.value)}
                        disabled={isReadonly}
                        placeholder="student_id"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Field Mapping Configuration */}
              <Card className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Configurable Field Mapping</h2>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      Map CRM student attributes to your ERP system's expected JSON payload schema.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetMapping}
                    disabled={isReadonly}
                    className="text-2xs text-muted-foreground hover:text-foreground font-semibold underline self-start sm:self-auto"
                  >
                    Reset to Defaults
                  </button>
                </div>

                {/* Mapper Table */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table aria-label="Field mapping">
                    <TableHeader>
                      <TableRow>
                        <TableHead>CRM Student Field</TableHead>
                        <TableHead className="w-8 text-center">→</TableHead>
                        <TableHead>Target ERP Payload Key</TableHead>
                        <TableHead className="w-12 text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(fieldMapping).map(([crmField, erpKey]) => {
                        const fieldMeta = availableFields.find((f) => f.key === crmField);
                        return (
                          <TableRow key={crmField}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground font-mono text-xs">
                                  {crmField}
                                </span>
                                {fieldMeta && (
                                  <span className="text-2xs text-muted-foreground">
                                    ({fieldMeta.label})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                value={erpKey}
                                onChange={(e) => handleMappingChange(crmField, e.target.value)}
                                disabled={isReadonly}
                                placeholder="erp_field_name"
                                className="font-mono text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemoveMapping(crmField)}
                                isDisabled={isReadonly}
                                title="Delete Mapping"
                                className="text-muted-foreground hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Add new mapping row */}
                  <div className="p-3 bg-card border-t border-border flex flex-col sm:flex-row items-center gap-2.5">
                    <select
                      value={newCrmField}
                      onChange={(e) => setNewCrmField(e.target.value)}
                      disabled={isReadonly}
                      className="w-full sm:w-1/2 px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring/40 bg-card text-foreground"
                    >
                      <option value="">Select CRM Field to map...</option>
                      {availableFields
                        .filter((f) => !fieldMapping[f.key])
                        .map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.key} — {f.label}
                          </option>
                        ))}
                    </select>

                    <Input
                      type="text"
                      value={newErpKey}
                      onChange={(e) => setNewErpKey(e.target.value)}
                      disabled={isReadonly}
                      placeholder="Target ERP key (e.g. roll_no)"
                      className="w-full sm:w-1/2 font-mono text-xs"
                    />

                    <Button
                      onClick={handleAddMapping}
                      isDisabled={isReadonly || !newCrmField || !newErpKey.trim()}
                      className="w-full sm:w-auto shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Mapping</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column (1 span): Live Preview & Test Drawer */}
            <div className="space-y-6">
              {/* Live Payload Preview */}
              <Card className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-semibold text-foreground">Live Payload Preview</h3>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Real-time</Badge>
                </div>
                <p className="text-2xs text-muted-foreground">
                  This exact JSON structure is posted to your ERP webhook when an enrollment completes.
                </p>

                <div className="bg-[#0a0a0a] border border-border text-foreground/90 p-3.5 rounded-lg font-mono text-xs overflow-x-auto max-h-[380px]">
                  <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
                </div>

                <div className="text-2xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
                  💡 <strong>Tip:</strong> If the ERP responds with <code>{"{ externalId: '...' }"}</code> or{" "}
                  <code>{"{ student_id: '...' }"}</code>, CRM automatically saves it to the student profile.
                </div>
              </Card>

              {/* Test Result Box */}
              {testResult && (
                <Card
                  className={`space-y-3 ${
                    testResult.success
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/5 text-rose-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      Test Push Result: {testResult.success ? "HTTP 200 OK" : `Failed`}
                    </h4>
                    {testResult.testResult?.durationMs && (
                      <span className="text-2xs font-mono">
                        {testResult.testResult.durationMs}ms
                      </span>
                    )}
                  </div>

                  <div className="bg-[#0a0a0a] p-3 rounded-lg border border-border font-mono text-xs overflow-x-auto max-h-[200px] text-foreground">
                    <pre>{JSON.stringify(testResult.testResult?.response || testResult, null, 2)}</pre>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: INBOUND WEBHOOK (ERP → CRM) */}
        <TabsContent id="inbound" className="mt-5">
          <div className="space-y-6 max-w-4xl">
            <Card className="space-y-4">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-foreground">Inbound Webhook Endpoint</h2>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Configure your ERP to send fees, attendance logs, and exam marks to this secure endpoint.
                </p>
              </div>

              {/* Inbound URL Card */}
              <div className="space-y-3 bg-muted/40 border border-border p-4 rounded-lg">
                <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Inbound Webhook Target URL
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={inboundWebhookUrl}
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    onClick={() => handleCopy(inboundWebhookUrl, "url")}
                  >
                    {copiedKey === "url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy URL</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-2xs text-muted-foreground">
                  <span>
                    Organization Token: <code className="font-mono font-bold text-foreground">{webhookSecret}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSave({ regenerateToken: true })}
                    disabled={isReadonly || isSaving}
                    className="text-primary hover:underline font-semibold transition"
                  >
                    Regenerate Token
                  </button>
                </div>
              </div>

              {/* Inbound Payload Samples */}
              <div className="space-y-3.5 pt-2">
                <h3 className="text-xs font-semibold text-foreground">Supported Inbound JSON Payloads</h3>

                {/* Sample 1: Fee Payment */}
                <div className="border border-border rounded-lg p-3.5 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">1. Fee Installment Update</span>
                    <span className="text-2xs font-mono bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded border border-blue-500/25">
                      POST /api/webhooks/erp-sync/[orgToken]
                    </span>
                  </div>
                  <div className="bg-[#0a0a0a] text-foreground/90 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-border">
                    <pre>{`{
  "externalId": "ERP-2026-9901",
  "fee": {
    "installmentNumber": 1,
    "amount": 25000,
    "status": "PAID",
    "dueDate": "2026-09-30"
  }
}`}</pre>
                  </div>
                </div>

                {/* Sample 2: Attendance */}
                <div className="border border-border rounded-lg p-3.5 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">2. Attendance Metrics Update</span>
                    <span className="text-2xs font-mono bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded border border-blue-500/25">
                      POST /api/webhooks/erp-sync/[orgToken]
                    </span>
                  </div>
                  <div className="bg-[#0a0a0a] text-foreground/90 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-border">
                    <pre>{`{
  "externalId": "ERP-2026-9901",
  "attendance": {
    "totalClasses": 60,
    "attendedClasses": 56,
    "percentage": 93.3,
    "lastAttended": "2026-09-12"
  }
}`}</pre>
                  </div>
                </div>

                {/* Sample 3: Exam Results */}
                <div className="border border-border rounded-lg p-3.5 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">3. Exam Results & Grades</span>
                    <span className="text-2xs font-mono bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded border border-blue-500/25">
                      POST /api/webhooks/erp-sync/[orgToken]
                    </span>
                  </div>
                  <div className="bg-[#0a0a0a] text-foreground/90 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-border">
                    <pre>{`{
  "externalId": "ERP-2026-9901",
  "examResults": [
    { "subject": "Electric Motors & Sensors", "score": 92, "grade": "A+", "status": "PASSED" },
    { "subject": "High Voltage Safety", "score": 88, "grade": "A", "status": "PASSED" }
  ]
}`}</pre>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: SYNC ACTIVITY LOG TABLE */}
        <TabsContent id="logs" className="mt-5">
          <div className="space-y-4">
            {/* Filter Ribbon */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={logFilter === "ALL" ? "default" : "secondary"}
                  onClick={() => setLogFilter("ALL")}
                >
                  All Events ({logs.length})
                </Button>
                <Button
                  size="sm"
                  variant={logFilter === "OUTBOUND" ? "default" : "secondary"}
                  onClick={() => setLogFilter("OUTBOUND")}
                >
                  Outbound Pushes ({logs.filter((l) => l.direction === "OUTBOUND").length})
                </Button>
                <Button
                  size="sm"
                  variant={logFilter === "INBOUND" ? "default" : "secondary"}
                  onClick={() => setLogFilter("INBOUND")}
                >
                  Inbound Webhooks ({logs.filter((l) => l.direction === "INBOUND").length})
                </Button>
                <Button
                  size="sm"
                  variant={logFilter === "FAILED" ? "default" : "secondary"}
                  onClick={() => setLogFilter("FAILED")}
                >
                  Failures ({logs.filter((l) => l.status === "FAILED").length})
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={fetchErpSettings}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </Button>
            </div>

            {/* Logs Table */}
            <Card className="p-0 overflow-hidden">
              <Table aria-label="Sync activity log">
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Event Action</TableHead>
                    <TableHead>Entity Identifier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        No synchronization log entries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-2xs font-mono text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.direction === "OUTBOUND"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                            }
                          >
                            {item.direction === "OUTBOUND" ? (
                              <>
                                <Send className="w-2.5 h-2.5" /> OUTBOUND
                              </>
                            ) : (
                              <>
                                <DownloadCloud className="w-2.5 h-2.5" /> INBOUND
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {item.action}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.entityId || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.status === "SUCCESS" ? "default" : "destructive"}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedLog(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Payload Modal */}
      <Dialog
        isOpen={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        showCloseButton={false}
        className="sm:max-w-2xl"
      >
        {selectedLog && (
          <>
            <DialogHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={selectedLog.status === "SUCCESS" ? "default" : "destructive"}>
                  {selectedLog.status}
                </Badge>
                <DialogTitle>
                  {selectedLog.direction} — {selectedLog.action}
                </DialogTitle>
              </div>
              <DialogClose variant="ghost" size="icon-sm">
                <X className="w-4 h-4" />
              </DialogClose>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto max-h-[60vh]">
              {selectedLog.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                  <strong>Error Message:</strong> {selectedLog.errorMessage}
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payload Sent / Received
                </h4>
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-xs overflow-x-auto max-h-[220px]">
                  <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                </div>
              </div>

              {selectedLog.response && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Response
                  </h4>
                  <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-xs overflow-x-auto max-h-[220px]">
                    <pre>{JSON.stringify(selectedLog.response, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose>Close</DialogClose>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}
