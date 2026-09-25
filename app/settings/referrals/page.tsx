"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Smartphone,
  CheckCircle,
  XCircle,
  Save,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { buildUpiPaymentLink } from "@/lib/upi";

interface ReferralPayoutItem {
  id: string;
  referrerName: string;
  referrerPhone: string;
  referrerStudentId: string | null;
  referredLeadId: string | null;
  amount: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  upiVpa: string | null;
  paidAt: string | null;
  createdAt: string;
  referrerStudent: { id: string; name: string; phone: string } | null;
  referredLead: { id: string; name: string; phone: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function ReferralPayoutsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [payouts, setPayouts] = useState<ReferralPayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [referrerName, setReferrerName] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const [referredLeadId, setReferredLeadId] = useState("");
  const [amount, setAmount] = useState("");

  const [vpaDraft, setVpaDraft] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load referral payouts.");
      setPayouts(data.payouts || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load referral payouts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const flash = (text: string) => {
    setSuccess(text);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreate = async () => {
    if (!referrerName.trim() || !referrerPhone.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerName: referrerName.trim(),
          referrerPhone: referrerPhone.trim(),
          referredLeadId: referredLeadId.trim() || undefined,
          amount: amount.trim() ? Number(amount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create referral payout.");
      setShowCreateDialog(false);
      setReferrerName("");
      setReferrerPhone("");
      setReferredLeadId("");
      setAmount("");
      flash("Referral payout created.");
      fetchPayouts();
    } catch (err: any) {
      setError(err?.message || "Failed to create referral payout.");
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async (payout: ReferralPayoutItem) => {
    setUpdatingId(payout.id);
    setError(null);
    try {
      const upi = vpaDraft[payout.id] ?? payout.upiVpa ?? "";
      const res = await fetch(`/api/referrals/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", upiVpa: upi || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update payout.");
      flash(`Marked payout to ${payout.referrerName} as paid.`);
      fetchPayouts();
    } catch (err: any) {
      setError(err?.message || "Failed to update payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (payout: ReferralPayoutItem) => {
    setUpdatingId(payout.id);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update payout.");
      flash(`Cancelled payout to ${payout.referrerName}.`);
      fetchPayouts();
    } catch (err: any) {
      setError(err?.message || "Failed to update payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveVpa = async (payout: ReferralPayoutItem) => {
    const upi = vpaDraft[payout.id];
    if (upi === undefined) return;
    setUpdatingId(payout.id);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiVpa: upi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save UPI ID.");
      flash("UPI ID saved.");
      fetchPayouts();
    } catch (err: any) {
      setError(err?.message || "Failed to save UPI ID.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <AlertDescription className="text-xs">
            Referral payouts are only visible to admins.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <Breadcrumb className="mb-1.5">
            <BreadcrumbList className="text-2xs text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink render={(props: any) => <Link href="/settings" {...props} />}>Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground font-medium">Referral Payouts</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            Alumni Referral Payouts
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Track and settle referral incentives owed to alumni and students. "Pay via UPI" opens a
            pre-filled UPI payment intent in your own UPI app for you to complete manually — this is not
            an automated bank transfer (that requires a payment aggregator's payout API and KYC, which
            is out of scope here).
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span>New Payout</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <AlertDescription className="text-xs font-medium text-inherit">{success}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-xs">Loading referral payouts...</p>
        </div>
      ) : payouts.length === 0 ? (
        <Card className="py-16 flex flex-col items-center justify-center text-center gap-2">
          <Users className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No referral payouts yet</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Record a payout whenever an alumni or student referral converts, then settle it here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {payouts.map((payout) => {
            const upiValue = vpaDraft[payout.id] ?? payout.upiVpa ?? "";
            const upiLink =
              payout.status === "PENDING"
                ? buildUpiPaymentLink({
                    vpa: upiValue,
                    payeeName: payout.referrerName,
                    amount: payout.amount,
                    transactionNote: "Referral payout",
                    transactionRefId: payout.id,
                  })
                : null;

            return (
              <Card key={payout.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm truncate">{payout.referrerName}</h3>
                      <Badge variant="outline" className={STATUS_STYLES[payout.status]}>
                        {payout.status}
                      </Badge>
                    </div>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      {payout.referrerPhone}
                      {payout.referredLead ? ` • Referred: ${payout.referredLead.name}` : ""}
                      {payout.referrerStudent ? ` • Alumni: ${payout.referrerStudent.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-foreground shrink-0">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {payout.amount.toLocaleString("en-IN")}
                  </div>
                </div>

                {payout.status === "PENDING" && (
                  <div className="border-t border-border pt-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 w-28">
                        Referrer UPI ID
                      </Label>
                      <Input
                        value={upiValue}
                        onChange={(e) =>
                          setVpaDraft((prev) => ({ ...prev, [payout.id]: e.target.value }))
                        }
                        placeholder="name@upi"
                        className="font-mono text-xs h-8"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSaveVpa(payout)}
                        isDisabled={updatingId === payout.id || vpaDraft[payout.id] === undefined}
                        title="Save UPI ID"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => handleMarkPaid(payout)}
                        isDisabled={updatingId === payout.id}
                        className="gap-1.5"
                      >
                        {updatingId === payout.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Mark as Paid</span>
                      </Button>
                      {upiLink && (
                        <a
                          href={upiLink}
                          className={buttonVariants({ variant: "outline", className: "gap-1.5" })}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via UPI</span>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => handleCancel(payout)}
                        isDisabled={updatingId === payout.id}
                        className="gap-1.5 text-muted-foreground"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </div>
                )}

                {payout.status === "PAID" && payout.paidAt && (
                  <p className="text-2xs text-muted-foreground border-t border-border pt-2.5">
                    Paid on{" "}
                    {new Date(payout.paidAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {payout.upiVpa ? ` • UPI: ${payout.upiVpa}` : ""}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog isOpen={showCreateDialog} onOpenChange={setShowCreateDialog} isDismissable={!creating}>
        <DialogHeader>
          <DialogTitle>New Referral Payout</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Referrer Name *
            </Label>
            <Input value={referrerName} onChange={(e) => setReferrerName(e.target.value)} placeholder="e.g. Ananya Sharma" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Referrer Phone *
            </Label>
            <Input value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} placeholder="+91 98700 12345" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Referred Lead ID (optional)
            </Label>
            <Input value={referredLeadId} onChange={(e) => setReferredLeadId(e.target.value)} placeholder="Linked lead ID, if known" className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount (₹, optional)
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Defaults to the Alumni Referral agent's configured incentive"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)} isDisabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            isDisabled={creating || !referrerName.trim() || !referrerPhone.trim()}
          >
            {creating ? "Saving..." : "Save Payout"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
