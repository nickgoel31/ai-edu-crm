import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/scoped-prisma";
import { assertCanMutate } from "@/lib/rbac";
import { DocumentStatus } from "@/types";
import { prisma } from "@/lib/prisma";
import { encryptField, decryptField } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
    const { id: studentId } = params;
    const body = await req.json();
    const { documentId, status, fileUrl, name } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify student belongs to this organization
    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    // Verify document belongs to this student
    const existingDoc = await prisma.document.findFirst({
      where: {
        id: documentId,
        studentId: student.id,
      },
    });

    if (!existingDoc) {
      return NextResponse.json(
        { error: "Document not found for this student." },
        { status: 404 }
      );
    }

    const updates: any = {};
    const changes: any = {};

    if (status && Object.values(DocumentStatus).includes(status)) {
      updates.status = status;
      changes.status = { from: existingDoc.status, to: status };
    }

    if (fileUrl !== undefined) {
      updates.fileUrl = fileUrl ? encryptField(fileUrl.trim()) : null;
      changes.fileUrl = { from: "[REDACTED]", to: fileUrl ? "[UPDATED]" : null };
    }

    if (name && name.trim() !== existingDoc.name) {
      updates.name = name.trim();
      changes.name = { from: existingDoc.name, to: name.trim() };
    }

    const updatedDoc = await prisma.document.update({
      where: { id: documentId },
      data: updates,
    });

    // Write audit log
    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DOCUMENT_UPDATED",
        entityType: "Student",
        entityId: student.id,
        changesJson: {
          documentId,
          documentName: updatedDoc.name,
          ...changes,
        },
      },
    });

    if (changes.status) {
      await logActivity({
        organizationId: session.user.organizationId,
        entityType: "STUDENT",
        entityId: student.id,
        type: "DOCUMENT_UPDATE",
        metadata: {
          documentName: updatedDoc.name,
          oldStatus: changes.status.from,
          newStatus: changes.status.to,
        },
      });
    }

    return NextResponse.json({
      document: {
        ...updatedDoc,
        fileUrl: decryptField(updatedDoc.fileUrl),
      },
    });
  } catch (error: any) {
    console.error("Error updating document status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update document." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
    const { id: studentId } = params;
    const body = await req.json();
    const { name, status, fileUrl } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Document name is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    // Verify student belongs to this organization
    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    const newDoc = await prisma.document.create({
      data: {
        studentId: student.id,
        name: name.trim(),
        status: status && Object.values(DocumentStatus).includes(status) ? status : DocumentStatus.PENDING,
        fileUrl: fileUrl ? encryptField(fileUrl.trim()) : null,
      },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DOCUMENT_ADDED",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          documentId: newDoc.id,
          documentName: newDoc.name,
          status: newDoc.status,
        }),
      },
    });

    return NextResponse.json({
      document: {
        ...newDoc,
        fileUrl: decryptField(newDoc.fileUrl),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding document:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required." },
      { status: 401 }
    );
  }

  try {
    assertCanMutate(session);
    const { id: studentId } = params;
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId query param is required." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedPrismaClient(session);

    const student = await scopedDb.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this organization." },
        { status: 404 }
      );
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, studentId: student.id },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found for this student." },
        { status: 404 }
      );
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    await scopedDb.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DOCUMENT_REMOVED",
        entityType: "Student",
        entityId: student.id,
        changesJson: JSON.stringify({
          documentName: doc.name,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing document:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove document." },
      { status: 500 }
    );
  }
}
