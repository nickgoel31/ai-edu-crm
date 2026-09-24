"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  PanelLeftClose,
  PanelLeft,
  Home,
  MessageSquare,
  Settings,
  Building2,
  Users,
  Bot,
  BarChart3,
  Bell,
  Sliders,
  CheckCircle2,
  Clock,
  Flame,
  UserCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TreeSubItem {
  name: string;
  href: string;
  stageParam?: string;
  viewParam?: string;
  tabParam?: string;
}

export function Sidebar() {
  return (
    <Suspense fallback={<div className="hidden md:flex w-60 bg-background h-screen border-r border-border" />}>
      <SidebarContent />
    </Suspense>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Submodule tree expansion states
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [studentsExpanded, setStudentsExpanded] = useState(true);

  // Automatically expand tree if current path matches
  useEffect(() => {
    if (pathname?.startsWith("/leads")) setLeadsExpanded(true);
    if (pathname?.startsWith("/students")) setStudentsExpanded(true);
  }, [pathname]);

  const organizationName = session?.user?.organizationName || "Workspace";
  const userName = session?.user?.name || "harsh";
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  // Initial letter badge
  const initial = (userName || organizationName)[0]?.toUpperCase() || "H";

  const currentStage = searchParams?.get("stage");
  const currentView = searchParams?.get("view");
  const currentTab = searchParams?.get("tab");

  const leadsSubItems: TreeSubItem[] = [
    { name: "Kanban Pipeline", href: "/leads", viewParam: "kanban" },
    { name: "Table View", href: "/leads?view=table", viewParam: "table" },
    { name: "Cold Leads", href: "/leads?stage=COLD", stageParam: "COLD" },
    { name: "Warm Leads", href: "/leads?stage=WARM", stageParam: "WARM" },
    { name: "Hot Inquiries", href: "/leads?stage=HOT", stageParam: "HOT" },
    { name: "Converting", href: "/leads?stage=CONVERTING", stageParam: "CONVERTING" },
    { name: "Lost / Closed", href: "/leads?stage=LOST", stageParam: "LOST" },
  ];

  const studentsSubItems: TreeSubItem[] = [
    { name: "All Students", href: "/students" },
    { name: "Enrolled", href: "/students?stage=ENROLLED", stageParam: "ENROLLED" },
    { name: "Active Learners", href: "/students?stage=ACTIVE", stageParam: "ACTIVE" },
    { name: "Alumni", href: "/students?stage=ALUMNI", stageParam: "ALUMNI" },
    { name: "Document Checklist", href: "/students?tab=documents", tabParam: "documents" },
    { name: "Fee Installments", href: "/students?tab=payments", tabParam: "payments" },
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-background text-foreground border-r border-border h-screen sticky top-0 shrink-0 transition-all duration-300 select-none z-30 font-sans",
        isCollapsed ? "w-[56px]" : "w-60"
      )}
    >
      {/* ── 1. Top Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 h-[48px]">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 min-w-0">
            {/* Green avatar square */}
            <div className="w-[22px] h-[22px] rounded-[5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-[11px] shrink-0">
              {initial}
            </div>
            {/* Name + chevron */}
            <button className="flex items-center gap-1 min-w-0 cursor-pointer hover:text-foreground transition-colors group">
              <span className="text-[13px] font-semibold text-foreground group-hover:text-foreground truncate leading-none">
                {userName.toLowerCase().split(" ")[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground/80 shrink-0" />
            </button>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-6 h-6 rounded-[5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-xs">
              {initial}
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onPress={() => {
                const searchInput = document.querySelector('input[type="text"]');
                if (searchInput) (searchInput as HTMLInputElement).focus();
              }}
              title="Quick Search"
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onPress={() => setIsCollapsed(true)}
              title="Collapse sidebar"
            >
              <PanelLeftClose />
            </Button>
          </div>
        )}

        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onPress={() => setIsCollapsed(false)}
            title="Expand sidebar"
          >
            <PanelLeft />
          </Button>
        )}
      </div>

      {/* ── 2. Quick Action Bar ────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-2.5 pb-3 flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all",
              pathname === "/"
                ? "bg-muted border border-border text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>

          <Link
            href="/agents"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="AI Conversations"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/settings"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              pathname?.startsWith("/settings") && pathname !== "/settings/notifications"
                ? "bg-muted border border-border text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── 3. Section Label ───────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-4 pt-0.5 pb-1.5">
          <span className="text-[10.5px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
            Workspace
          </span>
        </div>
      )}

      {/* ── 4. Navigation ─────────────────────────────────────── */}
      <nav className="flex-1 px-1.5 space-y-0.5 overflow-y-auto overflow-x-hidden pb-4">

        {/* LEADS (with tree) */}
        <div>
          {/* Parent row */}
          <div
            onClick={() => {
              if (isCollapsed) setIsCollapsed(false);
              setLeadsExpanded(!leadsExpanded);
            }}
            className={cn(
              "group relative flex items-center justify-between px-2.5 py-[7px] rounded-lg text-sm cursor-pointer transition-colors",
              pathname?.startsWith("/leads")
                ? "text-foreground bg-muted/70 border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {/* Left active bar */}
            {pathname?.startsWith("/leads") && (
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-blue-500" />
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              {/* Solid colored icon badge */}
              <div className="w-[22px] h-[22px] rounded-[6px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <Link
                  href="/leads"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "truncate text-[13px] font-medium",
                    pathname?.startsWith("/leads") ? "text-foreground font-semibold" : "text-foreground/80 group-hover:text-foreground"
                  )}
                >
                  Leads
                </Link>
              )}
            </div>

            {!isCollapsed && (
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-transform duration-200 shrink-0",
                  leadsExpanded && "rotate-90 text-muted-foreground"
                )}
              />
            )}
          </div>

          {/* Tree children */}
          {!isCollapsed && leadsExpanded && (
            <div className="relative ml-[22px] pl-3 border-l border-border my-0.5 space-y-0.5">
              {leadsSubItems.map((sub) => {
                const isSubActive =
                  pathname === "/leads" &&
                  ((sub.stageParam && currentStage === sub.stageParam) ||
                    (sub.viewParam && currentView === sub.viewParam) ||
                    (!sub.stageParam && !sub.viewParam && !currentStage && !currentView));

                return (
                  <Link
                    key={sub.name}
                    href={sub.href}
                    className={cn(
                      "relative flex items-center gap-2 py-[5px] px-2 rounded-md text-[12px] transition-colors",
                      "before:absolute before:-left-[13px] before:top-1/2 before:w-2.5 before:h-px before:bg-border",
                      isSubActive
                        ? "text-foreground font-medium bg-muted border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                        isSubActive
                          ? "bg-blue-600 dark:bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,0.5)]"
                          : "bg-zinc-400/60 dark:bg-zinc-700"
                      )}
                    />
                    <span className="truncate">{sub.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* STUDENTS (with tree) */}
        <div>
          <div
            onClick={() => {
              if (isCollapsed) setIsCollapsed(false);
              setStudentsExpanded(!studentsExpanded);
            }}
            className={cn(
              "group relative flex items-center justify-between px-2.5 py-[7px] rounded-lg text-sm cursor-pointer transition-colors",
              pathname?.startsWith("/students")
                ? "text-foreground bg-muted/70 border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {pathname?.startsWith("/students") && (
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-violet-500" />
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-[22px] h-[22px] rounded-[6px] bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <Link
                  href="/students"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "truncate text-[13px] font-medium",
                    pathname?.startsWith("/students") ? "text-foreground font-semibold" : "text-foreground/80 group-hover:text-foreground"
                  )}
                >
                  Students
                </Link>
              )}
            </div>

            {!isCollapsed && (
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-transform duration-200 shrink-0",
                  studentsExpanded && "rotate-90 text-muted-foreground"
                )}
              />
            )}
          </div>

          {!isCollapsed && studentsExpanded && (
            <div className="relative ml-[22px] pl-3 border-l border-border my-0.5 space-y-0.5">
              {studentsSubItems.map((sub) => {
                const isSubActive =
                  pathname === "/students" &&
                  ((sub.stageParam && currentStage === sub.stageParam) ||
                    (sub.tabParam && currentTab === sub.tabParam) ||
                    (!sub.stageParam && !sub.tabParam && !currentStage && !currentTab));

                return (
                  <Link
                    key={sub.name}
                    href={sub.href}
                    className={cn(
                      "relative flex items-center gap-2 py-[5px] px-2 rounded-md text-[12px] transition-colors",
                      "before:absolute before:-left-[13px] before:top-1/2 before:w-2.5 before:h-px before:bg-border",
                      isSubActive
                        ? "text-foreground font-medium bg-muted border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                        isSubActive
                          ? "bg-violet-600 dark:bg-violet-400 shadow-[0_0_5px_rgba(139,92,246,0.5)]"
                          : "bg-zinc-400/60 dark:bg-zinc-700"
                      )}
                    />
                    <span className="truncate">{sub.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* AGENTS */}
        <Link
          href="/agents"
          className={cn(
            "group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-colors",
            pathname?.startsWith("/agents")
              ? "text-foreground bg-muted/70 border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {pathname?.startsWith("/agents") && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-rose-500" />
          )}
          <div className="w-[22px] h-[22px] rounded-[6px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0 shadow-xs">
            <Bot className="w-3.5 h-3.5" />
          </div>
          {!isCollapsed && (
            <span className={cn("truncate font-medium", pathname?.startsWith("/agents") && "font-semibold")}>
              Agents
            </span>
          )}
        </Link>

        {/* REPORTS / DASHBOARDS */}
        <Link
          href="/reports"
          className={cn(
            "group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-colors",
            pathname?.startsWith("/reports")
              ? "text-foreground bg-muted/70 border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {pathname?.startsWith("/reports") && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-cyan-500" />
          )}
          <div className="w-[22px] h-[22px] rounded-[6px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0 shadow-xs">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          {!isCollapsed && (
            <span className={cn("truncate font-medium", pathname?.startsWith("/reports") && "font-semibold")}>
              Dashboards
            </span>
          )}
        </Link>

        {/* NOTIFICATIONS */}
        <Link
          href="/settings/notifications"
          className={cn(
            "group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-colors",
            pathname === "/settings/notifications"
              ? "text-foreground bg-muted/70 border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {pathname === "/settings/notifications" && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-teal-500" />
          )}
          <div className="w-[22px] h-[22px] rounded-[6px] bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25 flex items-center justify-center shrink-0 shadow-xs">
            <Bell className="w-3.5 h-3.5" />
          </div>
          {!isCollapsed && (
            <span className={cn("truncate font-medium", pathname === "/settings/notifications" && "font-semibold")}>
              Notifications
            </span>
          )}
        </Link>

        {/* SETTINGS / WORKFLOWS */}
        <Link
          href="/settings"
          className={cn(
            "group relative flex items-center justify-between px-2.5 py-[7px] rounded-lg text-[13px] transition-colors",
            pathname === "/settings" || (pathname?.startsWith("/settings") && pathname !== "/settings/notifications")
              ? "text-foreground bg-muted/70 border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {(pathname === "/settings" || (pathname?.startsWith("/settings") && pathname !== "/settings/notifications")) && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-orange-500" />
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[22px] h-[22px] rounded-[6px] bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25 flex items-center justify-center shrink-0 shadow-xs">
              <Settings className="w-3.5 h-3.5" />
            </div>
            {!isCollapsed && (
              <span className={cn(
                "truncate font-medium",
                (pathname === "/settings" || (pathname?.startsWith("/settings") && pathname !== "/settings/notifications")) && "font-semibold"
              )}>
                Settings
              </span>
            )}
          </div>
          {!isCollapsed && (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors shrink-0" />
          )}
        </Link>
      </nav>

      {/* ── 5. Minimal Footer ─────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-3 py-2.5 border-t border-border">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md">
            <span className="text-[11px] text-muted-foreground truncate max-w-[130px]" title={organizationName}>
              {organizationName}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded uppercase tracking-wider">
              {userRole || "ADMIN"}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
