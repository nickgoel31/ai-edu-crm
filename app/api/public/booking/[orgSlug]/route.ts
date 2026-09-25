import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { ingestOrUpdateLead } from "@/lib/lead-ingestion";
import { sendNotificationWhatsApp } from "@/lib/notifications";
import { LeadSource } from "@/types";

/**
 * PUBLIC, unauthenticated route — this is what a prospective student's
 * browser hits directly from app/book/[orgSlug]/page.tsx. Never expose
 * anything beyond org name/branding + upcoming open slots here.
 */
export async function GET(req: Request, { params }: { params: { orgSlug: string } }) {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: params.orgSlug },
      select: {
        id: true,
        name: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Booking page not found." }, { status: 404 });
    }

    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const slots = await prisma.demoSlot.findMany({
      where: {
        organizationId: org.id,
        isActive: true,
        startTime: { gte: now, lte: in14Days },
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        capacity: true,
        bookedCount: true,
      },
    });

    const openSlots = slots.filter((s) => s.bookedCount < s.capacity);

    return NextResponse.json({
      organization: {
        name: org.name,
        brandLogoUrl: org.brandLogoUrl,
        brandPrimaryColor: org.brandPrimaryColor,
      },
      slots: openSlots,
    });
  } catch (err: any) {
    console.error("Failed to load public booking page:", err);
    return NextResponse.json({ error: "Failed to load booking page." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { orgSlug: string } }) {
  const rateLimit = await checkRateLimit(req, "public-booking-create", {
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return rateLimit.response!;
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: params.orgSlug },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Booking page not found." }, { status: 404 });
    }

    const body = await req.json();
    const { demoSlotId, name, phone, email, program } = body;

    if (!demoSlotId || !name || !phone) {
      return NextResponse.json(
        { error: "demoSlotId, name, and phone are required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const slot = await tx.demoSlot.findFirst({
        where: { id: demoSlotId, organizationId: org.id, isActive: true },
      });

      if (!slot) {
        throw new Error("SLOT_NOT_FOUND");
      }
      if (slot.bookedCount >= slot.capacity) {
        throw new Error("SLOT_FULL");
      }
      if (slot.startTime < new Date()) {
        throw new Error("SLOT_IN_PAST");
      }

      await tx.demoSlot.update({
        where: { id: slot.id },
        data: { bookedCount: { increment: 1 } },
      });

      const booking = await tx.demoBooking.create({
        data: {
          organizationId: org.id,
          demoSlotId: slot.id,
          name,
          phone,
          email: email || null,
          program: program || null,
          status: "SCHEDULED",
        },
      });

      return { booking, slot };
    });

    // Best-effort: create/dedup a Lead off the back of this booking — a
    // demo booking is a strong inbound signal, worth routing through the
    // normal lead ingestion/scoring/SLA pipeline. Never fail the booking
    // over this.
    let leadId: string | null = null;
    try {
      const ingestResult = await ingestOrUpdateLead({
        organizationId: org.id,
        source: LeadSource.WEBSITE_FORM,
        name,
        phone,
        email: email || null,
        notes: `Booked a free demo class${program ? ` for ${program}` : ""} via public booking page.`,
      });
      leadId = ingestResult.lead.id;

      await prisma.demoBooking.update({
        where: { id: result.booking.id },
        data: { leadId },
      });
    } catch (err) {
      console.error("Failed to link demo booking to a lead (non-fatal):", err);
    }

    // Best-effort WhatsApp confirmation — never fail the booking over this.
    try {
      const slot = result.slot;
      const when = new Date(slot.startTime).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      await sendNotificationWhatsApp({
        to: phone,
        message: `Hi ${name}, your free demo class is confirmed for ${when}. We look forward to seeing you!`,
        organizationId: org.id,
      });
    } catch (err) {
      console.error("Failed to send booking confirmation WhatsApp (non-fatal):", err);
    }

    return NextResponse.json(
      { booking: { ...result.booking, leadId } },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.message === "SLOT_NOT_FOUND") {
      return NextResponse.json({ error: "This slot is no longer available." }, { status: 404 });
    }
    if (err?.message === "SLOT_FULL") {
      return NextResponse.json({ error: "This slot has just been fully booked. Please pick another time." }, { status: 409 });
    }
    if (err?.message === "SLOT_IN_PAST") {
      return NextResponse.json({ error: "This slot is no longer bookable." }, { status: 400 });
    }
    console.error("Failed to create public booking:", err);
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
