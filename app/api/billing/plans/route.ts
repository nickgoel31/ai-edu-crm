import { NextResponse } from "next/server";
import { PLAN_CONFIGS } from "@/lib/billing/stripe";

export async function GET() {
  const plans = Object.entries(PLAN_CONFIGS).map(([id, config]) => ({
    id,
    ...config,
    seatLimit: Number.isFinite(config.seatLimit) ? config.seatLimit : null,
  }));
  return NextResponse.json({ plans });
}
