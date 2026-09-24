import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTemplate } from "@/lib/template-merge";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { templateId, entityType, entityId, body: rawBody, subject: rawSubject } = body;
    const orgId = session.user.organizationId;

    let templateBody: string = rawBody ?? "";
    let templateSubject: string | null = rawSubject ?? null;
    let channel: string = "EMAIL";

    // If templateId provided, load from DB
    if (templateId) {
      const tmpl = await prisma.messageTemplate.findFirst({
        where: { id: templateId, organizationId: orgId },
      });
      if (!tmpl) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
      }
      templateBody = tmpl.body;
      templateSubject = tmpl.subject;
      channel = tmpl.channel;
    }

    const resolvedEntityType: "LEAD" | "STUDENT" = entityType === "STUDENT" ? "STUDENT" : "LEAD";

    // Find a sample entity if entityId not specified
    let sampleId = entityId;
    if (!sampleId) {
      if (resolvedEntityType === "LEAD") {
        const sample = await prisma.lead.findFirst({ where: { organizationId: orgId } });
        sampleId = sample?.id;
      } else {
        const sample = await prisma.student.findFirst({ where: { organizationId: orgId } });
        sampleId = sample?.id;
      }
    }

    if (!sampleId) {
      // No sample — return template with unresolved fields
      return NextResponse.json({
        body: templateBody,
        subject: templateSubject,
        channel,
        sampleId: null,
      });
    }

    const { body: resolvedBody, subject: resolvedSubject } = await resolveTemplate(
      templateBody,
      templateSubject,
      resolvedEntityType,
      sampleId,
      orgId
    );

    return NextResponse.json({
      body: resolvedBody,
      subject: resolvedSubject,
      channel,
      sampleId,
    });
  } catch (error: any) {
    console.error("POST /api/message-templates/preview error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate preview." },
      { status: 500 }
    );
  }
}