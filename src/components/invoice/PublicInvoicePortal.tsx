"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { installments, nextInstallment, money } from "@/lib/billing";
import type { PublicInvoice } from "@/types";

export function PublicInvoicePortal({
  invoice,
  paymentsEnabled,
}: {
  invoice: PublicInvoice;
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = Math.round(invoice.total * 100);
  const next = nextInstallment(total, invoice.paidCents, invoice.paymentPlan);
  const processing = search.get("payment") === "processing";
  useEffect(() => {
    if (!invoice.balanceCents) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router, invoice.balanceCents]);
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invoice.publicToken }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not start payment.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment.");
      setBusy(false);
    }
  }
  return (
    <div className="public-portal">
      <header className="public-portal__topbar">
        <div className="public-portal__brand">
          <span className="sidebar__logo">B</span>
          <strong>Billora</strong>
          <span>Client billing portal</span>
        </div>
        <button className="btn btn--outline" onClick={() => window.print()}>
          Print / PDF
        </button>
      </header>
      <main className="public-portal__container">
        <div className="flow-notice">
          Test payment mode · No real money is collected.
        </div>
        {processing && (
          <p className="flow-notice" role="status">
            Payment submitted. Confirmed payments appear below automatically;
            returning from checkout alone does not confirm payment.
          </p>
        )}
        {search.get("payment") === "canceled" && (
          <p className="flow-notice">
            Checkout canceled. You can resume it below.
          </p>
        )}
        <div className="public-portal__layout">
          <article className="public-paper" id="invoice-printable-sheet">
            <header className="public-paper__header">
              <div>
                <span className="eyebrow">INVOICE FROM</span>
                <h1>{invoice.issuerName}</h1>
                <p>{invoice.issuerEmail}</p>
              </div>
              <div>
                <h2>{invoice.number}</h2>
                <Badge status={invoice.status} />
              </div>
            </header>
            <div className="public-paper__grid">
              <div>
                <span className="eyebrow">BILLED TO</span>
                <h3>{invoice.clientName}</h3>
                <p>{invoice.clientCompany}</p>
                <p>{invoice.clientEmail}</p>
              </div>
              <div>
                <span className="eyebrow">DUE DATE</span>
                <p>{invoice.dueDate}</p>
              </div>
            </div>
            <div className="public-paper__table-wrap">
              <table className="public-paper__table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Rate</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{money(item.rate * 100)}</td>
                      <td>{item.qty}</td>
                      <td>{money(item.rate * item.qty * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="public-paper__footer">
              <div className="public-paper__notes">
                <span className="eyebrow">SCOPE & TERMS</span>
                <p style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</p>
              </div>
              <div className="public-paper__totals">
                <div className="public-paper__total-row">
                  <span>Subtotal</span>
                  <span>{money(invoice.subtotal * 100)}</span>
                </div>
                <div className="public-paper__total-row">
                  <span>Tax ({invoice.taxRate}%)</span>
                  <span>{money(Math.round(invoice.tax * 100))}</span>
                </div>
                <div className="public-paper__total-row">
                  <b>Invoice total</b>
                  <b>{money(total)}</b>
                </div>
                <div className="public-paper__total-row">
                  <span>Paid</span>
                  <span>{money(invoice.paidCents)}</span>
                </div>
                <div className="public-paper__total-row public-paper__total-row--final">
                  <b>Balance</b>
                  <strong>{money(invoice.balanceCents)}</strong>
                </div>
              </div>
            </div>
          </article>
          <aside className="public-pay-card flow-stack">
            <span className="eyebrow">PAYMENT SCHEDULE</span>
            <h2>
              {invoice.balanceCents
                ? invoice.paidCents
                  ? "Partially paid"
                  : "Ready when you are"
                : "Paid in full"}
            </h2>
            <progress
              aria-label="Payment progress"
              value={invoice.paidCents}
              max={total || 1}
            />
            {installments(total, invoice.paymentPlan).map((p, i) => (
              <div className="flow-schedule" key={i}>
                <div>
                  <strong>{p.label}</strong>
                  <small>
                    {p.percent}% ·{" "}
                    {invoice.paidCents >= p.cumulativeCents
                      ? "Paid"
                      : next?.label === p.label
                        ? "Next payment"
                        : "Upcoming"}
                  </small>
                </div>
                <b>{money(p.amountCents)}</b>
              </div>
            ))}
            {next && (
              <>
                <p>
                  Next:{" "}
                  <b>
                    {next.label} · {money(next.amountCents)}
                  </b>
                </p>
                <p className="flow-muted">
                  Pay each installment when its agreed milestone is complete.
                  Card details are entered on Stripe’s hosted checkout.
                </p>
                {!paymentsEnabled && (
                  <p className="flow-notice">
                    Online test payments are not configured yet. Please contact{" "}
                    {invoice.issuerName}.
                  </p>
                )}
                <button
                  className="btn btn--primary"
                  disabled={busy || !paymentsEnabled}
                  onClick={checkout}
                >
                  {busy
                    ? "Opening checkout…"
                    : "Pay " + money(next.amountCents)}
                </button>
              </>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <h3>Payment history</h3>
            {!invoice.paymentHistory.length && (
              <p className="flow-muted">
                {invoice.status === "Paid"
                  ? "Marked paid before payment tracking was introduced."
                  : "No payments yet."}
              </p>
            )}
            {invoice.paymentHistory.map((p) => (
              <div className="flow-schedule" key={p.id}>
                <div>
                  <strong>{p.label}</strong>
                  <small>
                    {p.status === "paid" ? "Confirmed" : p.status} ·{" "}
                    {new Date(p.paidAt || p.createdAt).toLocaleString()}
                  </small>
                </div>
                <b>{money(p.amountCents)}</b>
              </div>
            ))}
          </aside>
        </div>
      </main>
    </div>
  );
}
