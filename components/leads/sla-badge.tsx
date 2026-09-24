"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";

interface SlaBadgeProps {
  createdAt: string | Date;
  slaDueBy?: string | Date | null;
  firstContactAt?: string | Date | null;
  slaBreached?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function SlaBadge({
  createdAt,
  slaDueBy,
  firstContactAt,
  slaBreached,
  size = "xs",
  className,
}: SlaBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Update current time periodically for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // 1. If first contact was already logged, the SLA is fulfilled -> Hide badge
  if (firstContactAt) {
    return null;
  }

  // 2. If no SLA dueBy is specified, fall back
  if (!slaDueBy) {
    return null;
  }

  const createdTime = new Date(createdAt).getTime();
  const dueTime = new Date(slaDueBy).getTime();
  const totalWindowMs = Math.max(1, dueTime - createdTime);
  const remainingMs = dueTime - currentTime;
  const isOverdue = remainingMs <= 0 || slaBreached;

  // Calculate formatted text
  let labelText = "";
  let state: "ON_TRACK" | "URGENT" | "OVERDUE" = "ON_TRACK";

  if (isOverdue) {
    state = "OVERDUE";
    const overdueMinutes = Math.max(1, Math.floor(Math.abs(remainingMs) / (60 * 1000)));
    if (overdueMinutes < 60) {
      labelText = `Overdue ${overdueMinutes}m`;
    } else {
      const hours = (overdueMinutes / 60).toFixed(1);
      labelText = `Overdue ${hours.endsWith(".0") ? hours.slice(0, -2) : hours}h`;
    }
  } else {
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    const ratio = remainingMs / totalWindowMs;

    if (ratio <= 0.25) {
      state = "URGENT";
    } else {
      state = "ON_TRACK";
    }

    if (remainingMinutes < 60) {
      labelText = `${remainingMinutes}m left`;
    } else {
      const hours = (remainingMinutes / 60).toFixed(1);
      labelText = `${hours.endsWith(".0") ? hours.slice(0, -2) : hours}h left`;
    }
  }

  const styles = {
    ON_TRACK: {
      pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      icon: Clock,
      statusLabel: "SLA On Track",
    },
    URGENT: {
      pill: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse",
      dot: "bg-amber-500 dark:bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]",
      icon: AlertTriangle,
      statusLabel: "SLA Urgent (<25% window)",
    },
    OVERDUE: {
      pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25 font-semibold",
      dot: "bg-rose-500 dark:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]",
      icon: AlertCircle,
      statusLabel: "SLA Breached / Overdue",
    },
  }[state];

  const IconComponent = styles.icon;

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
          "inline-flex items-center rounded-full border transition-all duration-150 cursor-pointer select-none font-mono font-medium",
          styles.pill,
          sizeClasses[size],
          className
        )}
      >
        <IconComponent className={cn(iconSizes[size], "shrink-0")} />
        <span className="truncate">{labelText}</span>
      </div>

      {/* Tooltip on Hover */}
      {isHovered && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-60 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl text-left animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />
            <span className="text-xs font-semibold text-foreground">
              {styles.statusLabel}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Target Deadline:</span>
              <span className="font-mono text-foreground">
                {new Date(slaDueBy).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Inbound At:</span>
              <span className="font-mono text-foreground">
                {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={state === "OVERDUE" ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                {state === "OVERDUE" ? "Awaiting First Response (Late)" : "Awaiting First Response"}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
            Logging a Call, Note, Email, or AI Conversation fulfills this SLA.
          </div>
        </div>
      )}
    </div>
  );
}
