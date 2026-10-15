import type Stripe from "stripe";
import { eq, and, asc } from "drizzle-orm";
import { db } from "./db";
import { invoices, lineItems, payments } from "./schema";
import { nextInstallment, totalCents } from "./billing";
import { applicationUrl, stripeClient, paymentsConfigured } from "./stripe";

export async function startCheckout(
  token: string,
  gateway?: Pick<Stripe, "checkout">,
): Promise<string> {
  if (!paymentsConfigured())
    throw new Error(
      "Online test payments are not configured yet. Please contact the invoice issuer.",
    );
  const stripe = gateway ?? stripeClient();
  // Persist the attempt before making any network request. Retries keep the same
  // idempotency key even if Stripe succeeds but the response is lost.
  const { invoice, attempt } = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.publicToken, token))
      .for("update");
    if (!invoice || invoice.status === "Draft")
      throw new Error("Invoice is not available for payment.");
    if (invoice.status === "Paid")
      throw new Error("This invoice is already paid.");
    const items = await tx
      .select()
      .from(lineItems)
      .where(eq(lineItems.invoiceId, invoice.id));
    const history = await tx
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoice.id))
      .orderBy(asc(payments.createdAt));
    const paid = history
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amountCents, 0);
    const next = nextInstallment(
      totalCents(items, invoice.taxRate),
      paid,
      invoice.paymentPlan,
    );
    if (!next || next.amountCents < 50 || next.amountCents > 99_999_999)
      throw new Error(
        "This installment cannot be paid online. Contact the issuer.",
      );
    const pending = history.find((p) => p.status === "pending");
    if (pending) return { invoice, attempt: pending };
    const [attempt] = await tx
      .insert(payments)
      .values({
        invoiceId: invoice.id,
        amountCents: next.amountCents,
        label: next.label,
      })
      .returning();
    return { invoice, attempt };
  });
  let session: Stripe.Checkout.Session;
  if (attempt.sessionId) {
    session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
  } else {
    // Stripe may prune idempotency keys after 24h. Never create a fresh charge
    // for an unresolved attempt beyond that window; require reconciliation.
    if (Date.now() - attempt.createdAt.getTime() > 23 * 60 * 60 * 1000)
      throw new Error(
        "An earlier checkout needs reconciliation. Please contact the invoice issuer.",
      );
    const base = `${applicationUrl()}/invoice/${invoice.publicToken}`;
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        client_reference_id: attempt.id,
        metadata: { paymentId: attempt.id, invoiceId: invoice.id },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: attempt.amountCents,
              product_data: { name: `${invoice.number} — ${attempt.label}` },
            },
          },
        ],
        success_url: `${base}?payment=processing`,
        cancel_url: `${base}?payment=canceled`,
      },
      { idempotencyKey: `billora-${attempt.id}` },
    );
    await db
      .update(payments)
      .set({ sessionId: session.id })
      .where(eq(payments.id, attempt.id));
  }
  if (session.status === "complete")
    throw new Error(
      "Your previous payment is being confirmed. Refresh shortly.",
    );
  if (session.status === "expired") {
    await db
      .update(payments)
      .set({ status: "expired" })
      .where(and(eq(payments.id, attempt.id), eq(payments.status, "pending")));
    return startCheckout(token, stripe);
  }
  if (!session.url)
    throw new Error("Unable to open checkout. Try again shortly.");
  return session.url;
}

export async function fulfillCheckout(
  session: Stripe.Checkout.Session,
  kind: string,
) {
  const paymentId = session.metadata?.paymentId;
  if (!paymentId) return; // An unrelated Checkout Session in this Stripe account.
  return db.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    if (!initial) throw new Error("Payment record not found; retry webhook.");
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, initial.invoiceId))
      .for("update");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    if (
      session.livemode ||
      session.currency !== "usd" ||
      session.amount_total !== payment.amountCents ||
      (payment.sessionId !== null && session.id !== payment.sessionId) ||
      session.metadata?.invoiceId !== invoice.id
    )
      throw new Error("Payment does not match the invoice.");
    if (payment.status === "paid") return; // Both duplicate and out-of-order events are harmless.
    if (
      kind === "checkout.session.expired" ||
      kind === "checkout.session.async_payment_failed"
    ) {
      await tx
        .update(payments)
        .set({ status: kind.endsWith("expired") ? "expired" : "failed" })
        .where(eq(payments.id, payment.id));
      return;
    }
    if (session.payment_status !== "paid") return;
    const items = await tx
      .select()
      .from(lineItems)
      .where(eq(lineItems.invoiceId, invoice.id));
    const paid = await tx
      .select()
      .from(payments)
      .where(
        and(eq(payments.invoiceId, invoice.id), eq(payments.status, "paid")),
      );
    const amountPaid =
      paid.reduce((sum, p) => sum + p.amountCents, 0) + payment.amountCents;
    const total = totalCents(items, invoice.taxRate);
    if (amountPaid > total)
      throw new Error(
        "Payment exceeds invoice balance; reconciliation required.",
      );
    await tx
      .update(payments)
      .set({ status: "paid", sessionId: session.id, paidAt: new Date() })
      .where(eq(payments.id, payment.id));
    await tx
      .update(invoices)
      .set({
        status:
          amountPaid === total
            ? "Paid"
            : invoice.status === "Overdue"
              ? "Overdue"
              : "Sent",
      })
      .where(eq(invoices.id, invoice.id));
  });
}
