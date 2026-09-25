"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
  BookOpen,
  LogOut,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessModule, type AppModule } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEYS = {
  collapsed: "sidebar:collapsed",
  leadsExpanded: "sidebar:leadsExpanded",
  studentsExpanded: "sidebar:studentsExpanded",
};

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function writeStoredBool(key: string, value: boolean) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

// ── Color treatment per module — kept as static class strings so Tailwind's
//    JIT scanner can pick them up (no dynamic `bg-${color}-500` interpolation). ──
type AccentColor = "blue" | "violet" | "rose" | "indigo" | "cyan" | "teal" | "orange";

const ACCENT_STYLES: Record<
  AccentColor,
  { badge: string; bar: string; dot: string; dotIdle: string }
> = {
  blue: {
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
    bar: "bg-blue-500",
    dot: "bg-blue-600 dark:bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25",
    bar: "bg-violet-500",
    dot: "bg-violet-600 dark:bg-violet-400 shadow-[0_0_5px_rgba(139,92,246,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  rose: {
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25",
    bar: "bg-rose-500",
    dot: "bg-rose-600 dark:bg-rose-400 shadow-[0_0_5px_rgba(244,63,94,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  indigo: {
    badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
    bar: "bg-indigo-500",
    dot: "bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_5px_rgba(99,102,241,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  cyan: {
    badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/25",
    bar: "bg-cyan-500",
    dot: "bg-cyan-600 dark:bg-cyan-400 shadow-[0_0_5px_rgba(6,182,212,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  teal: {
    badge: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/25",
    bar: "bg-teal-500",
    dot: "bg-teal-600 dark:bg-teal-400 shadow-[0_0_5px_rgba(20,184,166,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
  orange: {
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25",
    bar: "bg-orange-500",
    dot: "bg-orange-600 dark:bg-orange-400 shadow-[0_0_5px_rgba(249,115,22,0.5)]",
    dotIdle: "bg-zinc-400/60 dark:bg-zinc-700",
  },
};

interface NavSubItem {
  name: string;
  href: string;
  stageParam?: string;
  viewParam?: string;
  tabParam?: string;
}

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  color: AccentColor;
  /** Whether this item's row/badge should render as active for the given pathname. */
  matcher: (pathname: string | null) => boolean;
  /** Expandable tree of query-param-driven sub-views (Leads/Students). */
  subItems?: NavSubItem[];
}

function isSubItemActive(
  sub: NavSubItem,
  pathname: string | null,
  parentHref: string,
  currentStage: string | null,
  currentView: string | null,
  currentTab: string | null
): boolean {
  if (pathname !== parentHref) return false;
  if (sub.stageParam) return currentStage === sub.stageParam;
  if (sub.viewParam) return currentView === sub.viewParam;
  if (sub.tabParam) return currentTab === sub.tabParam;
  return !currentStage && !currentView && !currentTab;
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
  const router = useRouter();
  const { data: session } = useSession();

  // Collapsed / expanded tree state — persisted to localStorage (SSR-safe defaults).
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [studentsExpanded, setStudentsExpanded] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setIsCollapsed(readStoredBool(STORAGE_KEYS.collapsed, false));
    setLeadsExpanded(readStoredBool(STORAGE_KEYS.leadsExpanded, true));
    setStudentsExpanded(readStoredBool(STORAGE_KEYS.studentsExpanded, true));
    setHasHydrated(true);
  }, []);

  const toggleCollapsed = useCallback((next: boolean) => {
    setIsCollapsed(next);
    writeStoredBool(STORAGE_KEYS.collapsed, next);
  }, []);

  const toggleLeadsExpanded = useCallback(() => {
    setLeadsExpanded((prev) => {
      const next = !prev;
      writeStoredBool(STORAGE_KEYS.leadsExpanded, next);
      return next;
    });
  }, []);

  const toggleStudentsExpanded = useCallback(() => {
    setStudentsExpanded((prev) => {
      const next = !prev;
      writeStoredBool(STORAGE_KEYS.studentsExpanded, next);
      return next;
    });
  }, []);

  // Automatically expand tree if current path matches
  useEffect(() => {
    if (!hasHydrated) return;
    if (pathname?.startsWith("/leads") && !leadsExpanded) {
      setLeadsExpanded(true);
      writeStoredBool(STORAGE_KEYS.leadsExpanded, true);
    }
    if (pathname?.startsWith("/students") && !studentsExpanded) {
      setStudentsExpanded(true);
      writeStoredBool(STORAGE_KEYS.studentsExpanded, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hasHydrated]);

  const organizationName = session?.user?.organizationName || "Workspace";
  const userName = session?.user?.name || "harsh";
  const userRole = session?.user?.role;

  const initial = (userName || organizationName)[0]?.toUpperCase() || "H";
  const userInitials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : initial;

  const currentStage = searchParams?.get("stage") ?? null;
  const currentView = searchParams?.get("view") ?? null;
  const currentTab = searchParams?.get("tab") ?? null;

  // ── Single typed nav-config array — drives all render + active-state logic. ──
  const navItems: NavItem[] = [
    {
      id: "leads",
      href: "/leads",
      label: "Leads",
      icon: Building2,
      color: "blue",
      matcher: (p) => !!p?.startsWith("/leads"),
      subItems: [
        { name: "Kanban Pipeline", href: "/leads", viewParam: "kanban" },
        { name: "Table View", href: "/leads?view=table", viewParam: "table" },
        { name: "Cold Leads", href: "/leads?stage=COLD", stageParam: "COLD" },
        { name: "Warm Leads", href: "/leads?stage=WARM", stageParam: "WARM" },
        { name: "Hot Inquiries", href: "/leads?stage=HOT", stageParam: "HOT" },
        { name: "Converting", href: "/leads?stage=CONVERTING", stageParam: "CONVERTING" },
        { name: "Lost / Closed", href: "/leads?stage=LOST", stageParam: "LOST" },
      ],
    },
    {
      id: "students",
      href: "/students",
      label: "Students",
      icon: Users,
      color: "violet",
      matcher: (p) => !!p?.startsWith("/students"),
      subItems: [
        { name: "All Students", href: "/students" },
        { name: "Enrolled", href: "/students?stage=ENROLLED", stageParam: "ENROLLED" },
        { name: "Active Learners", href: "/students?stage=ACTIVE", stageParam: "ACTIVE" },
        { name: "Alumni", href: "/students?stage=ALUMNI", stageParam: "ALUMNI" },
        { name: "Document Checklist", href: "/students?tab=documents", tabParam: "documents" },
        { name: "Fee Installments", href: "/students?tab=payments", tabParam: "payments" },
      ],
    },
    {
      id: "agents",
      href: "/agents",
      label: "Agents",
      icon: Bot,
      color: "rose",
      matcher: (p) => !!p?.startsWith("/agents"),
    },
    {
      id: "knowledge-base",
      href: "/knowledge-base",
      label: "Knowledge Base",
      icon: BookOpen,
      color: "indigo",
      matcher: (p) => !!p?.startsWith("/knowledge-base"),
    },
    {
      id: "reports",
      href: "/reports",
      label: "Dashboards",
      icon: BarChart3,
      color: "cyan",
      matcher: (p) => !!p?.startsWith("/reports"),
    },
    {
      id: "notifications",
      href: "/settings/notifications",
      label: "Notifications",
      icon: Bell,
      color: "teal",
      matcher: (p) => p === "/settings/notifications",
    },
    {
      id: "settings",
      href: "/settings",
      label: "Settings",
      icon: Settings,
      color: "orange",
      matcher: (p) => p === "/settings" || (!!p?.startsWith("/settings") && p !== "/settings/notifications"),
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    canAccessModule(userRole, item.id as AppModule, session?.user?.moduleAccess)
  );

  const renderNavRow = (item: NavItem) => {
    const isActive = item.matcher(pathname);
    const accent = ACCENT_STYLES[item.color];
    const Icon = item.icon;
    const hasTree = !!item.subItems?.length;

    const iconBadge = (
      <div
        className={cn(
          "w-[22px] h-[22px] rounded-[6px] border flex items-center justify-center shrink-0 shadow-xs transition-colors",
          accent.badge
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
    );

    const row = (
      <div
        onClick={
          hasTree
            ? () => {
                if (isCollapsed) toggleCollapsed(false);
                if (item.id === "leads") toggleLeadsExpanded();
                if (item.id === "students") toggleStudentsExpanded();
              }
            : undefined
        }
        className={cn(
          "group relative flex items-center justify-between px-2.5 py-[7px] rounded-lg text-[13px] transition-colors duration-150",
          hasTree ? "cursor-pointer" : "",
          isActive
            ? "text-foreground bg-muted/70 border border-border/60"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        {isActive && (
          <span className={cn("absolute left-0 top-1 bottom-1 w-[3px] rounded-full transition-colors", accent.bar)} />
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          {iconBadge}
          {!isCollapsed &&
            (hasTree ? (
              <Link
                href={item.href}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "truncate text-[13px] font-medium",
                  isActive ? "text-foreground font-semibold" : "text-foreground/80 group-hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate font-medium", isActive && "font-semibold")}>{item.label}</span>
            ))}
        </div>

        {!isCollapsed && hasTree && (
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              item.id === "leads" && leadsExpanded && "rotate-90",
              item.id === "students" && studentsExpanded && "rotate-90"
            )}
          />
        )}

        {!isCollapsed && item.id === "settings" && (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-colors shrink-0" />
        )}
      </div>
    );

    const wrapped = !hasTree ? (
      <Link href={item.href} className="block">
        {row}
      </Link>
    ) : (
      row
    );

    const withTooltip = isCollapsed ? (
      <TooltipTrigger delay={200}>
        <div>{wrapped}</div>
        <Tooltip placement="right">{item.label}</Tooltip>
      </TooltipTrigger>
    ) : (
      wrapped
    );

    const expanded = item.id === "leads" ? leadsExpanded : item.id === "students" ? studentsExpanded : false;

    return (
      <div key={item.id}>
        {withTooltip}

        {hasTree && !isCollapsed && expanded && (
          <div className="relative ml-[22px] pl-3 border-l border-border my-0.5 space-y-0.5">
            {item.subItems!.map((sub) => {
              const active = isSubItemActive(sub, pathname, item.href, currentStage, currentView, currentTab);
              return (
                <Link
                  key={sub.name}
                  href={sub.href}
                  className={cn(
                    "relative flex items-center gap-2 py-[5px] px-2 rounded-md text-[12px] transition-colors duration-150",
                    "before:absolute before:-left-[13px] before:top-1/2 before:w-2.5 before:h-px before:bg-border",
                    active
                      ? "text-foreground font-medium bg-muted border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                      active ? accent.dot : accent.dotIdle
                    )}
                  />
                  <span className="truncate">{sub.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-background text-foreground border-r border-border h-screen sticky top-0 shrink-0 transition-all duration-300 select-none z-30 font-sans",
        isCollapsed ? "w-[56px]" : "w-60"
      )}
    >
      {/* ── 1. Org Header — elevated card treatment ───────────────────── */}
      <div className="p-2.5">
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border border-border/70 bg-gradient-to-b from-muted/60 to-transparent px-2.5 h-11 transition-all duration-150",
            isCollapsed && "justify-center px-0"
          )}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-[22px] h-[22px] rounded-[5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-[11px] shrink-0">
                {initial}
              </div>
              <button className="flex items-center gap-1 min-w-0 cursor-pointer hover:text-foreground transition-colors group">
                <span className="text-[13px] font-semibold text-foreground group-hover:text-foreground truncate leading-none">
                  {organizationName}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground/80 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-[5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-xs">
              {initial}
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
                onPress={() => toggleCollapsed(true)}
                title="Collapse sidebar"
              >
                <PanelLeftClose />
              </Button>
            </div>
          )}
        </div>

        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onPress={() => toggleCollapsed(false)}
            title="Expand sidebar"
            className="mt-1 w-full"
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
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150",
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
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
            title="AI Conversations"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/settings"
            className={cn(
              "p-1.5 rounded-lg transition-colors duration-150",
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
        {visibleNavItems.map(renderNavRow)}
      </nav>

      {/* ── 5. Account Footer — avatar, org, role + sign-out menu ─── */}
      <div className="p-2 border-t border-border">
        <DropdownMenuTrigger>
          <button
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted transition-colors duration-150",
              isCollapsed && "justify-center px-0"
            )}
          >
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="font-semibold text-[11px] bg-muted">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                <span className="text-[12px] font-semibold text-foreground truncate w-full">
                  {userName}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10.5px] text-muted-foreground truncate max-w-[90px]" title={organizationName}>
                    {organizationName}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground bg-muted border border-border px-1 py-0 rounded uppercase tracking-wider shrink-0">
                    {userRole || "ADMIN"}
                  </span>
                </div>
              </div>
            )}
          </button>

          <DropdownMenu placement="top start" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground truncate">{userName}</span>
                <span className="text-muted-foreground truncate">{organizationName}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onAction={() => router.push("/settings")}>
              <UserCog className="w-3.5 h-3.5" />
              <span>Account Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onAction={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>
    </aside>
  );
}
