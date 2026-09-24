"use client";

import React from "react";
import { CustomFieldDefinition, CustomFieldType } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface CustomFieldsRendererProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  columns?: 1 | 2;
}

export function CustomFieldsRenderer({
  definitions,
  values,
  onChange,
  errors = {},
  disabled = false,
  className = "",
  columns = 2,
}: CustomFieldsRendererProps) {
  if (!definitions || definitions.length === 0) {
    return null;
  }

  const gridColsClass = columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 pb-1 border-b border-border/50">
        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-zinc-200 tracking-wide uppercase">
          Custom Attributes
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/60 text-zinc-400">
          {definitions.length} field{definitions.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className={`grid ${gridColsClass} gap-3.5`}>
        {definitions.map((def) => {
          const rawValue = values[def.fieldKey] ?? values[def.id];
          const errorMsg = errors[def.fieldKey] || errors[def.id];

          return (
            <div key={def.id} className="space-y-1.5">
              {def.fieldType !== CustomFieldType.BOOLEAN && (
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`cf-${def.fieldKey}`}
                    className="text-xs font-medium text-zinc-300 flex items-center gap-1"
                  >
                    <span>{def.label}</span>
                    {def.required && <span className="text-rose-400">*</span>}
                  </Label>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {def.fieldType.toLowerCase()}
                  </span>
                </div>
              )}

              {/* Render input based on fieldType */}
              {def.fieldType === CustomFieldType.TEXT && (
                <Input
                  id={`cf-${def.fieldKey}`}
                  type="text"
                  disabled={disabled}
                  value={rawValue !== undefined && rawValue !== null ? String(rawValue) : ""}
                  onChange={(e) => onChange(def.fieldKey, e.target.value)}
                  placeholder={`Enter ${def.label.toLowerCase()}...`}
                  className={errorMsg ? "border-rose-500" : ""}
                />
              )}

              {def.fieldType === CustomFieldType.NUMBER && (
                <Input
                  id={`cf-${def.fieldKey}`}
                  type="number"
                  disabled={disabled}
                  value={rawValue !== undefined && rawValue !== null ? rawValue : ""}
                  onChange={(e) =>
                    onChange(
                      def.fieldKey,
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  placeholder={`Enter number for ${def.label.toLowerCase()}...`}
                  className={errorMsg ? "border-rose-500" : ""}
                />
              )}

              {def.fieldType === CustomFieldType.DATE && (
                <Input
                  id={`cf-${def.fieldKey}`}
                  type="date"
                  disabled={disabled}
                  value={
                    rawValue
                      ? typeof rawValue === "string"
                        ? rawValue.split("T")[0]
                        : new Date(rawValue).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => onChange(def.fieldKey, e.target.value || null)}
                  className={errorMsg ? "border-rose-500" : ""}
                />
              )}

              {def.fieldType === CustomFieldType.SELECT && (
                <Select
                  isDisabled={disabled}
                  selectedKey={rawValue !== undefined && rawValue !== null ? String(rawValue) : ""}
                  onSelectionChange={(key) => onChange(def.fieldKey, key || null)}
                >
                  <SelectTrigger id={`cf-${def.fieldKey}`} className={errorMsg ? "border-rose-500" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.options || []).map((option) => (
                      <SelectItem key={option} id={option} textValue={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {def.fieldType === CustomFieldType.BOOLEAN && (
                <div className="flex items-center gap-2.5 pt-2">
                  <Checkbox
                    id={`cf-${def.fieldKey}`}
                    isDisabled={disabled}
                    isSelected={Boolean(rawValue)}
                    onChange={(checked) => onChange(def.fieldKey, checked)}
                  />
                  <Label
                    htmlFor={`cf-${def.fieldKey}`}
                    className="text-xs font-medium text-zinc-300 cursor-pointer flex items-center gap-1"
                  >
                    <span>{def.label}</span>
                    {def.required && <span className="text-rose-400">*</span>}
                  </Label>
                </div>
              )}

              {errorMsg && (
                <p className="text-[11px] text-rose-400 mt-0.5">{errorMsg}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
