"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changesJson: any;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  // Filter options
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Active filters
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [dateRange, setDateRange] = useState("all");

  // Detail / Diff Dialog
  const [activeLog, setActiveLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "25");
      if (search.trim()) params.set("search", search.trim());
      if (selectedAction !== "ALL") params.set("action", selectedAction);
      if (selectedEntity !== "ALL") params.set("entityType", selectedEntity);
      if (selectedUser !== "ALL") params.set("userId", selectedUser);
      if (dateRange !== "all") params.set("dateRange", dateRange);

      const res = await fetch(`/api/settings/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalCount(data.pagination?.totalCount || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        if (data.filters?.actions) setAvailableActions(data.filters.actions);
        if (data.filters?.entityTypes) setAvailableEntities(data.filters.entityTypes);
        if (data.filters?.users) setAvailableUsers(data.filters.users);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [page, selectedAction, selectedEntity, selectedUser, dateRange, isAdmin]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAdmin) {
        setPage(1);
        fetchLogs();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // CSV Export
  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "Log ID",
      "Timestamp",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Action",
      "Entity Type",
      "Entity ID",
      "Details / Diff",
    ];

    const rows = logs.map((log) => {
      const detailsStr = log.changesJson ? JSON.stringify(log.changesJson).replace(/"/g, '""') : "";
      return [
        log.id,
        new Date(log.createdAt).toISOString(),
        `"${(log.user?.name || "System Automated").replace(/"/g, '""')}"`,
        `"${(log.user?.email || "system@internal").replace(/"/g, '""')}"`,
        log.user?.role || "SYSTEM",
        log.action,
        log.entityType,
        log.entityId,
        `"${detailsStr}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // RBAC Access Restriction View for Non-Admins
  if (!isAdmin && session?.user) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Access Restricted</h2>
        <p className="text-sm text-zinc-400">
          Audit logs contain security-sensitive event histories and are strictly accessible to Organization Administrators only.
        </p>
        <Link href="/leads" className={buttonVariants()}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const getActionBadgeVariant = (action: string): "destructive" | "default" | "secondary" | "outline" => {
    if (action.includes("DELETE") || action.includes("REMOVE") || action.includes("LOST")) {
      return "destructive";
    }
    if (action.includes("CREATE") || action.includes("ENROLLED") || action.includes("PAID")) {
      return "default";
    }
    if (action.includes("STAGE") || action.includes("REASSIGN")) {
      return "secondary";
    }
    return "outline";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-primary" />
              Audit Log & Compliance
            </h1>
            <Badge variant="secondary">{totalCount} events</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Complete tamper-evident log of who changed what, when, and from which IP or session across all CRM modules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            isDisabled={logs.length === 0}
            title="Export filtered audit log to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            onClick={fetchLogs}
            isDisabled={loading}
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <Input
              type="text"
              placeholder="Search user, action, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
          >
            <option value="ALL">All Actions</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          {/* Entity Type Filter */}
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
          >
            <option value="ALL">All Entity Types</option>
            {availableEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>

          {/* User Filter */}
          <select
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
          >
            <option value="ALL">All Team Members</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.role})
              </option>
            ))}
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
          >
            <option value="all">All Time</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
            <option value="90d">Past 90 Days</option>
          </select>
        </div>
      </Card>

      {/* Table View */}
      <Card className="p-0 overflow-hidden">
        <Table aria-label="Audit log entries">
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-zinc-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading audit trail...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-zinc-500">
                  No audit records matching active criteria.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  {/* Timestamp */}
                  <TableCell className="text-zinc-400 font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>

                  {/* Actor */}
                  <TableCell>
                    {log.user ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[4px] bg-muted/40 border border-border text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                          {(log.user.name || log.user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-200 leading-tight">
                            {log.user.name || "Staff Member"}
                          </p>
                          <span className="text-[10px] text-zinc-500">{log.user.email}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 italic">
                        System Automated
                      </span>
                    )}
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                  </TableCell>

                  {/* Entity Type */}
                  <TableCell className="font-medium text-zinc-300">{log.entityType}</TableCell>

                  {/* Entity ID */}
                  <TableCell className="font-mono text-[11px] text-zinc-400">
                    {log.entityType === "Lead" ? (
                      <Link
                        href={`/leads/${log.entityId}`}
                        className="hover:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate max-w-[120px]">{log.entityId}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </Link>
                    ) : log.entityType === "Student" ? (
                      <Link
                        href={`/students/${log.entityId}`}
                        className="hover:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate max-w-[120px]">{log.entityId}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className="truncate max-w-[120px] inline-block">{log.entityId}</span>
                    )}
                  </TableCell>

                  {/* Action details inspector */}
                  <TableCell className="text-right">
                    {log.changesJson ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveLog(log)}
                        className="text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Diff</span>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-zinc-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-background flex items-center justify-between text-xs text-zinc-400">
            <div>
              Showing page <span className="font-semibold text-zinc-200">{page}</span> of{" "}
              <span className="font-semibold text-zinc-200">{totalPages}</span> ({totalCount} total entries)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                isDisabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                isDisabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Diff / Details Modal */}
      <Dialog
        isOpen={!!activeLog}
        onOpenChange={(open) => !open && setActiveLog(null)}
        showCloseButton={false}
        className="sm:max-w-xl"
      >
        {activeLog && (
          <>
            <DialogHeader className="flex-row items-start justify-between">
              <div>
                <DialogTitle>Audit Record Inspector</DialogTitle>
                <DialogDescription>
                  {activeLog.action} on {activeLog.entityType} ({activeLog.entityId})
                </DialogDescription>
              </div>
              <DialogClose variant="ghost" size="icon-sm">
                <X className="w-4 h-4" />
              </DialogClose>
            </DialogHeader>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-zinc-300 bg-muted/40 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-zinc-500">Timestamp:</span>{" "}
                  <span className="font-mono text-zinc-300">{new Date(activeLog.createdAt).toISOString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Actor:</span>{" "}
                  <span className="text-zinc-300">{activeLog.user?.email || "System"}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-zinc-300 mb-1">Payload / State Changes:</h4>
                <pre className="p-3 bg-background text-emerald-400 border border-border rounded-lg overflow-x-auto font-mono text-[11px]">
                  {JSON.stringify(activeLog.changesJson, null, 2)}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <DialogClose>Close</DialogClose>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}
