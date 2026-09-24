"use client";

import { useSession, signOut } from "next-auth/react";
import { Building, ShieldCheck, Shield, Eye, LogOut } from "lucide-react";
import { Role } from "@/types";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  const { data: session } = useSession();

  const orgName = session?.user?.organizationName || "EduCRM Workspace";
  const userName = session?.user?.name || "Staff Member";
  const userEmail = session?.user?.email || "user@example.com";
  const userRole = (session?.user?.role as Role) || "COUNSELOR";

  const userInitials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase();

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return (
          <Badge className="gap-1 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <ShieldCheck className="size-2.5" />
            ADMIN
          </Badge>
        );
      case "COUNSELOR":
        return (
          <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <Shield className="size-2.5" />
            COUNSELOR
          </Badge>
        );
      case "READONLY":
        return (
          <Badge variant="outline" className="gap-1">
            <Eye className="size-2.5" />
            READONLY
          </Badge>
        );
    }
  };

  const roleAccent: Record<Role, string> = {
    ADMIN: "from-blue-500 to-blue-600 ring-blue-500/30",
    COUNSELOR: "from-emerald-500 to-emerald-600 ring-emerald-500/30",
    READONLY: "from-zinc-500 to-zinc-600 ring-zinc-500/30",
  };

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm px-5 flex items-center justify-between sticky top-0 z-10">
      {/* Left: Organization identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center size-7 rounded-lg bg-blue-500/15 border border-blue-500/25 shrink-0">
          <Building className="size-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span
            className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs"
            title={orgName}
          >
            {orgName}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Active Tenant
          </span>
        </div>
      </div>

      {/* Right: Notifications, Theme Toggle, Logged-in User Profile & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <NotificationBell />

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2.5 pl-1 pr-1 py-1 rounded-lg hover:bg-muted/40 transition-colors">
          <Avatar className={`ring-2 ring-offset-1 ring-offset-background ${roleAccent[userRole].split(" ")[2]}`}>
            <AvatarFallback
              className={`font-semibold text-white bg-gradient-to-br ${roleAccent[userRole].split(" ").slice(0, 2).join(" ")}`}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-medium text-foreground leading-tight">
              {userName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={userEmail}>
                {userEmail}
              </span>
              {getRoleBadge(userRole)}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="ghost"
          size="icon-sm"
          onPress={() => signOut({ callbackUrl: "/login" })}
          title="Sign out of CRM"
          aria-label="Sign out"
          className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
