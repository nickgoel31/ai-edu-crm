"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Users,
  Plus,
  Loader2,
  AlertCircle,
  ChevronRight,
  GraduationCap,
  Clock,
} from "lucide-react";
import { WEEKDAYS, type Weekday } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface FacultyOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface BatchItem {
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
  faculty: { id: string; name: string | null; email: string } | null;
  _count: { students: number };
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

function formatSchedule(days: string[], time: string | null): string {
  const dayLabel =
    days.length === 0
      ? "No days set"
      : days.map((d) => DAY_LABELS[d as Weekday] || d).join(", ");
  if (!time) return dayLabel;
  const formatted = formatTimeRange(time);
  return `${dayLabel} · ${formatted}`;
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

const emptyForm = {
  name: "",
  program: "",
  facultyUserId: "",
  startDate: "",
  endDate: "",
  scheduleDays: [] as string[],
  scheduleTime: "",
  capacity: "",
};

export default function BatchesPage() {
  const { data: session } = useSession();
  const canMutate = session?.user?.role === "ADMIN" || session?.user?.role === "COUNSELOR";

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load batches.");
      setBatches(data.batches || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load batches.");
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
      // Non-fatal: faculty picker just stays empty.
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchFacultyOptions();
  }, []);

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day)
        ? f.scheduleDays.filter((d) => d !== day)
        : [...f.scheduleDays, day],
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const handleCreate = async () => {
    setFormError(null);

    if (!form.name.trim() || !form.program.trim() || !form.startDate) {
      setFormError("Name, program, and start date are required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          program: form.program.trim(),
          facultyUserId: form.facultyUserId || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          scheduleDays: form.scheduleDays,
          scheduleTime: form.scheduleTime.trim() || null,
          capacity: form.capacity ? Number(form.capacity) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create batch.");

      setIsCreateOpen(false);
      resetForm();
      fetchBatches();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create batch.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalStudents = useMemo(
    () => batches.reduce((sum, b) => sum + b._count.students, 0),
    [batches]
  );
  const activeCount = useMemo(() => batches.filter((b) => b.isActive).length, [batches]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Batches & Timetable
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage class batches, faculty assignment, rosters, and daily attendance.
          </p>
        </div>

        {canMutate && (
          <Button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Batch</span>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Total Batches</span>
            <span className="p-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-lg">
              <CalendarDays className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">{batches.length}</div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Active Batches</span>
            <span className="p-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg">
              <GraduationCap className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">{activeCount}</div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Students Enrolled</span>
            <span className="p-1.5 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-lg">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">{totalStudents}</div>
        </Card>
      </div>

      {/* Batch Grid */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
          <p className="text-sm font-medium">Loading batches...</p>
        </div>
      ) : batches.length === 0 ? (
        <Card className="py-16 text-center space-y-2">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No batches yet</h3>
          <p className="text-xs text-muted-foreground">
            {canMutate
              ? "Create your first batch to start scheduling classes and tracking attendance."
              : "No batches have been created yet."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => {
            const capacityLabel =
              batch.capacity !== null ? `${batch._count.students} / ${batch.capacity}` : `${batch._count.students}`;
            const overCapacity =
              batch.capacity !== null && batch._count.students >= batch.capacity;

            return (
              <Link key={batch.id} href={`/batches/${batch.id}`} className="group block">
                <Card className="p-0 flex-col justify-between overflow-hidden h-full transition-all hover:ring-1 hover:ring-blue-500/40">
                  <div className="p-4 border-b border-border space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {batch.name}
                        </h3>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {batch.program}
                        </span>
                      </div>
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

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatSchedule(batch.scheduleDays, batch.scheduleTime)}</span>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-2 flex-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Faculty / Instructor</span>
                      <span className="font-medium text-foreground">
                        {batch.faculty?.name || batch.faculty?.email || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Students</span>
                      <span className={`font-medium ${overCapacity ? "text-amber-500" : "text-foreground"}`}>
                        {capacityLabel}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 border-t border-border bg-card flex items-center justify-end gap-1 text-xs font-semibold text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    <span>Manage Batch</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}
        isDismissable={!isSaving}
      >
        <DialogHeader>
          <DialogTitle>New Batch</DialogTitle>
          <DialogDescription>
            Set up a class batch with a schedule, faculty, and capacity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label>Batch Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Data Science - Evening Batch A"
            />
          </div>

          <div className="space-y-1">
            <Label>Program *</Label>
            <Input
              value={form.program}
              onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}
              placeholder="e.g. Data Science"
            />
          </div>

          <div className="space-y-1">
            <Label>Faculty / Instructor</Label>
            <Select
              selectedKey={form.facultyUserId || null}
              onSelectionChange={(key) =>
                setForm((f) => ({ ...f, facultyUserId: (key as string) || "" }))
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
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
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
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                    form.scheduleDays.includes(day)
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
                value={form.scheduleTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduleTime: e.target.value }))}
                placeholder="18:00-19:30"
              />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="e.g. 30"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsCreateOpen(false)} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isDisabled={isSaving}>
            {isSaving ? "Creating..." : "Create Batch"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
