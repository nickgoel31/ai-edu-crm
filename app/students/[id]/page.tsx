"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  Building,
  FileCheck2,
  CreditCard,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  FileText,
  ExternalLink,
  Shield,
  Trash2,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Tag,
  AlertTriangle,
} from "lucide-react";
import {
  StudentStage,
  DocumentStatus,
  PaymentStatus,
  Tag as TagType,
} from "@/types";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { InlineTagPicker } from "@/components/tags/inline-tag-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface DocumentItem {
  id: string;
  name: string;
  status: DocumentStatus;
  fileUrl: string | null;
  createdAt: string;
}

interface PaymentItem {
  id: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  installmentNumber: number;
  createdAt: string;
}

interface StudentDetail {
  id: string;
  organizationId: string;
  leadId: string | null;
  name: string;
  phone: string;
  email: string;
  stage: StudentStage;
  program: string;
  cohort: string;
  branch: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: TagType[];
  documents: DocumentItem[];
  payments: PaymentItem[];
  lead?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    source: string;
    stage: string;
    score: number | null;
    createdAt: string;
    assignedTo?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  } | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
  changesJson: any;
  user?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

interface DocumentTemplate {
  id: string;
  program: string;
  requiredDocuments: string[];
}

const STAGES: StudentStage[] = [
  StudentStage.ENQUIRY,
  StudentStage.ENROLLED,
  StudentStage.ACTIVE,
  StudentStage.ALUMNI,
];

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const studentId = params.id as string;

  const userRole = session?.user?.role;
  const canEdit = userRole === "ADMIN" || userRole === "COUNSELOR";

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active Tab: 'overview' | 'documents' | 'payments' | 'timeline'
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "payments" | "timeline"
  >("overview");

  // Mutation states
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  // Add document modal state
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  // Add payment modal state
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState("15000");
  const [newPaymentDueDate, setNewPaymentDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [isAddingPayment, setIsAddingPayment] = useState(false);

  // Fetch Student Data
  const fetchStudent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load student profile.");
      }

      setStudent(data.student);
      setAuditLogs(data.auditLogs || []);
      setTemplate(data.documentTemplate || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load student.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  // Stage Update
  const handleStageChange = async (newStage: StudentStage) => {
    if (!canEdit || !student || newStage === student.stage) return;

    setIsUpdatingStage(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update stage.");

      setStudent((prev) => (prev ? { ...prev, stage: newStage } : null));
      setSuccess(`Stage updated to ${newStage}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Stage update failed.");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Toggle Document Status: PENDING -> RECEIVED -> VERIFIED -> PENDING
  const handleCycleDocStatus = async (doc: DocumentItem) => {
    if (!canEdit) return;

    let nextStatus: DocumentStatus = DocumentStatus.PENDING;
    if (doc.status === DocumentStatus.PENDING) {
      nextStatus = DocumentStatus.RECEIVED;
    } else if (doc.status === DocumentStatus.RECEIVED) {
      nextStatus = DocumentStatus.VERIFIED;
    } else if (doc.status === DocumentStatus.VERIFIED) {
      nextStatus = DocumentStatus.PENDING;
    }

    setUpdatingDocId(doc.id);
    setError(null);

    try {
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          status: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update document status.");

      setStudent((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, status: nextStatus } : d
          ),
        };
      });

      setSuccess(`Updated ${doc.name} to ${nextStatus}`);
      setTimeout(() => setSuccess(null), 2500);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Failed to update document.");
    } finally {
      setUpdatingDocId(null);
    }
  };

  // Add Custom Document
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newDocName.trim()) return;

    setIsAddingDoc(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: newDocUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add document.");

      setNewDocName("");
      setNewDocUrl("");
      setIsAddDocOpen(false);
      setSuccess("Document requirement added.");
      setTimeout(() => setSuccess(null), 2500);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Failed to add document.");
    } finally {
      setIsAddingDoc(false);
    }
  };

  // Remove Document
  const handleRemoveDoc = async (docId: string, docName: string) => {
    if (!canEdit) return;
    if (!confirm(`Are you sure you want to remove ${docName}?`)) return;

    try {
      const res = await fetch(
        `/api/students/${studentId}/documents?documentId=${docId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete document.");

      setSuccess(`Removed ${docName}`);
      setTimeout(() => setSuccess(null), 2500);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Failed to remove document.");
    }
  };

  // Mark Installment as Paid
  const handleMarkPaymentPaid = async (payment: PaymentItem) => {
    if (!canEdit) return;

    setUpdatingPaymentId(payment.id);
    setError(null);

    const nextStatus: PaymentStatus =
      payment.status === PaymentStatus.PAID
        ? PaymentStatus.PENDING
        : PaymentStatus.PAID;

    try {
      const res = await fetch(`/api/students/${studentId}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          status: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update payment.");

      setStudent((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            p.id === payment.id ? { ...p, status: nextStatus } : p
          ),
        };
      });

      setSuccess(`Installment #${payment.installmentNumber} marked as ${nextStatus}`);
      setTimeout(() => setSuccess(null), 2500);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Failed to update payment.");
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  // Add Installment Milestone
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newPaymentAmount) return;

    setIsAddingPayment(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(newPaymentAmount),
          dueDate: newPaymentDueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add payment.");

      setNewPaymentAmount("15000");
      setIsAddPaymentOpen(false);
      setSuccess("Fee installment added.");
      setTimeout(() => setSuccess(null), 2500);
      fetchStudent();
    } catch (err: any) {
      setError(err?.message || "Failed to add payment.");
    } finally {
      setIsAddingPayment(false);
    }
  };

  // Payment summary metrics
  const paymentMetrics = useMemo(() => {
    if (!student?.payments) {
      return { total: 0, paid: 0, pending: 0, percent: 0 };
    }
    const total = student.payments.reduce((acc, p) => acc + p.amount, 0);
    const paid = student.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + p.amount, 0);
    const pending = total - paid;
    const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, pending, percent };
  }, [student?.payments]);

  // Document summary metrics
  const documentMetrics = useMemo(() => {
    if (!student?.documents) {
      return { total: 0, verified: 0, received: 0, pending: 0, percent: 0 };
    }
    const total = student.documents.length;
    const verified = student.documents.filter(
      (d) => d.status === DocumentStatus.VERIFIED
    ).length;
    const received = student.documents.filter(
      (d) => d.status === DocumentStatus.RECEIVED
    ).length;
    const pending = student.documents.filter(
      (d) => d.status === DocumentStatus.PENDING
    ).length;
    const percent = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, received, pending, percent };
  }, [student?.documents]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p className="text-sm font-medium">Loading student records...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-100">Student Not Found</h2>
        <p className="text-sm text-zinc-400">
          This student record could not be found or belongs to another organization.
        </p>
        <Link
          href="/students"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students Registry</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & RBAC notice */}
      <div className="flex items-center justify-between">
        <Link
          href="/students"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students Registry</span>
        </Link>

        {!canEdit && (
          <Badge variant="outline" className="text-muted-foreground">
            Read-Only Mode
          </Badge>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      {/* Student Profile Header Card */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0">
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{student.name}</h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  {student.program}
                </span>
                <InlineTagPicker
                  entityType="STUDENT"
                  entityId={student.id}
                  initialTags={student.tags || []}
                  canEdit={canEdit}
                  onTagsChange={(newTags) => {
                    setStudent((prev) => (prev ? { ...prev, tags: newTags } : null));
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  <a href={`tel:${student.phone}`} className="hover:text-blue-400 font-mono">
                    {student.phone}
                  </a>
                </span>
                <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  <a href={`mailto:${student.email}`} className="hover:text-blue-400 font-mono">
                    {student.email}
                  </a>
                </span>
                <span className="flex items-center gap-1 font-semibold text-zinc-300">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  Cohort: {student.cohort}
                </span>
                {student.branch && (
                  <span className="flex items-center gap-1 text-zinc-300">
                    <Building className="w-3.5 h-3.5 text-zinc-500" />
                    {student.branch}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stage Dropdown Selector */}
          <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-xl border border-border shrink-0">
            <span className="text-xs font-semibold text-muted-foreground pl-2">Stage:</span>
            {canEdit ? (
              <Select
                selectedKey={student.stage}
                onSelectionChange={(key) => handleStageChange(key as StudentStage)}
                isDisabled={isUpdatingStage}
              >
                <SelectTrigger className="uppercase tracking-wider font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} id={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs font-bold uppercase px-3 py-1 bg-card border border-border rounded-lg text-zinc-200">
                {student.stage}
              </span>
            )}
          </div>
        </div>

        {/* Quick Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-zinc-400 block font-medium">Documents Verified</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-bold text-zinc-100">
                {documentMetrics.verified}/{documentMetrics.total}
              </span>
              <span
                className={`font-semibold text-[11px] ${
                  documentMetrics.percent === 100
                    ? "text-emerald-400"
                    : "text-blue-400"
                }`}
              >
                ({documentMetrics.percent}%)
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-zinc-400 block font-medium">Fee Progress</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-bold text-zinc-100">
                ₹{paymentMetrics.paid.toLocaleString()}
              </span>
              <span className="text-zinc-500 text-[11px]">
                / ₹{paymentMetrics.total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-zinc-400 block font-medium">Fee Balance Pending</span>
            <span className="font-bold text-amber-400 mt-0.5 block">
              ₹{paymentMetrics.pending.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 bg-muted/40 border border-border/50 rounded-lg">
            <span className="text-zinc-400 block font-medium">Originating Lead</span>
            {student.lead ? (
              <Link
                href={`/leads/${student.lead.id}`}
                className="font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 mt-0.5 truncate"
              >
                <span>{student.lead.name}</span>
                <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
            ) : (
              <span className="text-zinc-500 italic mt-0.5 block">Direct Admission</span>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as typeof activeTab)}
      >
        <TabsList variant="line" className="border-b border-border rounded-none w-full justify-start h-auto p-0">
          <TabsTrigger id="overview" className="py-3 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0">
            <GraduationCap className="w-4 h-4" />
            <span>Overview</span>
          </TabsTrigger>

          <TabsTrigger id="documents" className="py-3 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0">
            <FileCheck2 className="w-4 h-4" />
            <span>Documents Checklist</span>
            <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
              {documentMetrics.verified}/{documentMetrics.total}
            </Badge>
          </TabsTrigger>

          <TabsTrigger id="payments" className="py-3 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0">
            <CreditCard className="w-4 h-4" />
            <span>Payments Tracker</span>
            <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
              {paymentMetrics.percent}%
            </Badge>
          </TabsTrigger>

          <TabsTrigger id="timeline" className="py-3 px-1 gap-2 rounded-none data-selected:border-b-2 data-selected:border-blue-500 data-selected:after:opacity-0">
            <MessageSquare className="w-4 h-4" />
            <span>Activity Timeline</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details & Originating Lead */}
          <div className="md:col-span-2 space-y-6">
            {/* Academic Profile */}
            <Card className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
                Enrollment & Program Specifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-zinc-400 block font-medium">Program Curriculum</span>
                  <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                    {student.program}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Batch / Cohort</span>
                  <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                    {student.cohort}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Campus / Facility</span>
                  <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                    {student.branch || "Headquarters"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Enrollment Date</span>
                  <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                    {new Date(student.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </Card>

            {/* Originating Lead Information */}
            {student.lead ? (
              <Card className="p-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Originating Lead Conversion
                  </h2>
                  <Link
                    href={`/leads/${student.lead.id}`}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                  >
                    <span>View Full Lead Dossier</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-400 block font-medium">Original Ingestion Channel</span>
                    <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                      {student.lead.source.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">Admissions Lead Score</span>
                    <span className="font-bold text-emerald-400 text-sm mt-0.5 block">
                      {student.lead.score ?? "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">Assigned Counselor</span>
                    <span className="font-bold text-zinc-100 text-sm mt-0.5 block">
                      {student.lead.assignedTo?.name || "Unassigned"}
                    </span>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="bg-muted/40 p-5 rounded-xl border border-dashed border-border text-center space-y-2">
                <GraduationCap className="w-6 h-6 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">
                  Direct Student Registration (No originating lead record linked).
                </p>
              </div>
            )}

            {/* Audit History */}
            <Card className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
                Student Activity & Compliance Log
              </h2>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-200">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-[11px]">
                        Logged by{" "}
                        <span className="font-semibold text-zinc-300">
                          {log.user?.name || log.user?.email || "System"}
                        </span>
                      </p>
                      {log.changesJson && (
                        <pre className="text-[10px] bg-card p-2 rounded border border-border text-zinc-300 overflow-x-auto">
                          {JSON.stringify(log.changesJson, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Quick Status Cards */}
          <div className="space-y-6">
            {/* Document Checklist Preview Card */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Documents Progress
                </h2>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab("documents")}>
                  Manage →
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Verification Rate</span>
                  <span className="font-bold text-zinc-100">{documentMetrics.percent}%</span>
                </div>
                <Progress value={documentMetrics.percent} aria-label="Document verification rate">
                  <ProgressTrack className="h-2 bg-[#27272a]">
                    <ProgressIndicator className="bg-blue-600" />
                  </ProgressTrack>
                </Progress>
              </div>

              <ul className="space-y-2 pt-2 border-t border-border/60 text-xs">
                {student.documents.slice(0, 4).map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span className="text-zinc-300 font-medium truncate max-w-[150px]">
                      {d.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        d.status === "VERIFIED"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase"
                          : d.status === "RECEIVED"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30 uppercase"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30 uppercase"
                      }
                    >
                      {d.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Payments Overview Card */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Fee Settlement
                </h2>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setActiveTab("payments")}>
                  View All →
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Realized</span>
                  <span className="font-bold text-zinc-100">{paymentMetrics.percent}%</span>
                </div>
                <Progress value={paymentMetrics.percent} aria-label="Fee realization rate">
                  <ProgressTrack className="h-2 bg-[#27272a]">
                    <ProgressIndicator className="bg-purple-600" />
                  </ProgressTrack>
                </Progress>
              </div>

              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-purple-300 font-medium">Paid:</span>
                  <span className="font-bold text-purple-200">
                    ₹{paymentMetrics.paid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-400 font-medium">Remaining:</span>
                  <span className="font-bold text-purple-300">
                    ₹{paymentMetrics.pending.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Documents Checklist */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* Header & Actions */}
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-400" />
                <span>Program Document Checklist</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Curriculum Template:{" "}
                <span className="font-semibold text-zinc-300">{student.program}</span> • Click
                the status toggle button to advance:{" "}
                <span className="font-bold text-amber-400">PENDING</span> →{" "}
                <span className="font-bold text-blue-400">RECEIVED</span> →{" "}
                <span className="font-bold text-emerald-400">VERIFIED</span>.
              </p>
            </div>

            {canEdit && (
              <Button onClick={() => setIsAddDocOpen(true)} className="shrink-0">
                <Plus className="w-4 h-4" />
                <span>Add Custom Requirement</span>
              </Button>
            )}
          </Card>

          {/* Add Document Inline Modal / Form */}
          {isAddDocOpen && (
            <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Add Additional Document Requirement
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setIsAddDocOpen(false)}>
                  Cancel
                </Button>
              </div>
              <form onSubmit={handleAddDocument} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="text"
                  placeholder="Document title (e.g. Caste Certificate, Medical Fitness)"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  required
                  className="flex-1"
                />
                <Input
                  type="url"
                  placeholder="File / Document URL (optional)"
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" isDisabled={isAddingDoc} className="shrink-0">
                  {isAddingDoc ? "Adding..." : "Add to Checklist"}
                </Button>
              </form>
            </div>
          )}

          {/* Documents Cards Checklist */}
          {student.documents.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <FileCheck2 className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-zinc-200">No documents listed</p>
              <p className="text-xs text-muted-foreground">
                Click "Add Custom Requirement" above to define required documents for this student.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {student.documents.map((doc) => {
                const isUpdating = updatingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border transition-all shadow-sm flex flex-col justify-between gap-3 ${
                      doc.status === DocumentStatus.VERIFIED
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : doc.status === DocumentStatus.RECEIVED
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-muted/40 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={`w-4 h-4 shrink-0 ${
                              doc.status === DocumentStatus.VERIFIED
                                ? "text-emerald-400"
                                : doc.status === DocumentStatus.RECEIVED
                                ? "text-blue-400"
                                : "text-zinc-500"
                            }`}
                          />
                          <h4 className="font-bold text-zinc-100 text-sm">{doc.name}</h4>
                        </div>
                        {doc.fileUrl ? (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline font-medium"
                          >
                            <span>View Attached Document</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">
                            No file attachment uploaded
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveDoc(doc.id, doc.name)}
                          className="text-zinc-500 hover:text-rose-400"
                          aria-label="Remove document requirement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Status Toggle Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="text-[11px] text-zinc-400 font-medium">
                        Verification Status:
                      </span>

                      {canEdit ? (
                        <Button
                          onClick={() => handleCycleDocStatus(doc)}
                          isDisabled={isUpdating}
                          className={`uppercase tracking-wider ${
                            doc.status === DocumentStatus.VERIFIED
                              ? "bg-emerald-600 text-white hover:bg-emerald-500"
                              : doc.status === DocumentStatus.RECEIVED
                              ? "bg-blue-600 text-white hover:bg-blue-500"
                              : "bg-[#27272a] text-amber-400 hover:bg-[#3f3f46] border border-amber-500/30"
                          }`}
                          aria-label="Click to cycle: PENDING -> RECEIVED -> VERIFIED"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : doc.status === DocumentStatus.VERIFIED ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : doc.status === DocumentStatus.RECEIVED ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{doc.status}</span>
                        </Button>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`uppercase tracking-wider ${
                            doc.status === DocumentStatus.VERIFIED
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : doc.status === DocumentStatus.RECEIVED
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {doc.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payments Tracker */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Progress Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  <span>Tuition & Fee Installments Progress</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Track scheduled installments, mark payments as received, and monitor pending balances.
                </p>
              </div>

              {canEdit && (
                <Button
                  onClick={() => setIsAddPaymentOpen(true)}
                  className="bg-purple-600 text-white hover:bg-purple-500 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Installment</span>
                </Button>
              )}
            </div>

            {/* Big Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    ₹{paymentMetrics.paid.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    paid of ₹{paymentMetrics.total.toLocaleString()} total
                  </span>
                </div>
                <span className="text-base font-bold text-purple-400">
                  {paymentMetrics.percent}% Realized
                </span>
              </div>
              <Progress value={paymentMetrics.percent} aria-label="Fee realization progress">
                <ProgressTrack className="h-2.5 bg-[#27272a]">
                  <ProgressIndicator className="bg-purple-600" />
                </ProgressTrack>
              </Progress>
            </div>
          </Card>

          {/* Add Installment Form Modal */}
          {isAddPaymentOpen && (
            <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Schedule New Fee Installment
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setIsAddPaymentOpen(false)}>
                  Cancel
                </Button>
              </div>
              <form onSubmit={handleAddPayment} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-zinc-300">
                    Amount (₹ INR)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="500"
                    placeholder="15000"
                    value={newPaymentAmount}
                    onChange={(e) => setNewPaymentAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-zinc-300">
                    Due Date
                  </Label>
                  <Input
                    type="date"
                    value={newPaymentDueDate}
                    onChange={(e) => setNewPaymentDueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    isDisabled={isAddingPayment}
                    className="w-full bg-purple-600 text-white hover:bg-purple-500"
                  >
                    {isAddingPayment ? "Scheduling..." : "Save Installment"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Installments Table */}
          <Card className="p-0 overflow-hidden">
            {student.payments.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CreditCard className="w-10 h-10 text-zinc-600 mx-auto" />
                <p className="text-sm font-bold text-zinc-200">No installments configured</p>
                <p className="text-xs text-muted-foreground">
                  Click "Add Installment" to define fee installments for this student.
                </p>
              </div>
            ) : (
              <Table aria-label="Fee installments">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                    <TableHead>Milestone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                  {student.payments.map((p) => {
                    const isUpdating = updatingPaymentId === p.id;
                    const isOverdue =
                      p.status !== PaymentStatus.PAID &&
                      new Date(p.dueDate) < new Date();

                    return (
                      <TableRow key={p.id} className="border-border/60 hover:bg-muted/40/50 transition-colors">
                        <TableCell className="font-semibold text-zinc-100 text-xs">
                          Installment #{p.installmentNumber}
                        </TableCell>
                        <TableCell className="font-bold text-zinc-100 text-xs">
                          ₹{p.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>
                              {new Date(p.dueDate).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {isOverdue && (
                              <Badge variant="outline" className="bg-rose-500/15 text-rose-400 border-rose-500/25 uppercase">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`uppercase tracking-wider ${
                              p.status === PaymentStatus.PAID
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : isOverdue
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {p.status === PaymentStatus.PAID
                              ? "PAID"
                              : isOverdue
                              ? "OVERDUE"
                              : "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit ? (
                            <Button
                              onClick={() => handleMarkPaymentPaid(p)}
                              isDisabled={isUpdating}
                              variant={p.status === PaymentStatus.PAID ? "outline" : "default"}
                              className={
                                p.status === PaymentStatus.PAID
                                  ? ""
                                  : "bg-emerald-600 text-white hover:bg-emerald-500"
                              }
                            >
                              {isUpdating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : p.status === PaymentStatus.PAID ? (
                                <span>Revert to Pending</span>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark as Paid</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-zinc-500 font-medium">Read-only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Activity Timeline */}
      {activeTab === "timeline" && (
        <ActivityTimeline entityType="STUDENT" entityId={studentId} canEdit={canEdit} />
      )}
    </div>
  );
}
