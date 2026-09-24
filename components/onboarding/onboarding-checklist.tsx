"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  actionLabel: string;
}

export function OnboardingChecklist() {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/onboarding/status");
      if (res.ok) {
        const data = await res.json();
        setDismissed(data.dismissed);
        setSteps(data.steps || []);
        setProgressPercent(data.progressPercent || 0);
        setCompletedCount(data.completedCount || 0);
      }
    } catch (err) {
      console.error("Failed to load onboarding checklist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await fetch("/api/onboarding/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch (err) {
      console.error("Failed to dismiss onboarding checklist:", err);
    }
  };

  if (loading || dismissed) {
    return null;
  }

  // If all completed, can either auto-hide or show complete banner
  const isComplete = completedCount === steps.length && steps.length > 0;

  return (
    <Card className="mb-6 p-0 gap-0">
      {/* Header Bar */}
      <div className="p-5 flex items-start justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Workspace Setup Checklist
              </h2>
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/25 bg-blue-500/10">
                {progressPercent}% Complete
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete these foundational steps to activate automated lead intake and admissions workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            aria-label="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progressPercent} aria-label="Onboarding progress" className="gap-0">
        <ProgressTrack className="h-1.5 rounded-none bg-muted/40">
          <ProgressIndicator className="bg-blue-600 duration-500 ease-out" />
        </ProgressTrack>
      </Progress>

      {/* Checklist Items */}
      {!collapsed && (
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-start gap-3.5 p-3.5 rounded-lg border transition-all ${
                  step.completed
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-card dark:bg-muted/40 border-border hover:border-border/80"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/60" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm font-semibold ${
                        step.completed ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {idx + 1}. {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {step.description}
                  </p>
                  <div className="mt-2.5">
                    <Link
                      href={step.href}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                        step.completed
                          ? "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                          : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-500/10 border border-blue-500/20"
                      }`}
                    >
                      <span>{step.completed ? "Review Config" : step.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isComplete && (
            <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                All initial setup milestones achieved! Your workspace is ready for live leads.
              </span>
              <button
                onClick={handleDismiss}
                className="text-zinc-500 hover:text-zinc-300 underline"
              >
                Hide checklist
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
