"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building,
  User,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export type PlanType = "SELF_SERVE" | "SELF_SERVE_AGENTS" | "MANAGED";

interface PlanOption {
  id: PlanType;
  name: string;
  badge?: string;
  priceInr: string;
  period: string;
  description: string;
  features: string[];
}

const PLANS: PlanOption[] = [
  {
    id: "SELF_SERVE",
    name: "Self-Serve Core",
    priceInr: "₹4,999",
    period: "/month",
    description: "Foundational CRM with lead intake, kanban pipeline, student registry, and document checklist.",
    features: [
      "Unlimited Leads & Pipeline Views",
      "Student Registry & Enrollment Tracking",
      "Document Verification Checklist",
      "Fee Payment Installment Tracking",
      "Up to 5 Counselor Seats",
    ],
  },
  {
    id: "SELF_SERVE_AGENTS",
    name: "Self-Serve + AI Agents",
    badge: "Most Popular",
    priceInr: "₹14,999",
    period: "/month",
    description: "Complete CRM plus autonomous Retell AI Voice & WhatsApp agents with live escalation queues.",
    features: [
      "Everything in Self-Serve Core",
      "Retell AI Voice Agents & WhatsApp Bot",
      "Automated Conversation Ingestion",
      "Counselor Live Escalation Queue",
      "Lead Source ROI & Counselor Analytics",
      "Up to 15 Counselor Seats",
    ],
  },
  {
    id: "MANAGED",
    name: "Managed Enterprise",
    badge: "Enterprise SLA",
    priceInr: "₹39,999",
    period: "/month",
    description: "Dedicated prompt engineering, custom two-way ERP sync, and 24/7 priority SLA support.",
    features: [
      "Everything in Self-Serve + Agents",
      "Two-Way ERP Sync & Custom Field Mapping",
      "Dedicated AI Prompt Tuning & Audio Testing",
      "Daily Email & WhatsApp Digest Engine",
      "AES-256-GCM Compliance & Audit Logs",
      "Unlimited Counselor Seats & Dedicated Support",
    ],
  },
];

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("SELF_SERVE_AGENTS");

  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const handleNextToPlans = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!organizationName.trim() || !name.trim() || !email.trim() || !password) {
      setError("Please complete all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setStep(2);
  };

  const handleProceedToCheckout = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to initialize checkout session.");
      }

      setSessionId(data.sessionId || "sub_sess_mock_active");
      setStep(3);
    } catch (err: any) {
      setError(err?.message || "Failed to proceed to checkout.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
          plan: selectedPlan,
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData?.error || "Registration failed.");
      }

      const orgId = regData.organization.id;

      await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          plan: selectedPlan,
          organizationId: orgId,
        }),
      });

      setCheckoutSuccess(true);

      const loginRes = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        router.push("/login?signup_success=true");
      } else {
        router.push("/?onboarding=start");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong completing your order.");
      setIsLoading(false);
    }
  };

  const activePlanDetails = PLANS.find((p) => p.id === selectedPlan) || PLANS[0];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="max-w-4xl mx-auto w-full">
        {/* Step Indicator */}
        <div className="mb-8 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center">
              <div
                className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ' +
                  (step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")
                }
              >
                1
              </div>
              <span className="text-[11px] font-medium text-slate-600 mt-1">Workspace</span>
            </div>
            <div className={'flex-1 h-0.5 mx-2 ' + (step >= 2 ? "bg-blue-600" : "bg-slate-200")} />
            <div className="flex flex-col items-center">
              <div
                className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ' +
                  (step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")
                }
              >
                2
              </div>
              <span className="text-[11px] font-medium text-slate-600 mt-1">Plan</span>
            </div>
            <div className={'flex-1 h-0.5 mx-2 ' + (step >= 3 ? "bg-blue-600" : "bg-slate-200")} />
            <div className="flex flex-col items-center">
              <div
                className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ' +
                  (step >= 3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")
                }
              >
                3
              </div>
              <span className="text-[11px] font-medium text-slate-600 mt-1">Checkout</span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <Alert variant="destructive" className="max-w-xl mx-auto mb-6">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* STEP 1: Workspace & Admin Details */}
        {step === 1 && (
          <Card className="max-w-md mx-auto">
            <CardHeader className="px-8 pt-2">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-sm mx-auto">
                  <Building className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Create Organization Workspace
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You will become the organization ADMIN with full access.
                </p>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-2">
              <form onSubmit={handleNextToPlans} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Organization / Institution Name</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Building />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="e.g. Apex Global Institute"
                    />
                  </InputGroup>
                </div>

                <div className="space-y-1.5">
                  <Label>Your Full Name</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <User />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Rajesh Gupta"
                    />
                  </InputGroup>
                </div>

                <div className="space-y-1.5">
                  <Label>Work Email Address</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Mail />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@apexedu.com"
                    />
                  </InputGroup>
                </div>

                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Lock />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                  </InputGroup>
                </div>

                <Button type="submit" className="w-full mt-2 h-9">
                  <span>Continue to Plan Selection</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Plan Selection */}
        {step === 2 && (
          <Card className="md:p-2">
            <CardContent className="px-6 md:px-8">
              <div className="text-center max-w-xl mx-auto mb-8">
                <Badge variant="secondary">Select Your Subscription Plan</Badge>
                <h2 className="text-2xl font-bold tracking-tight text-foreground mt-2">
                  Predictable SaaS Pricing for Education
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose the plan that fits your institution's admissions volume and automation needs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <Card
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={
                        "relative flex flex-col p-6 cursor-pointer transition-all ring-1 " +
                        (isSelected
                          ? "ring-2 ring-primary shadow-md"
                          : "ring-border hover:ring-foreground/20")
                      }
                    >
                      {plan.badge && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase">
                          {plan.badge}
                        </Badge>
                      )}

                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 min-h-[36px]">{plan.description}</p>
                      </div>

                      <div className="mb-6 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-foreground">{plan.priceInr}</span>
                        <span className="text-xs text-muted-foreground">{plan.period}</span>
                      </div>

                      <ul className="space-y-2.5 flex-1 mb-6 text-xs text-muted-foreground">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      <Badge
                        variant={isSelected ? "default" : "secondary"}
                        className="w-full h-auto py-2 px-3 rounded-md text-xs justify-center"
                      >
                        {isSelected ? "Selected" : "Choose Plan"}
                      </Badge>
                    </Card>
                  );
                })}
              </div>

              <Separator className="mt-8 mb-6" />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onPress={() => setStep(1)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Workspace</span>
                </Button>

                <Button
                  type="button"
                  onPress={handleProceedToCheckout}
                  isDisabled={isLoading}
                  className="h-9 px-6"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Proceed to Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Checkout & Confirm */}
        {step === 3 && (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="px-8 pt-2">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-white mb-3 shadow-sm mx-auto">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Review & Confirm Subscription
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Self-serve activation for {organizationName}
                </p>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-2 space-y-6">
              {/* Order Summary Box */}
              <Card className="bg-muted/40 p-5">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                  <div>
                    <span className="text-sm font-bold text-foreground">{activePlanDetails.name}</span>
                    <p className="text-xs text-muted-foreground">Monthly Recurring Plan</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">{activePlanDetails.priceInr}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                  <div className="flex justify-between">
                    <span>Organization</span>
                    <span className="font-medium text-foreground">{organizationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin Contact</span>
                    <span className="font-medium text-foreground">{email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billing Cycle</span>
                    <span className="font-medium text-foreground">Monthly auto-renew</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex justify-between items-center text-sm font-bold text-foreground">
                  <span>Total Due Today</span>
                  <span className="text-primary text-base">{activePlanDetails.priceInr}</span>
                </div>
              </Card>

              {/* Payment Method Details */}
              <Alert>
                <ShieldCheck />
                <AlertDescription>
                  <p className="font-semibold text-foreground">Secure Payment Gateway (Stripe & Razorpay)</p>
                  <p className="mt-0.5">
                    Instant subscription provisioning. You will receive an invoice and onboarding link immediately upon activation.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Button
                  type="button"
                  onPress={handleFinalSubmit}
                  isDisabled={isLoading || checkoutSuccess}
                  className="w-full h-10 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating Subscription & Account...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Pay {activePlanDetails.priceInr} & Launch Workspace</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onPress={() => setStep(2)}
                  isDisabled={isLoading}
                  className="w-full"
                >
                  Change Selected Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
