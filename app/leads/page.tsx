"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Kanban,
  Table as TableIcon,
  Search,
  Users,
  Flame,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Filter,
  GitMerge,
} from "lucide-react";
import { LeadStage } from "@/types";
import { LeadKanbanBoard, LeadItem } from "@/components/leads/lead-kanban-board";
import { LeadTableView } from "@/components/leads/lead-table-view";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { updateLeadStageAction } from "@/app/actions/leads";
import { toast } from "sonner";
import { KanbanSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-6"><KanbanSkeleton columns={5} cardsPerCol={3} /></div>}>
      <LeadsPageContent />
    </Suspense>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const viewParam = searchParams.get("view");
  const stageParam = searchParams.get("stage") as LeadStage | null;

  // Initialize view mode based on query param or default to kanban
  const [viewMode, setViewMode] = useState<"kanban" | "table">(
    viewParam === "table" ? "table" : "kanban"
  );

  // Sync viewMode if viewParam in URL changes
  useEffect(() => {
    if (viewParam === "table") {
      setViewMode("table");
    } else if (viewParam === "kanban") {
      setViewMode("kanban");
    }
  }, [viewParam]);

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [counselors, setCounselors] = useState<any[]>([]);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<any[]>([]);
  const [pipelineTemplates, setPipelineTemplates] = useState<any[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const userRole = session?.user?.role;
  const canEdit = userRole === "ADMIN" || userRole === "COUNSELOR";

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const [leadsRes, pipelinesRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/pipelines"),
      ]);

      const data = await leadsRes.json();
      const pipelinesData = await pipelinesRes.json();

      if (!leadsRes.ok) {
        throw new Error(data?.error || "Failed to fetch leads.");
      }

      setLeads(data.leads || []);
      setCounselors(data.counselors || []);
      setCustomFieldDefinitions(data.customFieldDefinitions || []);
      if (pipelinesData.templates) {
        setPipelineTemplates(pipelinesData.templates);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load leads pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Update view mode and reflect in URL
  const handleViewChange = (mode: "kanban" | "table") => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "table") {
      params.set("view", "table");
    } else {
      params.delete("view");
    }
    const q = params.toString();
    router.push(q ? `/leads?${q}` : "/leads");
  };

  // Clear stage filter
  const handleClearStage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stage");
    const q = params.toString();
    router.push(q ? `/leads?${q}` : "/leads");
  };

  // Update stage handler
  const handleStageChange = async (
    leadId: string,
    newStageOrStageId: string,
    lostReason?: string | null
  ) => {
    if (!canEdit) return;

    try {
      await updateLeadStageAction(leadId, newStageOrStageId, lostReason);
      toast.success("Lead stage updated successfully.");
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update lead stage.");
      fetchLeads();
    }
  };

  // Bulk reassign handler
  const handleBulkReassign = async (leadIds: string[], counselorId: string) => {
    if (!canEdit) return;

    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign",
          leadIds,
          targetCounselorId: counselorId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reassign leads.");
      }

      toast.success(data.message || "Leads successfully reassigned.");
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reassign leads.");
    }
  };

  // Bulk stage change handler
  const handleBulkStageChange = async (
    leadIds: string[],
    newStage: string,
    lostReason?: string | null
  ) => {
    if (!canEdit) return;

    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          leadIds,
          targetStage: newStage,
          lostReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to change lead stages.");
      }

      toast.success(data.message || "Lead stages successfully updated.");
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to change lead stages.");
    }
  };

  // Bulk tag handler
  const handleBulkTagAction = async (
    leadIds: string[],
    params: { action: "add" | "remove"; tagId?: string; tagName?: string; tagColor?: string }
  ) => {
    if (!canEdit) return;

    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: params.action === "add" ? "tag-add" : "tag-remove",
          leadIds,
          tagId: params.tagId,
          tagName: params.tagName,
          tagColor: params.tagColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update tags.");
      }

      toast.success(data.message || "Tags successfully updated.");
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update tags.");
    }
  };

  // Bulk delete handler (ADMIN-only)
  const handleBulkDelete = async (leadIds: string[]) => {
    if (userRole !== "ADMIN") {
      toast.error("Admin privileges required to delete leads.");
      return;
    }

    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          leadIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete leads.");
      }

      toast.success(data.message || "Leads successfully deleted.");
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete leads.");
    }
  };

  // Real-time search & stage filter
  const displayedLeads = leads.filter((l) => {
    if (stageParam && l.stage !== stageParam) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      l.phone.includes(query)
    );
  });

  // Pipeline metrics (calculated from all leads)
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.stage === "HOT").length;
  const convertingLeads = leads.filter((l) => l.stage === "CONVERTING").length;
  const lostLeads = leads.filter((l) => l.stage === "LOST").length;

  return (
    <div className="space-y-5 w-full px-1 sm:px-2">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-heading flex items-center gap-2.5">
            <span>Leads Pipeline</span>
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              Live Admissions
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage inquiries, qualifications, counselor assignments, and student conversions.
          </p>
        </div>

        {/* View Toggle & Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/leads/duplicates"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-medium transition-colors"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Duplicates</span>
          </Link>

          <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("table")}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("kanban")}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchLeads}
            isDisabled={isLoading}
            title="Refresh Leads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 flex-row items-center gap-3 card-hover-lift">
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Total Inquiries</p>
            <p className="text-base font-bold text-foreground font-heading">{totalLeads}</p>
          </div>
        </Card>

        <Card className="p-3.5 flex-row items-center gap-3 card-hover-lift">
          <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">High Intent (Hot)</p>
            <p className="text-base font-bold text-rose-600 dark:text-rose-400 font-heading">{hotLeads}</p>
          </div>
        </Card>

        <Card className="p-3.5 flex-row items-center gap-3 card-hover-lift">
          <div className="p-2 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Converting</p>
            <p className="text-base font-bold text-purple-600 dark:text-purple-400 font-heading">{convertingLeads}</p>
          </div>
        </Card>

        <Card className="p-3.5 flex-row items-center gap-3 card-hover-lift">
          <div className="p-2 rounded-lg bg-muted text-muted-foreground border border-border shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Lost / Closed</p>
            <p className="text-base font-bold text-muted-foreground font-heading">{lostLeads}</p>
          </div>
        </Card>
      </div>

      {/* Active Stage Filter Banner */}
      {stageParam && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 px-3.5 py-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-foreground">
              Showing leads filtered by stage:
            </span>
            <Badge className="bg-blue-600 text-white font-semibold text-xs uppercase tracking-wider">
              {stageParam}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              ({displayedLeads.length} leads)
            </span>
          </div>
          <button
            onClick={handleClearStage}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <span>View All Stages</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* READONLY RBAC Warning Banner */}
      {!canEdit && (
        <Alert>
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <AlertDescription>
            <strong className="font-semibold text-foreground">Read-Only Mode:</strong> You can view leads and export data, but pipeline editing controls are restricted.
          </AlertDescription>
        </Alert>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name, email, or phone..."
          className="pl-9"
        />
      </div>

      {/* Main View Area: Skeletons, Empty State, or Data */}
      {isLoading ? (
        viewMode === "kanban" ? (
          <KanbanSkeleton columns={5} cardsPerCol={3} />
        ) : (
          <TableSkeleton rows={8} cols={7} />
        )
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          badge="Admissions Pipeline"
          title="No Leads in Pipeline Yet"
          description="Your admission pipeline is waiting for inquiries. Capture student leads automatically via Meta Lead Ads, WhatsApp, Google Sheets sync, or add inquiries manually."
          primaryAction={{
            label: "Connect Ingestion Sources",
            href: "/settings/integrations",
          }}
          secondaryAction={{
            label: "Refresh Pipeline",
            onClick: () => fetchLeads(),
            icon: RefreshCw,
          }}
        />
      ) : displayedLeads.length === 0 ? (
        <Card className="p-8 text-center max-w-md mx-auto my-6">
          <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2.5" />
          <h4 className="text-sm font-bold text-white font-heading">No matching leads found</h4>
          <p className="text-xs text-zinc-400 mt-1">
            {stageParam
              ? `No leads in stage "${stageParam}" match your search query.`
              : `No leads match your search query "${searchQuery}".`}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {searchQuery && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </Button>
            )}
            {stageParam && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearStage}
              >
                Clear Stage Filter
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === "kanban" ? (
        <LeadKanbanBoard
          leads={displayedLeads}
          pipelineTemplates={pipelineTemplates}
          activeTemplateId={activeTemplateId}
          onSelectTemplate={(tplId) => setActiveTemplateId(tplId)}
          canEdit={canEdit}
          onSelectLead={(id) => setSelectedLeadId(id)}
          onStageChange={handleStageChange}
        />
      ) : (
        <LeadTableView
          leads={displayedLeads}
          counselors={counselors}
          customFieldDefinitions={customFieldDefinitions}
          canEdit={canEdit}
          isAdmin={userRole === "ADMIN"}
          initialStage={stageParam || "ALL"}
          onSelectLead={(id) => setSelectedLeadId(id)}
          onStageChange={handleStageChange}
          onBulkReassign={handleBulkReassign}
          onBulkStageChange={handleBulkStageChange}
          onBulkTagAction={handleBulkTagAction}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Right-Side Slide-Over Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        canEdit={canEdit}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={(updated) => {
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
        }}
      />
    </div>
  );
}
