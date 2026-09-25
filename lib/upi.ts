/**
 * UPI deep-link helpers.
 *
 * Builds standard `upi://pay` intent links (the same format GPay / PhonePe /
 * Paytm / BHIM all register a handler for) and a friendly WhatsApp-style
 * reminder message that embeds one. No payment aggregator or KYC is
 * involved here — the link just opens the payer's own UPI app pre-filled
 * with the amount and payee; the payer still has to authorize the payment
 * themselves. There is no automated bank transfer or payout API behind this.
 */

export function buildUpiPaymentLink({
  vpa,
  payeeName,
  amount,
  transactionNote,
  transactionRefId,
}: {
  vpa?: string | null;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRefId?: string;
}): string | null {
  if (!vpa || !vpa.trim()) return null;

  const params = new URLSearchParams();
  params.set("pa", vpa.trim());
  params.set("pn", payeeName);
  params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  if (transactionNote) params.set("tn", transactionNote);
  if (transactionRefId) params.set("tr", transactionRefId);

  return `upi://pay?${params.toString()}`;
}

export function buildPaymentReminderMessage({
  studentName,
  amount,
  dueDate,
  installmentNumber,
  upiLink,
  orgName,
}: {
  studentName: string;
  amount: number;
  dueDate: Date | string;
  installmentNumber: number;
  upiLink: string | null;
  orgName: string;
}): string {
  const dueDateObj = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const formattedDate = dueDateObj.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedAmount = `₹${amount.toLocaleString("en-IN")}`;

  const lines = [
    `Hi ${studentName}, this is a friendly reminder from ${orgName}.`,
    `Installment #${installmentNumber} of ${formattedAmount} is due on ${formattedDate}.`,
  ];

  if (upiLink) {
    lines.push(`Pay now: ${upiLink}`);
  } else {
    lines.push("Please contact us to complete the payment.");
  }

  return lines.join("\n");
}
