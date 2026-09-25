"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Layers, Bot, UserPlus, ArrowRight, Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AGENT_MARKETPLACE_ROLES, AGENT_ROLE_META } from "@/types";

const PIPELINE_PRESETS = [
  {
    id: "admissions",
    name: "Standard Admissions Pipeline",
    description: "New Inquiries → Qualified → Counseling → Enrolling → Lost/Closed. Good default for most institutions.",
    stages: undefined, // uses the API's built-in default set
  },
  {
    id: "upskilling",
    name: "Upskilling / Bootcamp Pipeline",
    description: "Enquiry → Demo Booked → Trial Attended → Fee Paid → Cohort Started → Lost.",
    stages: [
      { name: "Enquiry", color: "#3b82f6", mapsToBucket: "COLD" },
      { name: "Demo Booked", color: "#f59e0b", mapsToBucket: "WARM" },
      { name: "Trial Attended", color: "#f97316", mapsToBucket: "HOT" },
      { name: "Fee Paid", color: "#8b5cf6", mapsToBucket: "CONVERTING" },
      { name: "Cohort Started", color: "#10b981", mapsToBucket: "CONVERTING" },
      { name: "Lost", color: "#ef4444", mapsToBucket: "LOST", requiresReasonOnExit: true },
    ],
  },
];

const STEPS = ["Pipeline", "AI Agent", "Team", "Done"] as const;

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [pipelineCreated, setPipelineCreated] = useState(false);
  const [agentCreated, setAgentCreated] = useState(false);
  const [teamInvited, setTeamInvited] = useState(false);

  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState(AGENT_MARKETPLACE_ROLES[0]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const createPipeline = async (presetId: string) => {
    setError(null);
    setIsBusy(true);
    const preset = PIPELINE_PRESETS.find((p) => p.id === presetId)!;
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: preset.name, stages: preset.stages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create pipeline.");
      setPipelineCreated(true);
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const createAgent = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName.trim() || `${AGENT_ROLE_META[agentRole].label}`,
          role: agentRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent.");
      setAgentCreated(true);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const inviteTeammate = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          password: Math.random().toString(36).slice(2, 10) + "Aa1!",
          role: "COUNSELOR",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite teammate.");
      setTeamInvited(true);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const skip = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-sm">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up your workspace</h1>
        <p className="text-xs text-muted-foreground mt-1">Three quick steps — skip anything you'd rather do later.</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-bold ${
                i < step ? "bg-emerald-600 text-white" : i === step ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-emerald-600" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Pick a pipeline to start with</h2>
            </div>
            <div className="space-y-3">
              {PIPELINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => createPipeline(preset.id)}
                  disabled={isBusy}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  <div className="text-sm font-semibold text-foreground">{preset.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={skip} isDisabled={isBusy} className="w-full">
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Skip — I'll set this up later</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Create your first AI agent</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <select
                value={agentRole}
                onChange={(e) => setAgentRole(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {AGENT_MARKETPLACE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {AGENT_ROLE_META[role].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Agent name</Label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder={AGENT_ROLE_META[agentRole].label}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              You can fine-tune its system prompt, model, and channel setup afterward from the Agents page.
            </p>
            <Button onClick={createAgent} isDisabled={isBusy} className="w-full">
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              <span>Create agent</span>
            </Button>
            <Button variant="ghost" onClick={skip} isDisabled={isBusy} className="w-full">
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Invite your first counselor</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Priya Sharma" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Work email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="priya@yourcollege.edu"
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              They'll get a COUNSELOR account with a temporary password — reset it from Settings → Users any time.
            </p>
            <Button onClick={inviteTeammate} isDisabled={isBusy || !inviteEmail.trim()} className="w-full">
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Invite</span>
            </Button>
            <Button variant="ghost" onClick={skip} isDisabled={isBusy} className="w-full">
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="space-y-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">You're set up</h2>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>{pipelineCreated ? "✓ Pipeline created" : "— Pipeline skipped"}</li>
              <li>{agentCreated ? "✓ AI agent created" : "— AI agent skipped"}</li>
              <li>{teamInvited ? "✓ Teammate invited" : "— Teammate invite skipped"}</li>
            </ul>
            <p className="text-2xs text-muted-foreground">
              Next up: connect a lead source (WhatsApp, Meta Ads, website form) from{" "}
              <Link href="/settings/integrations" className="text-primary underline">
                Settings → Integrations
              </Link>
              .
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Go to dashboard</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
