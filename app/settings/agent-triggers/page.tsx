"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import {
  AGENT_ROLE_META,
  AGENT_TRIGGER_EVENT_META,
  AGENT_TRIGGER_DEFAULT_SUGGESTIONS,
  AgentTriggerEvent,
} from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface AgentItem {
  id: string;
  name: string;
  role: string;
  channel: string;
  category: string;
  status: string;
}

interface TriggerItem {
  id: string;
  agentId: string;
  triggerEvent: string;
  conditions: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  agent: AgentItem;
}

const eventOptions = Object.entries(AGENT_TRIGGER_EVENT_META);

export default function AgentTriggersSettingsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [triggers, setTriggers] = useState<TriggerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formAgentId, setFormAgentId] = useState("");
  const [formEvent, setFormEvent] = useState<string>("");
  const [formConditions, setFormConditions] = useState<Record<string, number>>({});
  const [formEnabled, setFormEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, triggersRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agent-triggers"),
      ]);
      const agentsData = await agentsRes.json();
      const triggersData = await triggersRes.json();

      if (!agentsRes.ok) throw new Error(agentsData?.error || "Failed to load agents.");
      if (!triggersRes.ok) throw new Error(triggersData?.error || "Failed to load triggers.");

      setAgents(agentsData.agents || []);
      setTriggers(triggersData.triggers || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load agent triggers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const flash = (text: string) => {
    setSuccess(text);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Suggested defaults matched against seeded agents by role, filtered to ones
  // not already configured. Shown prominently only while the trigger list is empty.
  const suggestions = useMemo(() => {
    return AGENT_TRIGGER_DEFAULT_SUGGESTIONS.flatMap((s) => {
      const agent = agents.find((a) => a.role === s.role);
      if (!agent) return [];
      const alreadyConfigured = triggers.some(
        (t) => t.agentId === agent.id && t.triggerEvent === s.triggerEvent
      );
      if (alreadyConfigured) return [];
      return [{ ...s, agent }];
    });
  }, [agents, triggers]);

  const createTrigger = async (payload: {
    agentId: string;
    triggerEvent: string;
    conditions?: Record<string, number>;
    enabled?: boolean;
  }) => {
    const res = await fetch("/api/agent-triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to create trigger.");
    return data.trigger as TriggerItem;
  };

  const acceptSuggestion = async (suggestion: (typeof suggestions)[number]) => {
    setSavingKey(`suggestion_${suggestion.agent.id}_${suggestion.triggerEvent}`);
    setError(null);
    try {
      const trigger = await createTrigger({
        agentId: suggestion.agent.id,
        triggerEvent: suggestion.triggerEvent,
        conditions: suggestion.conditions,
        enabled: true,
      });
      setTriggers((prev) => [trigger, ...prev]);
      flash(`Trigger added for ${suggestion.agent.name}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to accept suggestion.");
    } finally {
      setSavingKey(null);
    }
  };

  const acceptAllSuggestions = async () => {
    setSavingKey("suggestion_all");
    setError(null);
    try {
      for (const s of suggestions) {
        const trigger = await createTrigger({
          agentId: s.agent.id,
          triggerEvent: s.triggerEvent,
          conditions: s.conditions,
          enabled: true,
        });
        setTriggers((prev) => [trigger, ...prev]);
      }
      flash("All suggested triggers added.");
    } catch (err: any) {
      setError(err?.message || "Failed to accept all suggestions.");
    } finally {
      setSavingKey(null);
    }
  };

  const toggleEnabled = async (trigger: TriggerItem) => {
    setSavingKey(trigger.id);
    setError(null);
    try {
      const res = await fetch(`/api/agent-triggers/${trigger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !trigger.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update trigger.");
      setTriggers((prev) => prev.map((t) => (t.id === trigger.id ? data.trigger : t)));
    } catch (err: any) {
      setError(err?.message || "Failed to toggle trigger.");
    } finally {
      setSavingKey(null);
    }
  };

  const deleteTrigger = async (trigger: TriggerItem) => {
    setSavingKey(trigger.id);
    setError(null);
    try {
      const res = await fetch(`/api/agent-triggers/${trigger.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete trigger.");
      setTriggers((prev) => prev.filter((t) => t.id !== trigger.id));
      flash("Trigger removed.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete trigger.");
    } finally {
      setSavingKey(null);
    }
  };

  const selectedEventMeta = formEvent ? AGENT_TRIGGER_EVENT_META[formEvent as AgentTriggerEvent] : null;

  const resetForm = () => {
    setFormAgentId("");
    setFormEvent("");
    setFormConditions({});
    setFormEnabled(true);
    setShowAddForm(false);
  };

  const handleEventChange = (event: string) => {
    setFormEvent(event);
    const meta = AGENT_TRIGGER_EVENT_META[event as AgentTriggerEvent];
    const defaults: Record<string, number> = {};
    meta?.conditionFields.forEach((f) => {
      defaults[f.key] = f.defaultValue;
    });
    setFormConditions(defaults);
  };

  const handleSubmitNewTrigger = async () => {
    if (!formAgentId || !formEvent) {
      setError("Select an agent and a trigger event.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trigger = await createTrigger({
        agentId: formAgentId,
        triggerEvent: formEvent,
        conditions: selectedEventMeta?.conditionFields.length ? formConditions : undefined,
        enabled: formEnabled,
      });
      setTriggers((prev) => [trigger, ...prev]);
      flash("Trigger created.");
      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to create trigger.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-primary" />
            Agent Triggers
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure CRM events that proactively fire an AI agent — e.g. an overdue payment triggering the
            Payment Reminder Agent — instead of waiting for the student to reach out.
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Trigger</span>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      {/* Suggested defaults */}
      {suggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Suggested Triggers
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Based on the roles configured for your agents. Accept as-is or add them individually — you can
              edit or remove any trigger later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s) => {
              const meta = AGENT_TRIGGER_EVENT_META[s.triggerEvent];
              const key = `suggestion_${s.agent.id}_${s.triggerEvent}`;
              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card/60"
                >
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">{s.agent.name}</span>
                    <span className="text-muted-foreground"> → {meta.label}</span>
                    {s.conditions && (
                      <span className="text-muted-foreground">
                        {" "}
                        (
                        {Object.entries(s.conditions)
                          .map(([k, v]) => `${k.replace("Threshold", "")}: ${v}`)
                          .join(", ")}
                        )
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acceptSuggestion(s)}
                    isDisabled={savingKey === key || savingKey === "suggestion_all"}
                  >
                    {savingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Accept"}
                  </Button>
                </div>
              );
            })}
            <div className="pt-2">
              <Button size="sm" onClick={acceptAllSuggestions} isDisabled={savingKey !== null}>
                {savingKey === "suggestion_all" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Accept All Suggestions</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add trigger form */}
      {showAddForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm text-foreground">New Trigger</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Pick an agent and the CRM event that should fire it.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={resetForm} aria-label="Cancel">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Agent</Label>
                <select
                  value={formAgentId}
                  onChange={(e) => setFormAgentId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({AGENT_ROLE_META[a.role as keyof typeof AGENT_ROLE_META]?.label || a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Trigger Event</Label>
                <select
                  value={formEvent}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
                >
                  <option value="">Select an event...</option>
                  {eventOptions.map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEventMeta && (
              <p className="text-2xs text-muted-foreground">{selectedEventMeta.description}</p>
            )}

            {/* Only show condition fields relevant to the selected event */}
            {selectedEventMeta && selectedEventMeta.conditionFields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {selectedEventMeta.conditionFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{field.label}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formConditions[field.key] ?? field.defaultValue}
                      onChange={(e) =>
                        setFormConditions((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                      }
                      className="w-full sm:w-40"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Switch isSelected={formEnabled} onChange={setFormEnabled} className="text-xs text-muted-foreground data-selected:text-foreground">
                Enabled
              </Switch>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitNewTrigger} isDisabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Trigger"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configured triggers table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">Configured Triggers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluated hourly by the /api/cron/evaluate-triggers job. Each entity only re-fires the same
            trigger after a 24-hour cooldown.
          </p>
        </div>

        {triggers.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Zap className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-xs font-bold text-zinc-200">No triggers configured yet</h4>
            <p className="text-[11px] text-zinc-500">
              Accept a suggestion above or create a new trigger to get started.
            </p>
          </div>
        ) : (
          <Table aria-label="Agent Triggers">
            <TableHeader>
              <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead>Agent</TableHead>
                <TableHead>Trigger Event</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {triggers.map((trigger) => {
                const meta = AGENT_TRIGGER_EVENT_META[trigger.triggerEvent as AgentTriggerEvent];
                const roleLabel =
                  AGENT_ROLE_META[trigger.agent?.role as keyof typeof AGENT_ROLE_META]?.label ||
                  trigger.agent?.role;
                return (
                  <TableRow key={trigger.id} className="border-border/60">
                    <TableCell>
                      <div className="font-semibold text-zinc-100">{trigger.agent?.name}</div>
                      <div className="text-[11px] text-zinc-500">{roleLabel}</div>
                    </TableCell>
                    <TableCell>{meta?.label || trigger.triggerEvent}</TableCell>
                    <TableCell className="text-zinc-400">
                      {Object.keys(trigger.conditions || {}).length === 0
                        ? "—"
                        : Object.entries(trigger.conditions)
                            .map(([k, v]) => `${k.replace("Threshold", "")}: ${v}`)
                            .join(", ")}
                    </TableCell>
                    <TableCell>
                      <Switch
                        isSelected={trigger.enabled}
                        onChange={() => toggleEnabled(trigger)}
                        isDisabled={savingKey === trigger.id}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteTrigger(trigger)}
                        isDisabled={savingKey === trigger.id}
                        aria-label="Delete trigger"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
