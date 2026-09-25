"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PortalTopBar({ guardianName }: { guardianName: string }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } finally {
      router.push("/portal/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground">Parent Portal</p>
            <p className="text-[10px] text-muted-foreground">Welcome, {guardianName}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut} isDisabled={isSigningOut}>
          {isSigningOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          <span>Sign out</span>
        </Button>
      </div>
    </header>
  );
}
