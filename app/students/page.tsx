"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  GraduationCap,
  Search,
  Filter,
  FileCheck2,
  CreditCard,
  Building,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Download,
  GitMerge,
} from "lucide-react";
import { StudentStage, DocumentStatus, PaymentStatus, CustomFieldDefinition, Tag as TagType } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns3, Tag as TagIcon, ArrowRightLeft, Trash2 } from "lucide-react";
import { TagBadge } from "@/components/tags/tag-badge";
import {
  BulkStageChangeModal,
  BulkTagManageModal,
  BulkDeleteDialog,
} from "@/components/leads/bulk-modals";
import { toast } from "sonner";

interface StudentListItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  stage: StudentStage;
  program: string;
  cohort: string;
  branch: string | null;
  createdAt: string;
  customFields?: Record<string, any>;
  tags?: TagType[];
  documents: {
    id: string;
    name: string;
    status: DocumentStatus;
    fileUrl: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    dueDate: string;
    status: PaymentStatus;
    installmentNumber: number;
  }[];
  lead?: {
    id: string;
    name: string;
    source: string;
    score: number | null;
  } | null;
  metrics: {
    totalDocs: number;
    verifiedDocs: number;
    receivedDocs: number;
    docPercent: number;
    totalPayments: number;
    paidPayments: number;
    pendingPayments: number;
    paymentPercent: number;
  };
}

const STAGE_CONFIG: Record<
  string,
  { label: string; color: string; badge: string; desc: string }
> = {
  ALL: {
    label: "All Students",
    color: "text-zinc-300",
    badge: "bg-zinc-800 text-zinc-300 border-zinc-700",
    desc: "Complete enrolled registry",
  },
  ENQUIRY: {
    label: "Enquiry",
    color: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    desc: "Prospective applicants evaluating programs",
  },
  ENROLLED: {
    label: "Enrolled",
    color: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    desc: "Offer accepted & document verification in progress",
  },
  ACTIVE: {
    label: "Active",
    color: "text-purple-400",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    desc: "Attending classes, labs, and workshops",
  },
  ALUMNI: {
    label: "Alumni",
    color: "text-zinc-400",
    badge: "bg-zinc-800 text-zinc-400 border-zinc-700",
    desc: "Graduated with vocational diploma/credentials",
  },
};

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <StudentsDirectoryPage />
    </Suspense>
  );
}

function StudentsDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stageParam = searchParams.get("stage");
  const tabParam = searchParams.get("tab");

  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canMutate = userRole === "ADMIN" || userRole === "COUNSELOR";

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [visibleCustomFieldKeys, setVisibleCustomFieldKeys] = useState<string[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showTagFilterPicker, setShowTagFilterPicker] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({
    ALL: 0,
    ENQUIRY: 0,
    ENROLLED: 0,
    ACTIVE: 0,
    ALUMNI: 0,
  });
  const [availableCohorts, setAvailableCohorts] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>(stageParam || "ALL");
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  const activeCustomFields = useMemo(() => {
    return customFieldDefinitions.filter((f) => f.isActive);
  }, [customFieldDefinitions]);

  // Unique tags present in loaded students
  const availableTags = useMemo(() => {
    const map = new Map<string, TagType>();
    students.forEach((s) => {
      (s.tags || []).forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  // Keep selectedStage synced when stageParam in URL changes
  useEffect(() => {
    if (stageParam && stageParam !== selectedStage) {
      setSelectedStage(stageParam);
    } else if (!stageParam && selectedStage !== "ALL") {
      setSelectedStage("ALL");
    }
  }, [stageParam]);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedStage !== "ALL") params.set("stage", selectedStage);
      if (selectedCohort !== "all") params.set("cohort", selectedCohort);
      if (selectedBranch !== "all") params.set("branch", selectedBranch);

      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setStudents(data.students || []);
        if (data.customFieldDefinitions) {
          setCustomFieldDefinitions(data.customFieldDefinitions);
        }
        setTotalCount(data.totalCount || 0);
        if (data.stageCounts) setStageCounts(data.stageCounts);
        if (data.availableCohorts) setAvailableCohorts(data.availableCohorts);
        if (data.availableBranches) setAvailableBranches(data.availableBranches);
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedStage, selectedCohort, selectedBranch]);

  // Filter students based on custom field filters and multi-select tags
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Multi-select Tag Filter (matches any selected tag)
      if (selectedTagIds.length > 0) {
        const studentTagIds = (student.tags || []).map((t) => t.id);
        const hasMatch = selectedTagIds.some((id) => studentTagIds.includes(id));
        if (!hasMatch) return false;
      }

      for (const [key, filterVal] of Object.entries(customFieldFilters)) {
        if (!filterVal || filterVal === "ALL") continue;
        const studentVal = student.customFields?.[key];
        if (studentVal === undefined || studentVal === null || studentVal === "") return false;
        if (typeof studentVal === "boolean") {
          if (filterVal === "true" && !studentVal) return false;
          if (filterVal === "false" && studentVal) return false;
        } else {
          if (String(studentVal).toLowerCase() !== filterVal.toLowerCase()) return false;
        }
      }
      return true;
    });
  }, [students, selectedTagIds, customFieldFilters]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchStudents();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Overall statistics
  const summaryStats = useMemo(() => {
    const totalStudents = totalCount;
    const activeCount = stageCounts.ACTIVE || 0;
    const enrolledCount = stageCounts.ENROLLED || 0;
    const enquiryCount = stageCounts.ENQUIRY || 0;

    let totalDocsCount = 0;
    let totalDocsVerified = 0;
    let totalFee = 0;
    let totalCollected = 0;

    students.forEach((s) => {
      totalDocsCount += s.metrics.totalDocs;
      totalDocsVerified += s.metrics.verifiedDocs;
      totalFee += s.metrics.totalPayments;
      totalCollected += s.metrics.paidPayments;
    });

    const docVerificationRate =
      totalDocsCount > 0 ? Math.round((totalDocsVerified / totalDocsCount) * 100) : 0;

    return {
      totalStudents,
      activeCount,
      enrolledCount,
      enquiryCount,
      docVerificationRate,
      totalCollected,
      totalFee,
    };
  }, [students, totalCount, stageCounts]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Bulk stage change handler
  const handleBulkStageChange = async (targetStage: string) => {
    if (!canMutate) return;
    setIsOperating(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          studentIds: selectedIds,
          targetStage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update student stages.");

      toast.success(data.message || "Student stages updated successfully.");
      setIsStageModalOpen(false);
      setSelectedIds([]);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to update student stages.");
    } finally {
      setIsOperating(false);
    }
  };

  // Bulk tag handler
  const handleBulkTagAction = async (params: {
    action: "add" | "remove";
    tagId?: string;
    tagName?: string;
    tagColor?: string;
  }) => {
    if (!canMutate) return;
    setIsOperating(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: params.action === "add" ? "tag-add" : "tag-remove",
          studentIds: selectedIds,
          tagId: params.tagId,
          tagName: params.tagName,
          tagColor: params.tagColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tags.");

      toast.success(data.message || "Tags updated successfully.");
      setIsTagModalOpen(false);
      setSelectedIds([]);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to update tags.");
    } finally {
      setIsOperating(false);
    }
  };

  // Bulk delete handler (ADMIN only)
  const handleBulkDelete = async () => {
    if (userRole !== "ADMIN") {
      toast.error("Admin privileges required to delete students.");
      return;
    }
    setIsOperating(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          studentIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete students.");

      toast.success(data.message || "Students successfully deleted.");
      setIsDeleteModalOpen(false);
      setSelectedIds([]);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete students.");
    } finally {
      setIsOperating(false);
    }
  };

  const handleExportCSV = () => {
    const studentsToExport =
      selectedIds.length > 0
        ? students.filter((s) => selectedIds.includes(s.id))
        : filteredStudents;

    if (!studentsToExport || studentsToExport.length === 0) return;

    const headers = [
      "ID",
      "Name",
      "Phone",
      "Email",
      "Tags",
      "Stage",
      "Program",
      "Cohort",
      "Branch",
      ...visibleCustomFieldKeys.map((k) => activeCustomFields.find((f) => f.fieldKey === k)?.label || k),
      "Total Docs",
      "Verified Docs",
      "Total Fee (INR)",
      "Paid Fee (INR)",
      "Payment Status",
      "Created At",
    ];

    const rows = studentsToExport.map((s) => [
      s.id,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.phone}"`,
      `"${s.email}"`,
      `"${(s.tags || []).map((t) => t.name).join(", ").replace(/"/g, '""')}"`,
      s.stage,
      `"${s.program.replace(/"/g, '""')}"`,
      `"${s.cohort.replace(/"/g, '""')}"`,
      `"${(s.branch || "").replace(/"/g, '""')}"`,
      ...visibleCustomFieldKeys.map((k) => `"${String(s.customFields?.[k] ?? "").replace(/"/g, '""')}"`),
      s.metrics?.totalDocs || 0,
      s.metrics?.verifiedDocs || 0,
      s.payments.reduce((sum, p) => sum + p.amount, 0),
      s.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0),
      s.payments.some((p) => p.status === "OVERDUE") ? "OVERDUE" : (s.metrics?.paidPayments === s.metrics?.totalPayments && s.metrics?.totalPayments > 0 ? "PAID" : "PENDING"),
      new Date(s.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `students-export-${selectedStage.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            Students Registry
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stage transitions, document checklists, and payment realization per cohort.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Duplicates Queue */}
          <Link
            href="/students/duplicates"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-medium transition-colors"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Duplicates</span>
          </Link>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            onClick={handleExportCSV}
            isDisabled={students.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchStudents()}
            isDisabled={isLoading}
            aria-label="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          {/* New Admission CTA */}
          <Link href="/leads" className={buttonVariants({ className: "gap-1.5" })}>
            <Plus className="w-3.5 h-3.5" />
            <span>Convert Lead</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Enrolled */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Total Registered</span>
            <span className="p-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-lg">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              {summaryStats.totalStudents}
            </span>
            <span className="text-[11px] text-muted-foreground">students in registry</span>
          </div>
        </Card>

        {/* Card 2: Active Learners */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Active Learners</span>
            <span className="p-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400">
              {summaryStats.activeCount}
            </span>
            <span className="text-[11px] text-muted-foreground">attending classes</span>
          </div>
        </Card>

        {/* Card 3: Document Compliance Rate */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Docs Verified</span>
            <span className="p-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg">
              <FileCheck2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-400">
              {summaryStats.docVerificationRate}%
            </span>
            <span className="text-[11px] text-muted-foreground">checklist verified</span>
          </div>
        </Card>

        {/* Card 4: Fee Realization */}
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Fee Realized</span>
            <span className="p-1.5 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-lg">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-purple-400">
              ₹{(summaryStats.totalCollected / 1000).toFixed(0)}k
            </span>
            <span className="text-[11px] text-muted-foreground">
              / ₹{(summaryStats.totalFee / 1000).toFixed(0)}k total
            </span>
          </div>
        </Card>
      </div>

      {/* Stage Filter Tabs */}
      <Tabs
        selectedKey={selectedStage}
        onSelectionChange={(key) => {
          const stage = String(key);
          setSelectedStage(stage);
          const params = new URLSearchParams(searchParams.toString());
          if (stage === "ALL") {
            params.delete("stage");
          } else {
            params.set("stage", stage);
          }
          const q = params.toString();
          router.push(q ? `/students?${q}` : "/students");
        }}
      >
        <TabsList variant="line" className="border-b border-border rounded-none w-full justify-start h-auto p-0">
          {["ALL", "ENQUIRY", "ENROLLED", "ACTIVE", "ALUMNI"].map((stageKey) => {
            const count = stageCounts[stageKey] || 0;
            const config = STAGE_CONFIG[stageKey];

            return (
              <TabsTrigger
                key={stageKey}
                id={stageKey}
                className="py-2 px-3 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0"
              >
                <span>{config.label}</span>
                <Badge
                  variant="outline"
                  className={
                    selectedStage === stageKey
                      ? "bg-blue-600 text-white border-transparent"
                      : "bg-muted/40 text-zinc-400 border-border"
                  }
                >
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Search & Secondary Filters Bar */}
      <Card className="p-2.5 flex flex-col md:flex-row items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search by student name, phone (+91), or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9"
          />
        </div>

        {/* Cohort Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select
            selectedKey={selectedCohort}
            onSelectionChange={(key) => setSelectedCohort(String(key))}
          >
            <SelectTrigger className="w-full md:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem id="all">All Cohorts</SelectItem>
              {availableCohorts.map((c) => (
                <SelectItem key={c} id={c}>
                  Cohort {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Branch Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select
            selectedKey={selectedBranch}
            onSelectionChange={(key) => setSelectedBranch(String(key))}
          >
            <SelectTrigger className="w-full md:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem id="all">All Campuses</SelectItem>
              {availableBranches.map((b) => (
                <SelectItem key={b} id={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags Multi-select Filter Dropdown */}
        {availableTags.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagFilterPicker(!showTagFilterPicker)}
              className="gap-1.5 h-9"
            >
              <TagIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>Tags</span>
              {selectedTagIds.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-purple-500/20 text-purple-300">
                  {selectedTagIds.length}
                </Badge>
              )}
            </Button>

            {showTagFilterPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl z-50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
                  <span className="text-xs font-semibold text-zinc-300">Filter by Tags</span>
                  {selectedTagIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTagIds([])}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 crm-scrollbar">
                  {availableTags.map((tag) => {
                    const isChecked = selectedTagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/60 cursor-pointer text-xs text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTagIds([...selectedTagIds, tag.id]);
                            } else {
                              setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                        />
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Fields Filter (if any active select/boolean fields) */}
        {activeCustomFields.filter((f) => f.fieldType === "SELECT" || f.fieldType === "BOOLEAN").map((field) => {
          const options: string[] = Array.isArray(field.options)
            ? field.options
            : typeof field.options === "string"
            ? JSON.parse(field.options)
            : [];
          return (
            <div key={field.id} className="flex items-center gap-1.5 bg-[#14151a] border border-[#27272a] rounded-lg px-2.5 py-1.5 shadow-sm">
              <select
                value={customFieldFilters[field.fieldKey] || "ALL"}
                onChange={(e) =>
                  setCustomFieldFilters((prev) => ({
                    ...prev,
                    [field.fieldKey]: e.target.value,
                  }))
                }
                className="bg-[#14151a] text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark] [&>option]:bg-[#18181b] [&>option]:text-zinc-200 max-w-[130px]"
              >
                <option value="ALL" className="bg-[#18181b] text-zinc-200">
                  {field.label}
                </option>
                {field.fieldType === "BOOLEAN" ? (
                  <>
                    <option value="true" className="bg-[#18181b] text-zinc-200">Yes</option>
                    <option value="false" className="bg-[#18181b] text-zinc-200">No</option>
                  </>
                ) : (
                  options.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#18181b] text-zinc-200">
                      {opt}
                    </option>
                  ))
                )}
              </select>
            </div>
          );
        })}

        {/* Columns Toggle Dropdown */}
        {activeCustomFields.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="gap-1.5 h-9"
            >
              <Columns3 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Columns</span>
              {visibleCustomFieldKeys.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-blue-500/20 text-blue-300">
                  +{visibleCustomFieldKeys.length}
                </Badge>
              )}
            </Button>

            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl z-50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#27272a]">
                  <span className="text-xs font-semibold text-zinc-300">Custom Columns</span>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCustomFieldKeys(
                        visibleCustomFieldKeys.length === activeCustomFields.length
                          ? []
                          : activeCustomFields.map((f) => f.fieldKey)
                      )
                    }
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    {visibleCustomFieldKeys.length === activeCustomFields.length ? "Clear All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {activeCustomFields.map((field) => {
                    const isChecked = visibleCustomFieldKeys.includes(field.fieldKey);
                    return (
                      <label
                        key={field.id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/60 cursor-pointer text-xs text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleCustomFieldKeys([...visibleCustomFieldKeys, field.fieldKey]);
                            } else {
                              setVisibleCustomFieldKeys(
                                visibleCustomFieldKeys.filter((k) => k !== field.fieldKey)
                              );
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{field.label}</span>
                        <span className="ml-auto text-[10px] text-zinc-500 font-mono">
                          {field.fieldType.toLowerCase()}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && canMutate && (
        <div className="bg-muted/40 border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-panel animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs text-zinc-400">students ready for batch operations</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setIsStageModalOpen(true)}>
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Change Stage</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={() => setIsTagModalOpen(true)}>
              <TagIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Manage Tags</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" />
              <span>Export Selected</span>
            </Button>

            {userRole === "ADMIN" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Students Data Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-medium">Loading students directory...</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="py-16 px-6 text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">No Enrolled Students Yet</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Student profiles are created automatically when converting qualified leads from your pipeline, or can be synced directly via the ERP integration.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/leads"
                className={buttonVariants({ className: "gap-2 h-9 px-4" })}
              >
                <span>Convert Leads to Students</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/settings/integrations/erp"
                className={buttonVariants({ variant: "outline", className: "gap-2 h-9 px-4" })}
              >
                <span>Connect ERP Sync</span>
              </Link>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Search className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-base font-bold text-zinc-200">No students match current filters</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try switching your stage filter or clearing the search query.
            </p>
            <Button
              variant="ghost"
              className="mt-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
              onClick={() => {
                setSelectedStage("ALL");
                setSelectedCohort("all");
                setSelectedBranch("all");
                setCustomFieldFilters({});
                setSearchQuery("");
              }}
            >
              Reset All Filters
            </Button>
          </div>
        ) : (
          <Table aria-label="Students">
            <TableHeader>
              <TableRow className="bg-muted/40 border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead className="w-9">
                  <Checkbox
                    isSelected={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                    isIndeterminate={selectedIds.length > 0 && selectedIds.length < filteredStudents.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead>Student Profile</TableHead>
                <TableHead>Program & Cohort</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Stage</TableHead>

                {/* Visible Custom Field Columns */}
                {visibleCustomFieldKeys.map((key) => {
                  const def = activeCustomFields.find((f) => f.fieldKey === key);
                  return (
                    <TableHead key={key} className="whitespace-nowrap">
                      {def?.label || key}
                    </TableHead>
                  );
                })}

                <TableHead>Documents</TableHead>
                <TableHead>Fee / Installments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {filteredStudents.map((student) => {
                  const stageStyle =
                    STAGE_CONFIG[student.stage]?.badge ||
                    "bg-zinc-800 text-zinc-300 border-zinc-700";
                  const initial = student.name ? student.name[0].toUpperCase() : "S";

                  return (
                    <TableRow
                      key={student.id}
                      className="border-border/60 hover:bg-muted/40/50 transition-colors group"
                    >
                      {/* Row Checkbox */}
                      <TableCell className="w-9">
                        <Checkbox
                          isSelected={selectedIds.includes(student.id)}
                          onChange={() => toggleSelectRow(student.id)}
                          aria-label={`Select ${student.name}`}
                        />
                      </TableCell>

                      {/* Name & Contact */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-[4px] bg-muted/40 border border-border flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">
                            {initial}
                          </div>
                          <div>
                            <Link
                              href={`/students/${student.id}`}
                              className="font-medium text-foreground group-hover:text-blue-400 transition-colors block text-xs"
                            >
                              {student.name}
                            </Link>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                              <span className="font-mono">{student.phone}</span>
                              <span className="hidden sm:inline">·</span>
                              <span className="hidden sm:inline font-mono truncate max-w-[140px]">{student.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Program, Cohort & Campus */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-zinc-200 text-xs">
                            {student.program}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                            <span className="bg-muted/40 border border-border px-1.5 py-0.2 rounded text-zinc-400">
                              {student.cohort}
                            </span>
                            {student.branch && (
                              <span className="truncate max-w-[120px]">
                                • {student.branch}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Tags */}
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
                          {(student.tags || []).length > 0 ? (
                            (student.tags || []).map((t) => (
                              <TagBadge key={t.id} name={t.name} color={t.color} size="sm" />
                            ))
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Stage Badge */}
                      <TableCell>
                        <Badge variant="outline" className={`uppercase tracking-wider ${stageStyle}`}>
                          {student.stage}
                        </Badge>
                      </TableCell>

                      {/* Visible Custom Field Values */}
                      {visibleCustomFieldKeys.map((key) => {
                        const def = activeCustomFields.find((f) => f.fieldKey === key);
                        const val = student.customFields?.[key];
                        if (val === undefined || val === null || val === "") {
                          return (
                            <TableCell key={key} className="text-zinc-600 text-xs">
                              —
                            </TableCell>
                          );
                        }

                        if (def?.fieldType === "BOOLEAN") {
                          return (
                            <TableCell key={key}>
                              <Badge
                                variant="outline"
                                className={
                                  val === true || val === "true"
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]"
                                }
                              >
                                {val === true || val === "true" ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                          );
                        }

                        if (def?.fieldType === "SELECT") {
                          return (
                            <TableCell key={key}>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/40 border border-border text-zinc-300">
                                {String(val)}
                              </span>
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell key={key} className="text-xs text-zinc-300 font-mono">
                            {String(val)}
                          </TableCell>
                        );
                      })}

                      {/* Document Verification Progress */}
                      <TableCell>
                        <div className="space-y-1 min-w-[110px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400 font-medium">
                              {student.metrics.verifiedDocs}/{student.metrics.totalDocs}
                            </span>
                            <span
                              className={`font-semibold ${
                                student.metrics.docPercent === 100
                                  ? "text-emerald-400"
                                  : student.metrics.docPercent > 0
                                  ? "text-blue-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {student.metrics.docPercent}%
                            </span>
                          </div>
                          <Progress value={student.metrics.docPercent} aria-label="Document verification progress">
                            <ProgressTrack className="h-1 bg-[#27272a]">
                              <ProgressIndicator
                                className={
                                  student.metrics.docPercent === 100
                                    ? "bg-emerald-500"
                                    : student.metrics.docPercent > 0
                                    ? "bg-blue-500"
                                    : "bg-zinc-600"
                                }
                              />
                            </ProgressTrack>
                          </Progress>
                        </div>
                      </TableCell>

                      {/* Fee Realization Progress */}
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-zinc-200">
                              ₹{student.metrics.paidPayments.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              of ₹{student.metrics.totalPayments.toLocaleString()}
                            </span>
                          </div>
                          <Progress value={student.metrics.paymentPercent} aria-label="Fee realization progress">
                            <ProgressTrack className="h-1 bg-[#27272a]">
                              <ProgressIndicator
                                className={
                                  student.metrics.paymentPercent === 100
                                    ? "bg-emerald-500"
                                    : student.metrics.paymentPercent > 0
                                    ? "bg-purple-500"
                                    : "bg-zinc-600"
                                }
                              />
                            </ProgressTrack>
                          </Progress>
                        </div>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Link
                          href={`/students/${student.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        )}
      </Card>

      {/* Bulk Stage Change Modal */}
      <BulkStageChangeModal
        isOpen={isStageModalOpen}
        entityType="STUDENT"
        selectedCount={selectedIds.length}
        onConfirm={handleBulkStageChange}
        onCancel={() => setIsStageModalOpen(false)}
        isSubmitting={isOperating}
      />

      {/* Bulk Tag Manage Modal */}
      <BulkTagManageModal
        isOpen={isTagModalOpen}
        entityType="STUDENT"
        selectedCount={selectedIds.length}
        availableTags={availableTags}
        onConfirm={handleBulkTagAction}
        onCancel={() => setIsTagModalOpen(false)}
        isSubmitting={isOperating}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        isOpen={isDeleteModalOpen}
        entityType="STUDENT"
        selectedCount={selectedIds.length}
        onConfirm={handleBulkDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isSubmitting={isOperating}
      />
    </div>
  );
}
