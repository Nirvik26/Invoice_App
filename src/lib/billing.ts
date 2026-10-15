import { z } from "zod";

export const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  rate: z.number().int().min(0).max(1_000_000),
  qty: z.number().int().min(1).max(10_000),
});
export const planSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(100),
      percent: z.number().int().min(1).max(100),
    }),
  )
  .min(1)
  .max(12)
  .refine(
    (p) => p.reduce((s, x) => s + x.percent, 0) === 100,
    "Payment percentages must total 100%.",
  );

export const proposalContentSchema = z
  .object({
    scope: z.string().trim().min(1).max(10_000),
    items: z.array(itemSchema).min(1).max(100),
    taxRate: z.number().int().min(0).max(100),
    paymentPlan: planSchema,
    paymentDays: z.number().int().min(1).max(365),
  })
  .refine(
    (c) =>
      totalCents(c.items, c.taxRate) >= 50 &&
      totalCents(c.items, c.taxRate) <= 99_999_999,
    "Total must be between $0.50 and $999,999.99.",
  )
  .refine(
    (c) =>
      installments(totalCents(c.items, c.taxRate), c.paymentPlan).every(
        (p) => p.amountCents >= 50,
      ),
    "Each installment must be at least $0.50.",
  );

export type ProposalContent = z.infer<typeof proposalContentSchema>;
export type PaymentPlan = z.infer<typeof planSchema>;

export function totalCents(
  items: { rate: number; qty: number }[],
  taxRate: number,
) {
  const subtotal = items.reduce(
    (sum, i) => sum + Math.round(i.rate * 100) * i.qty,
    0,
  );
  return subtotal + Math.round((subtotal * taxRate) / 100);
}

// Allocate the rounding remainder to the final installment, so totals always agree.
export function installments(total: number, plan: PaymentPlan) {
  let allocated = 0;
  return plan.map((p, i) => {
    const amountCents =
      i === plan.length - 1
        ? total - allocated
        : Math.floor((total * p.percent) / 100);
    allocated += amountCents;
    return { ...p, amountCents, cumulativeCents: allocated };
  });
}

export function nextInstallment(
  total: number,
  paid: number,
  plan: PaymentPlan,
) {
  const next = installments(total, plan).find((p) => p.cumulativeCents > paid);
  return next
    ? { label: next.label, amountCents: next.cumulativeCents - paid }
    : null;
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const tokenSchema = z.string().uuid();

export function summarizeInvoices(
  rows: import("@/types").InvoiceRow[],
  now = new Date(),
) {
  const inMonth = (date: Date) =>
    new Date(date).getFullYear() === now.getFullYear() &&
    new Date(date).getMonth() === now.getMonth();
  let revenueThisMonth = 0,
    outstanding = 0,
    outstandingCount = 0,
    overdue = 0,
    overdueCount = 0;
  for (const invoice of rows) {
    if (
      !invoice.paymentHistory.length &&
      invoice.status === "Paid" &&
      inMonth(invoice.createdAt)
    )
      revenueThisMonth += invoice.paidCents / 100;
    for (const payment of invoice.paymentHistory) {
      if (
        payment.status === "paid" &&
        payment.paidAt &&
        inMonth(payment.paidAt)
      )
        revenueThisMonth += payment.amountCents / 100;
    }
    if (invoice.status === "Sent") {
      outstanding += invoice.balanceCents / 100;
      outstandingCount++;
    }
    if (invoice.status === "Overdue") {
      overdue += invoice.balanceCents / 100;
      overdueCount++;
    }
  }
  return {
    revenueThisMonth,
    outstanding,
    outstandingCount,
    overdue,
    overdueCount,
  };
}
