"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitMerge,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { HydratedDuplicateMatch, DuplicateMatchStatus } from "@/types";
import { DuplicateCompareCard } from "@/components/duplicates/duplicate-compare-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function LeadsDuplicatesPage() {
  const [activeTab, setActiveTab] = useState<"PENDING" | "MERGED" | "DISMISSED">("PENDING");
  const [matches, setMatches] = useState<HydratedDuplicateMatch[]>([]);
  const [counts, setCounts] = useState({ PENDING: 0, MERGED: 0, DISMISSED: 0, TOTAL: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/duplicates?entityType=LEAD&status=${activeTab}`);
      const data = await res.json();
      if (res.ok) {
        setMatches(data.duplicateMatches || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (err) {
      console.error("Failed to load duplicate matches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [activeTab]);

  const filteredMatches = matches.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pName = m.primaryEntity?.name?.toLowerCase() || "";
    const pPhone = m.primaryEntity?.phone?.toLowerCase() || "";
    const pEmail = m.primaryEntity?.email?.toLowerCase() || "";
    const dName = m.duplicateEntity?.name?.toLowerCase() || "";
    const dPhone = m.duplicateEntity?.phone?.toLowerCase() || "";
    const dEmail = m.duplicateEntity?.email?.toLowerCase() || "";
    return (
      pName.includes(q) ||
      pPhone.includes(q) ||
      pEmail.includes(q) ||
      dName.includes(q) ||
      dPhone.includes(q) ||
      dEmail.includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/leads"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Leads
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-300 font-medium">Duplicate Resolution</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-heading flex items-center gap-2.5">
            <GitMerge className="w-6 h-6 text-amber-400" />
            <span>Lead Deduplication Queue</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Review potential duplicate lead inquiries, compare field values, and merge records seamlessly.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchMatches}
          isDisabled={isLoading}
          className="gap-2 self-start sm:self-auto border-border/60 bg-[#171717]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#171717] border border-[#262626] rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("PENDING")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "PENDING"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Pending Review</span>
            {counts.PENDING > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px]">
                {counts.PENDING}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MERGED")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "MERGED"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Merged History</span>
            <span className="text-[10px] text-zinc-500 font-mono">({counts.MERGED})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("DISMISSED")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "DISMISSED"
                ? "bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Dismissed</span>
            <span className="text-[10px] text-zinc-500 font-mono">({counts.DISMISSED})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search duplicates..."
            className="pl-9 h-8 text-xs bg-[#171717] border-[#262626]"
          />
        </div>
      </div>

      {/* List of Duplicate Matches */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Loading duplicate records...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#171717] border border-[#262626] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            {activeTab === "PENDING"
              ? "All Clean! No Pending Duplicate Leads"
              : activeTab === "MERGED"
              ? "No Merged Lead Records Found"
              : "No Dismissed Matches Found"}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {activeTab === "PENDING"
              ? "When new leads share the same phone number or email with existing leads, they will appear here for side-by-side review."
              : "No records match the current filter view."}
          </p>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Leads Pipeline</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredMatches.map((m) => (
            <DuplicateCompareCard key={m.id} match={m} onResolved={fetchMatches} />
          ))}
        </div>
      )}
    </div>
  );
}
