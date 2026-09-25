"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Clock,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import { WEEKDAYS, ClassAttendanceStatus, type Weekday } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface FacultyOption {
  id: string;
  name: string | null;
  email: string;
}

interface RosterStudent {
  id: string;
  name: string;
  phone: string;
  email: string;
  program: string;
  stage: string;
  attendance: {
    totalSessions: number;
    presentCount: number;
    attendancePercent: number | null;
  };
}

interface BatchDetail {
  id: string;
  name: string;
  program: string;
  facultyUserId: string | null;
  startDate: string;
  endDate: string | null;
  scheduleDays: string[];
  scheduleTime: string | null;
  capacity: number | null;
  isActive: boolean;
  faculty: FacultyOption | null;
  students: RosterStudent[];
  recentAttendance: Array<{
    date: string;
    statuses: Array<{ studentId: string; status: string | null }>;
  }>;
}

interface StudentOption {
  id: string;
  name: string;
  phone: string;
  program: string;
  batchId: string | null;
}

const DAY_LABELS: Record<Weekday, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "P", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  ABSENT: { label: "A", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  LATE: { label: "L", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTimeRange(time: string): string {
  const parts = time.split("-").map((t) => t.trim());
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":");
    const h = Number(hStr);
    if (Number.isNaN(h)) return t;
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${mStr || "00"} ${period}`;
  };
  return parts.map(fmt).join(" – ");
}

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const batchId = params.id as string;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const canMutate = session?.user?.role === "ADMIN" || session?.user?.role === "COUNSELOR";

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [isDeleting, setIsDeleting] = useState(false);

  // Add students dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(todayStr());
  const [attendanceRoster, setAttendanceRoster] = useState<
    Array<{ studentId: string; name: string; status: string | null }>
  >([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const fetchBatch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load batch.");
      setBatch(data.batch);
    } catch (err: any) {
      setError(err?.message || "Failed to load batch.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFacultyOptions = async () => {
    try {
      const res = await fetch("/api/batches/faculty-options");
      const data = await res.json();
      if (res.ok) setFacultyOptions(data.users || []);
    } catch {
      // Non-fatal
    }
  };

  const fetchAttendance = async (date: string) => {
    setIsAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/attendance?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load attendance.");
      setAttendanceRoster(
        (data.roster || []).map((r: any) => ({
          studentId: r.studentId,
          name: r.name,
          status: r.status,
        }))
      );
    } catch (err: any) {
      setAttendanceError(err?.message || "Failed to load attendance.");
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchBatch();
      fetchFacultyOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (batchId && attendanceDate) {
      fetchAttendance(attendanceDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, attendanceDate]);

  const openEdit = () => {
    if (!batch) return;
    setEditForm({
      name: batch.name,
      program: batch.program,
      facultyUserId: batch.facultyUserId || "",
      startDate: batch.startDate.slice(0, 10),
      endDate: batch.endDate ? batch.endDate.slice(0, 10) : "",
      scheduleDays: batch.scheduleDays,
      scheduleTime: batch.scheduleTime || "",
      capacity: batch.capacity !== null ? String(batch.capacity) : "",
      isActive: batch.isActive,
    });
    setEditError(null);
    setIsEditOpen(true);
  };

  const toggleEditDay = (day: string) => {
    setEditForm((f: any) => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day)
        ? f.scheduleDays.filter((d: string) => d !== day)
        : [...f.scheduleDays, day],
    }));
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.name.trim() || !editForm.program.trim() || !editForm.startDate) {
      setEditError("Name, program, and start date are required.");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          program: editForm.program.trim(),
          facultyUserId: editForm.facultyUserId || null,
          startDate: editForm.startDate,
          endDate: editForm.endDate || null,
          scheduleDays: editForm.scheduleDays,
          scheduleTime: editForm.scheduleTime.trim() || null,
          capacity: editForm.capacity ? Number(editForm.capacity) : null,
          isActive: editForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update batch.");
      setIsEditOpen(false);
      setSuccess("Batch updated.");
      setTimeout(() => setSuccess(null), 3000);
      fetchBatch();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update batch.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!confirm(`Delete batch "${batch?.name}"? Students will be unassigned. This cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/batches/${batchId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete batch.");
      router.push("/batches");
    } catch (err: any) {
      setError(err?.message || "Failed to delete batch.");
      setIsDeleting(false);
    }
  };

  const openAddStudents = async () => {
    setIsAddOpen(true);
    setSelectedStudentIds([]);
    setAssignError(null);
    setStudentsLoading(true);
    try {
      const res = await fetch("/api/students?sortBy=name&sortOrder=asc");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load students.");
      setAllStudents(
        (data.students || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          program: s.program,
          batchId: s.batchId,
        }))
      );
    } catch (err: any) {
      setAssignError(err?.message || "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }
  };

  const eligibleStudents = useMemo(() => {
    const enrolledIds = new Set(batch?.students.map((s) => s.id) || []);
    return allStudents
      .filter((s) => !enrolledIds.has(s.id))
      .filter((s) =>
        studentSearch.trim()
          ? s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.phone.includes(studentSearch)
          : true
      );
  }, [allStudents, batch, studentSearch]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssignStudents = async () => {
    if (selectedStudentIds.length === 0) {
      setAssignError("Select at least one student.");
      return;
    }
    setIsAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to assign students.");
      setIsAddOpen(false);
      setSuccess(`${data.count} student(s) added to batch.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchBatch();
    } catch (err: any) {
      setAssignError(err?.message || "Failed to assign students.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, name: string) => {
    if (!confirm(`Remove ${name} from this batch?`)) return;
    try {
      const res = await fetch(`/api/batches/${batchId}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove student.");
      setSuccess(`${name} removed from batch.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchBatch();
    } catch (err: any) {
      setError(err?.message || "Failed to remove student.");
    }
  };

  const setAttendanceStatus = (studentId: string, status: string) => {
    setAttendanceRoster((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  };

  const handleSaveAttendance = async () => {
    const records = attendanceRoster
      .filter((r) => r.status)
      .map((r) => ({ studentId: r.studentId, status: r.status }));

    if (records.length === 0) {
      setAttendanceError("Mark at least one student before saving.");
      return;
    }

    setIsSavingAttendance(true);
    setAttendanceError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: attendanceDate, records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save attendance.");
      setSuccess(`Attendance saved for ${records.length} student(s).`);
      setTimeout(() => setSuccess(null), 3000);
      fetchBatch();
    } catch (err: any) {
      setAttendanceError(err?.message || "Failed to save attendance.");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p className="text-sm font-medium">Loading batch...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error || "Batch not found."}</AlertDescription>
        </Alert>
        <Link href="/batches" className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Batches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-3 border-b border-border pb-4">
        <Link href="/batches" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Batches
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{batch.name}</h1>
              <Badge
                variant="outline"
                className={
                  batch.isActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 uppercase"
                    : "bg-muted text-muted-foreground border-border uppercase"
                }
              >
                {batch.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{batch.program}</p>
          </div>

          {canMutate && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              {isAdmin && (
                <Button variant="destructive" onClick={handleDeleteBatch} isDisabled={isDeleting}>
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

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

      {/* Batch Info Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {batch.scheduleDays.length > 0
              ? batch.scheduleDays.map((d) => DAY_LABELS[d as Weekday] || d).join(", ")
              : "No days set"}
          </div>
          {batch.scheduleTime && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {formatTimeRange(batch.scheduleTime)}
            </div>
          )}
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Duration</span>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {new Date(batch.startDate).toLocaleDateString()} –{" "}
            {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : "Ongoing"}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Faculty / Instructor</span>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {batch.faculty?.name || batch.faculty?.email || "Unassigned"}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Capacity</span>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {batch.students.length}
            {batch.capacity !== null ? ` / ${batch.capacity}` : ""}
          </div>
        </Card>
      </div>

      {/* Roster */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Roster</h2>
            <p className="text-[11px] text-muted-foreground">{batch.students.length} student(s) enrolled</p>
          </div>
          {canMutate && (
            <Button size="sm" onClick={openAddStudents}>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Students</span>
            </Button>
          )}
        </div>

        {batch.students.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No students enrolled yet.
          </div>
        ) : (
          <Table aria-label="Roster">
            <TableHeader>
              <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead>Student</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Attendance %</TableHead>
                {canMutate && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {batch.students.map((s) => (
                <TableRow key={s.id} className="border-border/60">
                  <TableCell>
                    <Link href={`/students/${s.id}`} className="font-medium text-foreground hover:text-blue-400 hover:underline text-xs">
                      {s.name}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">{s.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs">{s.program}</TableCell>
                  <TableCell className="text-xs">
                    {s.attendance.attendancePercent !== null ? (
                      <span
                        className={
                          s.attendance.attendancePercent >= 75
                            ? "text-emerald-500 font-semibold"
                            : s.attendance.attendancePercent >= 50
                            ? "text-amber-500 font-semibold"
                            : "text-rose-500 font-semibold"
                        }
                      >
                        {s.attendance.attendancePercent}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No records</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({s.attendance.presentCount}/{s.attendance.totalSessions})
                    </span>
                  </TableCell>
                  {canMutate && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveStudent(s.id, s.name)}>
                        <X className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Attendance */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Attendance</h2>
            <p className="text-[11px] text-muted-foreground">Mark today's or any date's attendance for the roster.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-auto"
            />
            {canMutate && (
              <Button size="sm" onClick={handleSaveAttendance} isDisabled={isSavingAttendance || isAttendanceLoading}>
                {isSavingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Attendance</span>
              </Button>
            )}
          </div>
        </div>

        {attendanceError && (
          <div className="px-4 pt-3">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{attendanceError}</AlertDescription>
            </Alert>
          </div>
        )}

        {isAttendanceLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
            <p className="text-xs">Loading attendance...</p>
          </div>
        ) : attendanceRoster.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No students enrolled to mark attendance for.
          </div>
        ) : (
          <Table aria-label="Attendance">
            <TableHeader>
              <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {attendanceRoster.map((r) => (
                <TableRow key={r.studentId} className="border-border/60">
                  <TableCell className="text-xs font-medium text-foreground">{r.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {Object.values(ClassAttendanceStatus).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={!canMutate}
                          onClick={() => setAttendanceStatus(r.studentId, status)}
                          className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            r.status === status
                              ? STATUS_META[status].className
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {status === "PRESENT" ? "Present" : status === "ABSENT" ? "Absent" : "Late"}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Recent Attendance History */}
      {batch.recentAttendance.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Recent Attendance History</h2>
            <p className="text-[11px] text-muted-foreground">Last {batch.recentAttendance.length} session date(s).</p>
          </div>
          <Table aria-label="Recent Attendance">
            <TableHeader>
              <TableRow className="bg-muted/40 border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/40">
                <TableHead>Student</TableHead>
                {batch.recentAttendance.map((d) => (
                  <TableHead key={d.date} className="text-center">
                    {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {batch.students.map((s) => (
                <TableRow key={s.id} className="border-border/60">
                  <TableCell className="text-xs font-medium text-foreground">{s.name}</TableCell>
                  {batch.recentAttendance.map((d) => {
                    const status = d.statuses.find((x) => x.studentId === s.id)?.status;
                    return (
                      <TableCell key={d.date} className="text-center">
                        {status ? (
                          <Badge variant="outline" className={STATUS_META[status]?.className}>
                            {STATUS_META[status]?.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">–</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Dialog */}
      {editForm && (
        <Dialog
          isOpen={isEditOpen}
          onOpenChange={(open) => setIsEditOpen(open)}
          isDismissable={!isSavingEdit}
        >
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {editError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label>Batch Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Program *</Label>
              <Input
                value={editForm.program}
                onChange={(e) => setEditForm((f: any) => ({ ...f, program: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Faculty / Instructor</Label>
              <Select
                selectedKey={editForm.facultyUserId || null}
                onSelectionChange={(key) =>
                  setEditForm((f: any) => ({ ...f, facultyUserId: (key as string) || "" }))
                }
                placeholder="Unassigned"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {facultyOptions.map((u) => (
                    <SelectItem key={u.id} id={u.id} textValue={u.name || u.email}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Schedule Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleEditDay(day)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                      editForm.scheduleDays.includes(day)
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Schedule Time</Label>
                <Input
                  value={editForm.scheduleTime}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, scheduleTime: e.target.value }))}
                  placeholder="18:00-19:30"
                />
              </div>
              <div className="space-y-1">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                isSelected={editForm.isActive}
                onChange={(checked) => setEditForm((f: any) => ({ ...f, isActive: checked }))}
              />
              <Label>Batch is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} isDisabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} isDisabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Add Students Dialog */}
      <Dialog
        isOpen={isAddOpen}
        onOpenChange={(open) => setIsAddOpen(open)}
        isDismissable={!isAssigning}
      >
        <DialogHeader>
          <DialogTitle>Add Students</DialogTitle>
          <DialogDescription>Select students to enroll in this batch.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {assignError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{assignError}</AlertDescription>
            </Alert>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="pl-8"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5">
            {studentsLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : eligibleStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No unassigned students match your search.
              </div>
            ) : (
              eligibleStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    isSelected={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudentSelection(s.id)}
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-foreground">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.program} · {s.phone}
                      {s.batchId ? " · Already in another batch" : ""}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsAddOpen(false)} isDisabled={isAssigning}>
            Cancel
          </Button>
          <Button onClick={handleAssignStudents} isDisabled={isAssigning || selectedStudentIds.length === 0}>
            {isAssigning ? "Adding..." : `Add ${selectedStudentIds.length || ""} Student(s)`}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
