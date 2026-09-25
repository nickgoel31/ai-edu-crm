import { prisma } from "@/lib/prisma";
import { sendNotificationWhatsApp } from "@/lib/notifications";
import { buildUpiPaymentLink, buildPaymentReminderMessage } from "@/lib/upi";

/**
 * Sends a fee/payment reminder for a single Payment via WhatsApp, including
 * a UPI deep link when the student's organization has a `upiVpa` configured.
 * Standalone from the agent-trigger-engine's automated reminders — meant to
 * be called directly (e.g. from a "Send Reminder" button) for one-off,
 * staff-initiated reminders.
 */
export async function sendFeeReminder(
  paymentId: string
): Promise<{ success: boolean; message: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!payment) {
    return { success: false, message: "Payment record not found." };
  }

  const { student } = payment;
  if (!student) {
    return { success: false, message: "This payment has no associated student." };
  }

  const organization = student.organization;
  if (!organization) {
    return { success: false, message: "This student has no associated organization." };
  }

  if (!student.phone) {
    return { success: false, message: "Student has no phone number on file." };
  }

  const upiLink = buildUpiPaymentLink({
    vpa: organization.upiVpa,
    payeeName: organization.name,
    amount: payment.amount,
    transactionNote: `Fee installment #${payment.installmentNumber}`,
    transactionRefId: payment.id,
  });

  const message = buildPaymentReminderMessage({
    studentName: student.name,
    amount: payment.amount,
    dueDate: payment.dueDate,
    installmentNumber: payment.installmentNumber,
    upiLink,
    orgName: organization.name,
  });

  await sendNotificationWhatsApp({
    to: student.phone,
    message,
    organizationId: organization.id,
  });

  return {
    success: true,
    message: `Reminder sent to ${student.name} (${student.phone}).`,
  };
}
