"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
  Users,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DemoSlotItem {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  _count?: { bookings: number };
}

interface DemoBookingItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  program: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  demoSlot: { startTime: string; endTime: string };
  lead: { id: string; name: string } | null;
}

const DAYS = [
  { id: "MON", label: "Mon" },
  { id: "TUE", label: "Tue" },
  { id: "WED", label: "Wed" },
  { id: "THU", label: "Thu" },
  { id: "FRI", label: "Fri" },
  { id: "SAT", label: "Sat" },
  { id: "SUN", label: "Sun" },
];

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  NO_SHOW: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function BookingsPage() {
  const [orgSlug, setOrgSlug] = useState<string | undefined>(undefined);

  const [slots, setSlots] = useState<DemoSlotItem[]>([]);
  const [bookings, setBookings] = useState<DemoBookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [startHour, setStartHour] = useState("10");
  const [endHour, setEndHour] = useState("18");
  const [slotDuration, setSlotDuration] = useState("60");
  const [capacity, setCapacity] = useState("5");

  useEffect(() => {
    setOrigin(window.location.origin);
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        fetch("/api/bookings/slots"),
        fetch("/api/bookings"),
      ]);
      const slotsData = await slotsRes.json();
      const bookingsData = await bookingsRes.json();

      if (!slotsRes.ok) throw new Error(slotsData.error || "Failed to load slots.");
      if (!bookingsRes.ok) throw new Error(bookingsData.error || "Failed to load bookings.");

      setSlots(slotsData.slots || []);
      setOrgSlug(slotsData.orgSlug || undefined);
      setBookings(bookingsData.bookings || []);
    } catch (err: any) {
      setError(err.message || "Failed to load booking data.");
    } finally {
      setIsLoading(false);
    }
  }

  const upcomingSlots = useMemo(
    () => slots.filter((s) => new Date(s.startTime) >= new Date()),
    [slots]
  );

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenError(null);
    setGenSuccess(null);

    if (!startDate || !endDate || selectedDays.length === 0) {
      setGenError("Please pick a date range and at least one weekday.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/bookings/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          daysOfWeek: selectedDays,
          startHour: Number(startHour),
          endHour: Number(endHour),
          slotDurationMinutes: Number(slotDuration),
          capacity: Number(capacity),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate slots.");

      setGenSuccess(`Created ${data.created} demo slot(s).`);
      await loadData();
    } catch (err: any) {
      setGenError(err.message || "Failed to generate slots.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDeleteSlot(id: string) {
    if (!confirm("Delete this demo slot?")) return;
    try {
      const res = await fetch(`/api/bookings/slots/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete slot.");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete slot.");
    }
  }

  async function handleUpdateBookingStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update booking.");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update booking.");
    }
  }

  const bookingUrl = orgSlug ? `${origin}/book/${orgSlug}` : "";

  function handleCopy() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          Demo Class Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A real internal booking calendar for free demo classes — slots and bookings are
          persisted here with capacity enforced. This is not a sync to Google/Outlook calendars.
        </p>
      </div>

      {bookingUrl && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Public booking link
              </p>
              <p className="text-sm font-mono truncate">{bookingUrl}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold">Generate demo slots</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Batch-create repeating slots across a date range (capped at 200 per generation).
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Days of week</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => toggleDay(d.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedDays.includes(d.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Start hour (0-23)</Label>
              <Input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End hour (0-23)</Label>
              <Input type="number" min={0} max={23} value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Slot length (min)</Label>
              <Input type="number" min={5} step={5} value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity per slot</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>

          {genError && <p className="text-xs text-destructive">{genError}</p>}
          {genSuccess && <p className="text-xs text-emerald-500">{genSuccess}</p>}

          <Button type="submit" isDisabled={isGenerating}>
            <Plus className="w-3.5 h-3.5" />
            {isGenerating ? "Generating..." : "Generate slots"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-heading text-sm font-semibold mb-3">Upcoming slots ({upcomingSlots.length})</h2>
        {upcomingSlots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming slots. Generate some above.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {upcomingSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="text-xs">
                  <span className="font-medium">
                    {new Date(slot.startTime).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    <Users className="w-3 h-3 inline mr-1" />
                    {slot.bookedCount}/{slot.capacity}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSlot(slot.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-sm font-semibold mb-3">Bookings ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Slot</th>
                  <th className="py-2 pr-3 font-medium">Program</th>
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-muted-foreground">{b.phone}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {new Date(b.demoSlot.startTime).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 pr-3">{b.program || "—"}</td>
                    <td className="py-2 pr-3">
                      {b.lead ? (
                        <a href={`/leads/${b.lead.id}`} className="text-primary hover:underline">
                          {b.lead.name}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={STATUS_STYLES[b.status] || ""}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        selectedKey={b.status}
                        onSelectionChange={(key) => handleUpdateBookingStatus(b.id, key as string)}
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem id="SCHEDULED" textValue="Scheduled">Scheduled</SelectItem>
                          <SelectItem id="COMPLETED" textValue="Completed">Completed</SelectItem>
                          <SelectItem id="CANCELLED" textValue="Cancelled">Cancelled</SelectItem>
                          <SelectItem id="NO_SHOW" textValue="No-show">No-show</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
