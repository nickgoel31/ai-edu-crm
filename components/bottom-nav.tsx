"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  UserCheck,
  GraduationCap,
  Users2,
  BarChart3,
  Settings,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const navItems = [
    { name: "Leads", href: "/leads", icon: UserCheck },
    { name: "Students", href: "/students", icon: GraduationCap },
    { name: "Agents", href: "/agents", icon: Users2 },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    {
      name: isAdmin ? "Settings" : "Alerts",
      href: isAdmin ? "/settings" : "/settings/notifications",
      icon: isAdmin ? Settings : Bell,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-popover/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 py-1.5 shadow-lg safe-bottom">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-lg transition-colors text-[10px] font-medium",
              isActive
                ? "text-blue-400 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "p-1 rounded-md transition-all",
                isActive ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : ""
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="mt-0.5 truncate max-w-[64px]">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
