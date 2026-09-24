"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ScoreBreakdownItem } from "@/types";
import { Flame, Sparkles, Snowflake, ChevronRight, TrendingUp, TrendingDown, Info } from "lucide-react";

interface ScoreBadgeProps {
  score: number;
  scoreBreakdown?: string | ScoreBreakdownItem[] | null;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({
  score = 0,
  scoreBreakdown,
  size = "sm",
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Normalize score between 0 and 100
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Parse breakdown
  let breakdownItems: ScoreBreakdownItem[] = [];
  if (Array.isArray(scoreBreakdown)) {
    breakdownItems = scoreBreakdown;
  } else if (typeof scoreBreakdown === "string") {
    try {
      breakdownItems = JSON.parse(scoreBreakdown);
    } catch {
      breakdownItems = [];
    }
  }

  // Tier categorization
  let tier: {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
    textStyle: string;
    borderStyle: string;
    dotStyle: string;
    bgHover: string;
  };

  if (normalizedScore >= 70) {
    tier = {
      label: "Hot",
      icon: Flame,
      badgeStyle: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      textStyle: "text-emerald-600 dark:text-emerald-400",
      borderStyle: "border-emerald-500/40",
      dotStyle: "bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
      bgHover: "group-hover:bg-emerald-500/20",
    };
  } else if (normalizedScore >= 40) {
    tier = {
      label: "Warm",
      icon: Sparkles,
      badgeStyle: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      textStyle: "text-amber-600 dark:text-amber-400",
      borderStyle: "border-amber-500/40",
      dotStyle: "bg-amber-500 dark:bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
      bgHover: "group-hover:bg-amber-500/20",
    };
  } else {
    tier = {
      label: "Cold",
      icon: Snowflake,
      badgeStyle: "bg-muted text-muted-foreground border-border",
      textStyle: "text-muted-foreground",
      borderStyle: "border-border",
      dotStyle: "bg-zinc-400 dark:bg-zinc-500",
      bgHover: "group-hover:bg-muted/80",
    };
  }

  const IconComponent = tier.icon;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-sm px-2.5 py-1 gap-2",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "group inline-flex items-center font-medium rounded-full border transition-all duration-150 cursor-pointer select-none",
          tier.badgeStyle,
          sizeClasses[size],
          className
        )}
      >
        <IconComponent className={cn(iconSizes[size], tier.textStyle)} />
        <span className="font-semibold tracking-tight">{normalizedScore}</span>
        {showLabel && (
          <span className="opacity-75 text-[10px] font-normal uppercase tracking-wider">
            {tier.label}
          </span>
        )}
      </div>

      {/* Hover Tooltip Breakdown */}
      {isHovered && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl text-left animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", tier.dotStyle)} />
              <span className="text-xs font-semibold text-foreground">
                {tier.label} Lead Score
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-bold", tier.textStyle)}>
                {normalizedScore}
              </span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>

          {/* Rules breakdown list */}
          <div className="mt-2.5 space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {breakdownItems.length > 0 ? (
              breakdownItems.map((item, idx) => {
                const isPos = item.points > 0;
                const isZero = item.points === 0;
                return (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 text-xs py-1 px-1.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-[11px] truncate">
                        {item.ruleName}
                      </div>
                      {item.reason && (
                        <div className="text-[10px] text-muted-foreground line-clamp-1">
                          {item.reason}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-mono font-semibold text-[11px] shrink-0",
                        isPos
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isZero
                          ? "text-muted-foreground"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {isPos ? `+${item.points}` : item.points}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-[11px] text-muted-foreground py-1.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Default baseline score applied (no custom scoring rules matched yet).</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Evaluated via scoring engine</span>
            <span className="font-mono text-muted-foreground">0 - 100 pt</span>
          </div>
        </div>
      )}
    </div>
  );
}
