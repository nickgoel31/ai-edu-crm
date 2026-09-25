"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";

interface PublicSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

interface PublicOrg {
  name: string;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
}

export default function PublicBookingPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params?.orgSlug as string;

  const [org, setOrg] = useState<PublicOrg | null>(null);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!orgSlug) return;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/public/booking/${orgSlug}`);
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || "This booking page could not be found.");
          return;
        }
        setOrg(data.organization);
        setSlots(data.slots || []);
      } catch (err) {
        setLoadError("Something went wrong loading this page. Please try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [orgSlug]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, PublicSlot[]>();
    for (const slot of slots) {
      const day = new Date(slot.startTime).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(slot);
    }
    return Array.from(groups.entries());
  }, [slots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/public/booking/${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSlotId: selectedSlot.id,
          name,
          phone,
          email: email || undefined,
          program: program || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not complete your booking. Please try again.");
        return;
      }
      setConfirmed(true);
    } catch (err) {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandColor = org?.brandPrimaryColor || undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-sm text-center space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-14">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          {org?.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.brandLogoUrl} alt={org.name} className="h-12 w-auto object-contain" />
          ) : (
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-heading font-semibold text-lg"
              style={{ backgroundColor: brandColor || "#6366f1" }}
            >
              {org?.name?.charAt(0) || "?"}
            </div>
          )}
          <h1 className="font-heading text-xl font-semibold">{org?.name}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Book a free demo class. Pick a time below — takes less than a minute.
          </p>
        </div>

        {confirmed ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <h2 className="font-heading text-lg font-semibold">You're all set!</h2>
            <p className="text-sm text-muted-foreground">
              Your free demo class with {org?.name} is confirmed
              {selectedSlot &&
                ` for ${new Date(selectedSlot.startTime).toLocaleString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
              . We've sent a confirmation to your WhatsApp if available.
            </p>
          </div>
        ) : selectedSlot ? (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(selectedSlot.startTime).toLocaleString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Full name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="e.g. Ananya Sharma"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Phone number *</label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="+91 98700 12345"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Program of interest (optional)</label>
                <input
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="e.g. Data Science"
                />
              </div>

              {submitError && (
                <p className="text-xs text-destructive">{submitError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: brandColor || "#6366f1" }}
                >
                  {isSubmitting ? "Booking..." : "Confirm booking"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByDay.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No upcoming demo class slots are open right now. Please check back soon.
              </div>
            ) : (
              groupedByDay.map(([day, daySlots]) => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarClock className="w-3.5 h-3.5" />
                    {day}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium hover:border-ring hover:bg-muted/50 transition-colors text-left"
                      >
                        {new Date(slot.startTime).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {slot.capacity - slot.bookedCount} spot(s) left
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
