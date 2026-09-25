"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, ShieldAlert, HelpCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChurnRiskBadgeProps {
  studentId: string;
  /** Pass a pre-fetched score to skip the client-side fetch entirely. */
  score?: number | null;
  className?: string;
}

/**
 * Compact, color-coded churn-risk indicator for a student:
 *   green  <30   "Low risk"
 *   amber  30-60 "Moderate risk"
 *   red    >60   "High risk"
 *   gray   null  "Not yet scored"
 *
 * If `score` isn't passed in, fetches it from GET /api/churn-risk/[studentId]
 * on mount (self-contained — safe to drop into any student-facing page).
 */
export function ChurnRiskBadge({ studentId, score: scoreProp, className }: ChurnRiskBadgeProps) {
  const [score, setScore] = useState<number | null | undefined>(scoreProp);
  const [isLoading, setIsLoading] = useState(scoreProp === undefined);

  useEffect(() => {
    if (scoreProp !== undefined) {
      setScore(scoreProp);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/churn-risk/${studentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setScore(data ? data.churnRiskScore : null);
        }
      })
      .catch(() => {
        if (!cancelled) setScore(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, scoreProp]);

  if (isLoading) {
    return (
      <Badge variant="outline" className={`gap-1 text-muted-foreground ${className || ""}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Churn Risk</span>
      </Badge>
    );
  }

  if (score === null || score === undefined) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 bg-muted/40 text-zinc-400 border-border ${className || ""}`}
      >
        <HelpCircle className="w-3 h-3" />
        <span>Not yet scored</span>
      </Badge>
    );
  }

  let colorClasses: string;
  let label: string;
  let Icon: typeof ShieldCheck;

  if (score < 30) {
    colorClasses = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    label = "Low churn risk";
    Icon = ShieldCheck;
  } else if (score <= 60) {
    colorClasses = "bg-amber-500/15 text-amber-400 border-amber-500/30";
    label = "Moderate churn risk";
    Icon = ShieldAlert;
  } else {
    colorClasses = "bg-rose-500/15 text-rose-400 border-rose-500/30";
    label = "High churn risk";
    Icon = AlertTriangle;
  }

  return (
    <Badge variant="outline" className={`gap-1 uppercase tracking-wider ${colorClasses} ${className || ""}`}>
      <Icon className="w-3 h-3" />
      <span>{label} ({score})</span>
    </Badge>
  );
}
