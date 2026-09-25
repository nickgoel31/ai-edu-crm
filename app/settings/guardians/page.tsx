"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Users,
  ArrowLeft,
  Plus,
  Loader2,
  ShieldAlert,
  Mail,
  Phone,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface GuardianRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  student: { id: string; name: string; program: string; cohort: string; stage: string } | null;
}

interface StudentOption {
  id: string;
  name: string;
  program: string;
  cohort: string;
}

export default function GuardiansSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const fetchGuardians = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/guardians");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load guardians");
      setGuardians(data.guardians || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load guardians");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/students?sortBy=name&sortOrder=asc");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load students");
      setStudents(
        (data.students || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          program: s.program,
          cohort: s.cohort,
        }))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load students for the picker");
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchGuardians();
      fetchStudents();
    }
  }, [session]);

  const handleOpenCreate = () => {
    setSelectedStudentId(students[0]?.id || "");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !name.trim() || !email.trim() || !password) {
      toast.error("Please fill in student, name, email, and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create guardian account");
      toast.success(`Guardian account created for ${name.trim()}`);
      setIsModalOpen(false);
      fetchGuardians();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-rose-400" />
        <h2 className="font-heading text-xl font-bold text-white">Admin Access Required</h2>
        <p className="text-xs text-zinc-400">
          Only organization administrators can manage parent/guardian portal accounts.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Settings</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Settings
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-xs font-medium text-zinc-300">Guardian Accounts</span>
          </div>
          <h1 className="flex items-center gap-2.5 font-heading text-2xl font-bold tracking-tight text-white">
            <Users className="h-6 w-6 text-blue-400" />
            <span>Parent/Guardian Accounts</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Create login access for a parent or guardian, scoped to exactly one student.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>New Guardian Account</span>
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-zinc-500" />
            <p className="text-xs text-zinc-400">Loading guardian accounts...</p>
          </div>
        ) : guardians.length === 0 ? (
          <div className="space-y-3 p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-zinc-600" />
            <h4 className="text-sm font-semibold text-white">No guardian accounts yet</h4>
            <p className="mx-auto max-w-sm text-xs text-zinc-400">
              Create one to give a parent portal access to a student's attendance, fees, and
              documents.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {guardians.map((g) => (
              <div
                key={g.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{g.name}</span>
                    {g.student ? (
                      <Badge variant="outline">{g.student.name}</Badge>
                    ) : (
                      <Badge variant="destructive">No linked student</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {g.email}
                    </span>
                    {g.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {g.phone}
                      </span>
                    )}
                    {g.student && (
                      <span>
                        {g.student.program} &middot; {g.student.cohort}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New Guardian Account Modal */}
      <Dialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        isDismissable={!isSubmitting}
        className="sm:max-w-[460px]"
      >
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-400" />
              New Guardian Account
            </DialogTitle>
            <DialogDescription>
              This creates login access for the parent portal, scoped to exactly one student.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>
                Student <span className="text-rose-400">*</span>
              </Label>
              <Select
                selectedKey={selectedStudentId}
                onSelectionChange={(key) => setSelectedStudentId(String(key))}
                isRequired
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} id={s.id}>
                      {s.name} &mdash; {s.program} ({s.cohort})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {students.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No students found. Add a student first.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guardianName">
                Guardian Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="guardianName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guardianEmail">
                  Email <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="guardianEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardianPhone">Phone</Label>
                <Input
                  id="guardianPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guardianPassword">
                Portal Password <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="guardianPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isDisabled={isSubmitting || !selectedStudentId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
