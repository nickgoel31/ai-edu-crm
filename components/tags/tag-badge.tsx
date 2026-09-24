"use client";

import React from "react";
import { X } from "lucide-react";

interface TagBadgeProps {
  name: string;
  color?: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({
  name,
  color = "#3b82f6",
  size = "md",
  onRemove,
  className = "",
}: TagBadgeProps) {
  // Generate soft background and border with opacity from hex color
  const hex = color.startsWith("#") ? color : "#3b82f6";

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.2 gap-1 h-4.5"
      : "text-[11px] px-2 py-0.5 gap-1.5 h-5.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border transition-all select-none ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${hex}18`, // ~10% opacity
        borderColor: `${hex}40`,     // ~25% opacity
        color: hex,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hex }}
      />
      <span className="truncate max-w-[120px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          className="ml-0.5 -mr-0.5 rounded-sm hover:opacity-75 focus:outline-none cursor-pointer"
          style={{ color: hex }}
          aria-label={`Remove tag ${name}`}
        >
          <X className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </button>
      )}
    </span>
  );
}
