"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SsoSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoDomain, setSsoDomain] = useState("");
  const [ssoEntryPoint, setSsoEntryPoint] = useState("");
  const [ssoIssuer, setSsoIssuer] = useState("");
  const [ssoCert, setSsoCert] = useState("");
  const [acsUrl, setAcsUrl] = useState("");
  const [spEntityId, setSpEntityId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sso");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load SSO settings.");
      setSsoEnabled(data.ssoEnabled);
      setSsoDomain(data.ssoDomain || "");
      setSsoEntryPoint(data.ssoEntryPoint || "");
      setSsoIssuer(data.ssoIssuer || "");
      setSsoCert(data.ssoCert || "");
      setAcsUrl(data.acsUrl);
      setSpEntityId(data.spEntityId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sso", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssoEnabled, ssoDomain, ssoEntryPoint, ssoIssuer, ssoCert }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSuccess("SSO configuration saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground m-8" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Single Sign-On (SAML)</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Let your team sign in with your institution's identity provider (Okta, Azure AD, Google Workspace, OneLogin).
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">1. Give these to your IdP admin</h2>
          {[
            { label: "ACS URL (Assertion Consumer Service)", value: acsUrl },
            { label: "SP Entity ID", value: spEntityId },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <Label className="text-2xs text-muted-foreground">{f.label}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-2xs font-mono bg-muted px-2 py-1.5 rounded truncate">{f.value}</code>
                <Button type="button" variant="outline" size="icon-sm" onClick={() => copy(f.value, f.label)}>
                  {copiedField === f.label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          ))}
          <a
            href={spEntityId}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-2xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View SP metadata XML
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">2. Enter what your IdP gives you</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email domain (routes users at this domain to SSO)</Label>
            <Input value={ssoDomain} onChange={(e) => setSsoDomain(e.target.value)} placeholder="yourcollege.edu" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">IdP Single Sign-On URL</Label>
            <Input
              value={ssoEntryPoint}
              onChange={(e) => setSsoEntryPoint(e.target.value)}
              placeholder="https://idp.example.com/sso/saml"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">IdP Issuer / Entity ID</Label>
            <Input
              value={ssoIssuer}
              onChange={(e) => setSsoIssuer(e.target.value)}
              placeholder="https://idp.example.com/metadata"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">IdP X.509 Certificate (PEM)</Label>
            <Textarea
              value={ssoCert}
              onChange={(e) => setSsoCert(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={6}
              className="font-mono text-2xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Enable SSO</h2>
              <p className="text-2xs text-muted-foreground mt-0.5">
                Users must already have an account (invite them from Settings → Users first — SSO never
                auto-creates accounts).
              </p>
            </div>
            <input type="checkbox" checked={ssoEnabled} onChange={(e) => setSsoEnabled(e.target.checked)} />
          </label>
          <Button onClick={save} isDisabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>Save SSO configuration</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
