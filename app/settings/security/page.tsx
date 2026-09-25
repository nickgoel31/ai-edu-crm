"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Loader2, Copy, Check, KeyRound, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Step = "loading" | "disabled" | "scanning" | "confirming" | "backup-codes" | "enabled";

export default function SecurityPage() {
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/security/2fa/status")
      .then((r) => r.json())
      .then((d) => setStep(d.enabled ? "enabled" : "disabled"))
      .catch(() => setStep("disabled"));
  }, []);

  const startSetup = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/settings/security/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start setup.");
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("scanning");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCode = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/settings/security/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code.");
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const disable2fa = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/settings/security/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable.");
      setPassword("");
      setStep("disabled");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Security</h1>
        <p className="text-xs text-muted-foreground mt-1">Two-factor authentication for your account.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4">
          {step === "loading" && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}

          {step === "disabled" && (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-500/15 text-zinc-500 border border-zinc-500/25">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Two-factor authentication is off</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add an authenticator app (Google Authenticator, Authy, 1Password) as a second login step.
                  </p>
                </div>
              </div>
              <Button onClick={startSetup} isDisabled={isBusy}>
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Enable two-factor authentication</span>
              </Button>
            </>
          )}

          {step === "scanning" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
              {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="2FA QR code" className="w-40 h-40 rounded-lg border border-border" />}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{secret}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">6-digit code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              <Button onClick={confirmCode} isDisabled={isBusy || code.length !== 6}>
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Confirm & enable</span>
              </Button>
            </div>
          )}

          {step === "backup-codes" && (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Save these backup codes somewhere safe. Each works once if you lose access to your authenticator app.
                  They won't be shown again.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {backupCodes.map((c) => (
                  <div key={c} className="px-2.5 py-1.5 rounded bg-muted border border-border">
                    {c}
                  </div>
                ))}
              </div>
              <Button onClick={() => setStep("enabled")}>
                <Check className="w-3.5 h-3.5" />
                <span>I've saved these codes</span>
              </Button>
            </div>
          )}

          {step === "enabled" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Two-factor authentication is on</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You'll be asked for a code from your authenticator app on every sign-in.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Confirm your password to disable
                </Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
              </div>
              <Button variant="destructive" onClick={disable2fa} isDisabled={isBusy || !password}>
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Disable two-factor authentication</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
