import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyGuardianPassword,
  createGuardianSessionToken,
  setGuardianSessionCookie,
} from "@/lib/guardian-auth";

/**
 * Guardian portal login. Fully separate from staff NextAuth login
 * (app/api/auth/[...nextauth]) — issues its own signed `guardian_session`
 * cookie via lib/guardian-auth.ts, never a NextAuth session.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Guardians log in without knowing an org slug, so look up by email
    // globally. The schema enforces @@unique([organizationId, email]) per
    // org (not globally), so in the rare case multiple orgs created a
    // guardian with the same email, this matches the first found — good
    // enough for a portal login lookup, and password verification below
    // still gates access per-record.
    const guardian = await prisma.guardian.findFirst({
      where: { email },
    });

    if (!guardian) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await verifyGuardianPassword(password, guardian.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = createGuardianSessionToken(guardian.id);
    await setGuardianSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error during guardian login:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
