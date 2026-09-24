import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const scopedDb = getScopedPrismaClient(session);
    const template = await scopedDb.messageTemplate.findFirst({ where: { id: params.id } });
    if (!template) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch template." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { name, channel, subject, body: templateBody } = body;
    const orgId = session.user.organizationId;
    const existing = await prisma.messageTemplate.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (channel !== undefined) {
      if (!["EMAIL", "SMS", "WHATSAPP"].includes(channel)) return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
      updateData.channel = channel;
      if (channel !== "EMAIL") updateData.subject = null;
    }
    if (subject !== undefined) {
      const ch = updateData.channel ?? existing.channel;
      updateData.subject = ch === "EMAIL" ? (subject?.trim() || null) : null;
    }
    if (templateBody !== undefined) updateData.body = templateBody;
    const template = await prisma.messageTemplate.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update template." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }
  try {
    const orgId = session.user.organizationId;
    const existing = await prisma.messageTemplate.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await prisma.messageTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete template." }, { status: 500 });
  }
}
