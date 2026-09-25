"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Mail,
  User,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Role } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type AppModule = "leads" | "students" | "agents" | "reports";
const MODULES: { id: AppModule; label: string }[] = [
  { id: "leads", label: "Leads" },
  { id: "students", label: "Students" },
  { id: "agents", label: "Agents" },
  { id: "reports", label: "Reports" },
];

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  moduleAccess?: string | null;
  createdAt: string;
}

function parseModuleAccess(raw: string | null | undefined): Partial<Record<AppModule, boolean>> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export default function UsersSettingsPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("COUNSELOR");

  // Per-user module permissions editor
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingAccess, setEditingAccess] = useState<Partial<Record<AppModule, boolean>>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load users.");
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err?.message || "An error occurred while loading users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openPermissionsEditor = (u: OrgUser) => {
    setEditingUserId(u.id);
    setEditingAccess(parseModuleAccess(u.moduleAccess));
  };

  const savePermissions = async () => {
    if (!editingUserId) return;
    setSavingPermissions(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/users/${editingUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleAccess: editingAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save permissions.");
      setSuccess("Permissions updated.");
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to save permissions.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add user.");
      }

      setSuccess(`User ${email} added successfully with role ${role}.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("COUNSELOR");
      setShowAddForm(false);
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to add user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (userRole: Role) => {
    switch (userRole) {
      case "ADMIN":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <ShieldCheck className="w-3 h-3" />
            ADMIN
          </Badge>
        );
      case "COUNSELOR":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Shield className="w-3 h-3" />
            COUNSELOR
          </Badge>
        );
      case "READONLY":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
            <Eye className="w-3 h-3" />
            READONLY
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary" />
            Team & User Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage organization members and configure RBAC roles (ADMIN, COUNSELOR, READONLY).
          </p>
        </div>

        <Button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError(null);
            setSuccess(null);
          }}
          className="self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{showAddForm ? "Cancel" : "Add Team Member"}</span>
        </Button>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <AlertDescription className="text-xs text-inherit">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <AlertDescription className="text-xs text-inherit">{success}</AlertDescription>
        </Alert>
      )}

      {/* Add User Form Drawer/Card */}
      {showAddForm && (
        <Card className="space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Add User to Organization
            </h2>
            <p className="text-2xs text-muted-foreground mt-0.5">
              New users will be scoped exclusively to your organization workspace.
            </p>
          </div>

          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-foreground">
                Full Name
              </Label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Taylor"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@institution.edu"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-foreground">
                Temporary Password
              </Label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-foreground">
                Role Assignment
              </Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
              >
                <option value="COUNSELOR">COUNSELOR (Leads/Students/Agents access)</option>
                <option value="ADMIN">ADMIN (Full access + Settings & Users)</option>
                <option value="READONLY">READONLY (View-only across modules)</option>
              </select>
            </div>

            <div className="md:col-span-2 pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isDisabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? "Creating User..." : "Confirm & Add User"}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Role Definitions Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card size="sm" className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>ADMIN Role</span>
          </div>
          <p className="text-2xs text-muted-foreground">
            Full access to all modules, system settings, and user provisioning.
          </p>
        </Card>

        <Card size="sm" className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>COUNSELOR Role</span>
          </div>
          <p className="text-2xs text-muted-foreground">
            Full access to Leads, Students, and Agents. No access to Settings or user management.
          </p>
        </Card>

        <Card size="sm" className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span>READONLY Role</span>
          </div>
          <p className="text-2xs text-muted-foreground">
            View-only across all modules. Mutation actions (create/edit/delete) are strictly prevented.
          </p>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Active Members ({users.length})
          </h2>
          <span className="text-2xs text-muted-foreground">Scoped to organization</span>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
            <p className="text-xs">Loading users from scoped database...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            No users found for this organization.
          </div>
        ) : (
          <Table aria-label="Organization members">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead>Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const access = parseModuleAccess(u.moduleAccess);
                const restrictedModules = MODULES.filter((m) => access[m.id] === false);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {u.name || "No name set"}
                      </div>
                      <div className="text-2xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {u.role === "ADMIN" ? (
                        <span className="text-2xs text-muted-foreground">Full access</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {restrictedModules.length > 0 ? (
                            <span className="text-2xs text-amber-500">
                              {restrictedModules.length} module{restrictedModules.length > 1 ? "s" : ""} restricted
                            </span>
                          ) : (
                            <span className="text-2xs text-muted-foreground">Full access</span>
                          )}
                          <Button variant="outline" size="xs" onClick={() => openPermissionsEditor(u)}>
                            Edit
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {editingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Module permissions</h3>
            <p className="text-2xs text-muted-foreground">
              Unchecked modules stay fully accessible (default). Uncheck to restrict access.
            </p>
            <div className="space-y-2">
              {MODULES.map((m) => {
                const checked = editingAccess[m.id] !== false;
                return (
                  <label key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{m.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setEditingAccess((prev) => ({ ...prev, [m.id]: e.target.checked }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={savePermissions} isDisabled={savingPermissions}>
                {savingPermissions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save</span>
              </Button>
              <Button variant="ghost" onClick={() => setEditingUserId(null)} isDisabled={savingPermissions}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
