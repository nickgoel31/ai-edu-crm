"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Save,
  Palette,
  Wallet,
  Network,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BranchRef {
  id: string;
  name: string;
  slug: string;
}

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orgId, setOrgId] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [parent, setParent] = useState<BranchRef | null>(null);
  const [branches, setBranches] = useState<BranchRef[]>([]);

  const [branchSlugInput, setBranchSlugInput] = useState("");
  const [showLinkConfirm, setShowLinkConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/organization");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load organization settings.");

      setOrgId(data.organization.id);
      setSlug(data.organization.slug);
      setName(data.organization.name || "");
      setBrandLogoUrl(data.organization.brandLogoUrl || "");
      setBrandPrimaryColor(data.organization.brandPrimaryColor || "");
      setUpiVpa(data.organization.upiVpa || "");
      setParent(data.parent);
      setBranches(data.branches || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brandLogoUrl, brandPrimaryColor, upiVpa }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSuccess("Organization settings saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const linkBranch = async () => {
    setError(null);
    setSuccess(null);
    if (!branchSlugInput.trim()) return;
    setLinking(true);
    try {
      const res = await fetch("/api/settings/organization/link-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: branchSlugInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link branch.");
      setSuccess(`Linked "${data.branch.name}" as a branch.`);
      setBranchSlugInput("");
      setShowLinkConfirm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground m-8" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Organization Profile</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your organization's name, white-label branding, payment details, and franchise
          linking.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span>Basic Info</span>
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Organization Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Coaching Center" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Slug (read-only)</Label>
            <Input value={slug} disabled className="font-mono text-xs opacity-60" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <span>Branding</span>
          </h2>
          <p className="text-2xs text-muted-foreground">
            Applied to your login and portal pages. Branch orgs can set their own, independent of
            the franchise HQ's.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Logo URL</Label>
            <Input
              value={brandLogoUrl}
              onChange={(e) => setBrandLogoUrl(e.target.value)}
              placeholder="https://cdn.example.com/logo.png"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Primary Brand Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(brandPrimaryColor) ? brandPrimaryColor : "#2563eb"}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={brandPrimaryColor}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                placeholder="#2563eb"
                className="font-mono text-xs flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span>Payments</span>
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">UPI VPA</Label>
            <Input
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              placeholder="coaching@okhdfcbank"
              className="font-mono text-xs"
            />
            <p className="text-2xs text-muted-foreground">
              Used to build UPI payment deep links for fee reminders and referral payouts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <Button onClick={save} isDisabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Changes</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Network className="w-4 h-4 text-muted-foreground" />
            <span>Franchise</span>
          </h2>

          {parent ? (
            <p className="text-xs text-muted-foreground">
              This organization is a <span className="font-semibold text-foreground">branch</span> of{" "}
              <span className="font-semibold text-foreground">{parent.name}</span> (slug:{" "}
              <code className="font-mono">{parent.slug}</code>). Its roll-up dashboard is managed from
              the HQ org.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                This organization's slug is <code className="font-mono font-semibold">{slug}</code>.
                Other organizations become your branches by linking to this slug — an org becomes a
                franchise HQ once at least one branch is linked, and can then view a roll-up at{" "}
                <Link href="/franchise" className="text-primary hover:underline">
                  /franchise
                </Link>
                .
              </p>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">
                  Linked Branches ({branches.length})
                </Label>
                {branches.length === 0 ? (
                  <p className="text-2xs text-muted-foreground italic">No branches linked yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {branches.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between text-xs bg-muted/40 border border-border rounded-lg px-3 py-2"
                      >
                        <span className="font-medium text-foreground">{b.name}</span>
                        <code className="font-mono text-2xs text-muted-foreground">{b.slug}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs text-muted-foreground">Link a Branch by Slug</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={branchSlugInput}
                    onChange={(e) => setBranchSlugInput(e.target.value)}
                    placeholder="branch-org-slug"
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    variant="outline"
                    isDisabled={!branchSlugInput.trim() || linking}
                    onClick={() => setShowLinkConfirm(true)}
                  >
                    Link as Branch
                  </Button>
                </div>

                {showLinkConfirm && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="space-y-2">
                      <p>
                        <strong>This is irreversible from here.</strong> Linking{" "}
                        <code className="font-mono">{branchSlugInput.trim()}</code> will make it a
                        branch of this organization — its admins will start appearing in your
                        franchise roll-up. This directly modifies the other organization's record;
                        make sure you have their consent before proceeding.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          isDisabled={linking}
                          onClick={linkBranch}
                        >
                          {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          <span>Yes, link this branch</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={linking}
                          onClick={() => setShowLinkConfirm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
