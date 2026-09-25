"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Download, AlertTriangle, Loader2, ShieldAlert, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DataPrivacyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [isExporting, setIsExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isErasing, setIsErasing] = useState(false);
  const [erasureResult, setErasureResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setIsExporting(true);
    window.location.href = "/api/settings/data-retention/export";
    setTimeout(() => setIsExporting(false), 1500);
  };

  const handleErase = async () => {
    setError(null);
    setIsErasing(true);
    try {
      const res = await fetch("/api/settings/data-retention/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSlug: confirmText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to erase organization data.");
      setErasureResult(data.deletedCounts);
      setConfirmText("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsErasing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Alert variant="destructive">
          <ShieldAlert className="w-4 h-4" />
          <AlertDescription>Only Organization Administrators can access data & privacy controls.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Data & Privacy</h1>
        <p className="text-xs text-muted-foreground mt-1">
          GDPR/DPDP data-portability export and right-to-erasure tooling for your organization's leads and students.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Export all personal data</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Downloads a JSON file of every lead and student your organization holds, including payments,
                documents, agent conversation transcripts, and activity history.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} isDisabled={isExporting}>
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export as JSON</span>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-destructive/15 text-destructive border border-destructive/25">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Permanently erase organization data</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deletes every lead, student, payment, document, and agent conversation transcript for this
                organization. This cannot be undone. Your account, users, agents, and audit trail are kept.
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {erasureResult ? (
            <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
              <Database className="w-4 h-4" />
              <AlertDescription className="text-emerald-400/90">
                Erased {erasureResult.leads} leads, {erasureResult.students} students, {erasureResult.payments}{" "}
                payments, {erasureResult.documents} documents, {erasureResult.conversations} conversations, and{" "}
                {erasureResult.activities} activity entries.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Type your organization's slug to confirm (visible in your account/organization URL)
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="your-org-slug"
                className="font-mono text-xs"
              />
              <Button
                variant="destructive"
                onClick={handleErase}
                isDisabled={isErasing || !confirmText.trim()}
              >
                {isErasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>Permanently erase all data</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
