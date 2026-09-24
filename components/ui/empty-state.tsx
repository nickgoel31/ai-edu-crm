import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface ActionConfig {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
  badge?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  badge,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`bg-card rounded-xl border border-border p-8 sm:p-12 text-center shadow-card max-w-xl mx-auto my-6 ${className}`}
    >
      {/* Icon with glowing badge aura */}
      <div className="relative w-14 h-14 mx-auto mb-4 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md" />
        <div className="relative w-14 h-14 bg-muted/40 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-sm">
          <Icon className="w-7 h-7" />
        </div>
      </div>

      {badge && (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
          {badge}
        </span>
      )}

      {/* Title */}
      <h3 className="text-base font-bold text-white tracking-tight font-heading">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98]"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98]"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#171922] hover:bg-[#20222f] text-zinc-300 hover:text-white text-xs font-semibold rounded-lg border border-[#2b2e3e] transition-all duration-150"
              >
                {secondaryAction.icon && <secondaryAction.icon className="w-3.5 h-3.5" />}
                <span>{secondaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#171922] hover:bg-[#20222f] text-zinc-300 hover:text-white text-xs font-semibold rounded-lg border border-[#2b2e3e] transition-all duration-150"
              >
                {secondaryAction.icon && <secondaryAction.icon className="w-3.5 h-3.5" />}
                <span>{secondaryAction.label}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
