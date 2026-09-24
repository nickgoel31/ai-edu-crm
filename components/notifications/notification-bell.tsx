"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  CreditCard,
  Headphones,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Settings,
  AlertCircle,
  Timer,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DialogTrigger } from "react-aria-components";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface InAppAlertItem {
  id: string;
  type: "STALLED_LEAD" | "OVERDUE_PAYMENT" | "ESCALATED_CONVERSATION" | "SLA_BREACH";
  title: string;
  subtitle: string;
  timestamp: string;
  linkUrl: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  metadata?: Record<string, any>;
}

interface AlertData {
  stalledLeads: InAppAlertItem[];
  overduePayments: InAppAlertItem[];
  escalatedConversations: InAppAlertItem[];
  slaBreaches?: InAppAlertItem[];
  totalAlertsCount: number;
  hasUrgentEscalation: boolean;
}

const TYPE_META: Record<
  InAppAlertItem["type"],
  { icon: typeof Headphones; iconClassName: string; barClassName: string; label: string }
> = {
  ESCALATED_CONVERSATION: {
    icon: Headphones,
    iconClassName: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    barClassName: "bg-rose-500",
    label: "Escalated",
  },
  SLA_BREACH: {
    icon: AlertCircle,
    iconClassName: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    barClassName: "bg-rose-500",
    label: "SLA breach",
  },
  STALLED_LEAD: {
    icon: Clock,
    iconClassName: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    barClassName: "bg-amber-500",
    label: "Stalled",
  },
  OVERDUE_PAYMENT: {
    icon: CreditCard,
    iconClassName: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    barClassName: "bg-purple-500",
    label: "Overdue payment",
  },
};

function timeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/in-app");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000);
    return () => clearInterval(interval);
  }, []);

  const totalCount = data?.totalAlertsCount || 0;
  const escalationCount = data?.escalatedConversations?.length || 0;

  const allAlerts: InAppAlertItem[] = [
    ...(data?.escalatedConversations || []),
    ...(data?.slaBreaches || []),
    ...(data?.stalledLeads || []),
    ...(data?.overduePayments || []),
  ];

  const filteredAlerts = allAlerts.filter((item) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ESCALATIONS") return item.type === "ESCALATED_CONVERSATION";
    if (activeTab === "SLA") return item.type === "SLA_BREACH";
    if (activeTab === "STALLED") return item.type === "STALLED_LEAD";
    if (activeTab === "PAYMENTS") return item.type === "OVERDUE_PAYMENT";
    return true;
  });

  return (
    <DialogTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open notifications"
        title="Notifications"
        className="relative text-muted-foreground hover:text-foreground"
      >
        <Bell />
        {totalCount > 0 && (
          <Badge
            variant={escalationCount > 0 || (data?.slaBreaches?.length || 0) > 0 ? "destructive" : "default"}
            className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]"
          >
            {totalCount > 99 ? "99+" : totalCount}
          </Badge>
        )}
      </Button>
      <Popover className="w-96 max-w-[90vw] gap-0 overflow-hidden p-0 shadow-xl" placement="bottom end">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {totalCount > 0 && (
              <Badge
                variant={escalationCount > 0 || (data?.slaBreaches?.length || 0) > 0 ? "destructive" : "secondary"}
                className="font-semibold"
              >
                {totalCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onPress={fetchAlerts}
              isDisabled={loading}
              title="Refresh alerts"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Link
              href="/settings/notifications"
              title="Notification Preferences"
              className={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
                className: "text-muted-foreground hover:text-foreground",
              })}
            >
              <Settings />
            </Link>
          </div>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(String(k))}
          className="gap-0"
        >
          <div className="border-b border-border px-2 pt-2">
            <TabsList variant="line" className="w-full justify-start gap-3 overflow-x-auto">
              <TabsTrigger id="ALL">All ({totalCount})</TabsTrigger>
              <TabsTrigger id="SLA">
                SLA ({data?.slaBreaches?.length || 0})
              </TabsTrigger>
              <TabsTrigger id="ESCALATIONS">
                Escalated ({data?.escalatedConversations?.length || 0})
              </TabsTrigger>
              <TabsTrigger id="STALLED">
                Stalled ({data?.stalledLeads?.length || 0})
              </TabsTrigger>
              <TabsTrigger id="PAYMENTS">
                Overdue ({data?.overduePayments?.length || 0})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent id={activeTab}>
            <ScrollArea className="max-h-80">
              {filteredAlerts.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="size-5 text-emerald-400" />
                  </div>
                  <p className="text-xs font-medium text-foreground">All caught up!</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    No alerts pending in this category.
                  </p>
                </div>
              ) : (
                filteredAlerts.map((alert, i) => {
                  const meta = TYPE_META[alert.type];
                  const Icon = meta.icon;
                  return (
                    <div key={alert.id}>
                      {i > 0 && <Separator />}
                      <Link
                        href={alert.linkUrl}
                        className="group relative flex items-start gap-2.5 py-3 pr-3 pl-3.5 transition hover:bg-accent"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${meta.barClassName}`}
                        />
                        <div
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.iconClassName}`}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                              {alert.title}
                            </p>
                            <span className="shrink-0 text-[10px] whitespace-nowrap text-muted-foreground">
                              {timeAgo(alert.timestamp)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {alert.subtitle}
                          </p>
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80">
                            <span className={`size-1.5 rounded-full ${meta.barClassName}`} />
                            {meta.label}
                          </span>
                        </div>
                        <ExternalLink className="mt-1 size-3.5 shrink-0 self-start text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </Link>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="bg-muted/30 p-2.5 text-center">
          <Link
            href="/settings/notifications"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Configure notification channels &amp; triggers
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </Popover>
    </DialogTrigger>
  );
}
