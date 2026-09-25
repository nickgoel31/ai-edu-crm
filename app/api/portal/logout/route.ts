import { NextResponse } from "next/server";
import { clearGuardianSessionCookie } from "@/lib/guardian-auth";

export async function POST() {
  await clearGuardianSessionCookie();
  return NextResponse.json({ success: true });
}
