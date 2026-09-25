import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate, assertModuleAccess } from "@/lib/rbac";
import { hashGuardianPassword } from "@/lib/guardian-auth";

// Staff-facing CRUD for guardian portal accounts. This is a normal
// session-authenticated staff route (NextAuth), separate from the
// guardian-facing app/api/portal/* routes which use their own auth.

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertModuleAccess(session, "students");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  try {
    const scopedDb = getScopedPrismaClient(session);

    const guardians = await scopedDb.guardian.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: { id: true, name: true, program: true, cohort: true, stage: true },
        },
      },
    });

    return NextResponse.json({
      guardians: guardians.map((g: any) => ({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        createdAt: g.createdAt,
        student: g.student,
      })),
    });
  } catch (error: any) {
    console.error("Error listing guardians:", error);
    return NextResponse.json({ error: error?.message || "Failed to load guardians." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Active session required." }, { status: 401 });
  }

  try {
    assertCanMutate(session);
    assertModuleAccess(session, "students");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  try {
    const body = await req.json();
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!studentId || !name || !email || !password) {
      return NextResponse.json(
        { error: "studentId, name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findFirst({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found in your organization." }, { status: 404 });
    }

    const existing = await scopedDb.guardian.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A guardian account with this email already exists in your organization." },
        { status: 409 }
      );
    }

    const passwordHash = await hashGuardianPassword(password);

    // Cast to `any`: the scoped Prisma extension injects organizationId at
    // runtime (see lib/scoped-prisma.ts), which confuses TS's inference
    // between Guardian's checked/unchecked create input unions since the
    // model has two required foreign keys (organization + student).
    const guardian = await scopedDb.guardian.create({
      data: {
        studentId,
        name,
        email,
        phone: phone || null,
        password: passwordHash,
      } as any,
    });

    return NextResponse.json(
      {
        guardian: {
          id: guardian.id,
          name: guardian.name,
          email: guardian.email,
          phone: guardian.phone,
          studentId: guardian.studentId,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating guardian:", error);
    return NextResponse.json({ error: error?.message || "Failed to create guardian account." }, { status: 500 });
  }
}
