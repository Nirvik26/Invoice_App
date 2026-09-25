"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle,
  DownloadSimple,
  Printer,
  ShieldCheck,
  CreditCard,
  Bank,
  Lock,
  ArrowRight,
  Buildings,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { payPublicInvoiceAction } from "@/actions/invoices";
import type { PublicInvoice } from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface PublicInvoicePortalProps {
  invoice: PublicInvoice;
}

export function PublicInvoicePortal({ invoice: initialInvoice }: PublicInvoicePortalProps) {
  const [invoice, setInvoice] = useState<PublicInvoice>(initialInvoice);
  const [isProcessing, startTransition] = useTransition();
  const [paymentStep, setPaymentStep] = useState<"idle" | "authorizing" | "success">(
    initialInvoice.status === "Paid" ? "success" : "idle"
  );
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [cardName, setCardName] = useState(invoice.clientName);
  const [cardNumber, setCardNumber] = useState("•••• •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("888");

  const isPaid = invoice.status === "Paid";

  const handlePay = () => {
    if (isPaid || isProcessing) return;

    setPaymentStep("authorizing");

    startTransition(async () => {
      // Simulate quick secure gateway latency
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const res = await payPublicInvoiceAction(invoice.number);
      if (res.success) {
        setInvoice((prev) => ({ ...prev, status: "Paid" }));
        setPaymentStep("success");
      } else {
        alert(res.error || "Payment failed. Please try again.");
        setPaymentStep("idle");
      }
    });
  };

  const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formattedIssueDate = new Date(invoice.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="public-portal">
      {/* Top Banner Bar */}
      <header className="public-portal__topbar">
        <div className="public-portal__brand">
          <span className="sidebar__logo" style={{ width: 28, height: 28, fontSize: 16 }}>
            B
          </span>
          <strong>Billora</strong>
          <span className="public-portal__powered">Customer Billing Portal</span>
        </div>

        <div className="public-portal__top-actions">
          <button
            type="button"
            className="btn btn--outline public-portal__print-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print / PDF
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="public-portal__container">
        {/* Status Callout Banner */}
        {isPaid ? (
          <div className="public-banner public-banner--paid" role="status">
            <div className="public-banner__icon">
              <CheckCircle size={24} weight="fill" />
            </div>
            <div>
              <h3>Invoice Paid in Full</h3>
              <p>Thank you! Your payment has been received and confirmed.</p>
            </div>
            <button
              type="button"
              className="btn btn--outline public-banner__receipt-btn"
              onClick={() => window.print()}
            >
              <DownloadSimple size={15} />
              Save Receipt
            </button>
          </div>
        ) : (
          <div className="public-banner public-banner--due">
            <div className="public-banner__icon">
              <ShieldCheck size={24} weight="fill" />
            </div>
            <div>
              <h3>Payment Request from {invoice.issuerName}</h3>
              <p>Due by {formattedDueDate}. You can pay directly and securely online below.</p>
            </div>
          </div>
        )}

        <div className="public-portal__layout">
          {/* Printable Invoice Paper */}
          <article className="public-paper" id="invoice-printable-sheet">
            {/* Paper Header */}
            <header className="public-paper__header">
              <div>
                <span className="eyebrow">INVOICE FROM</span>
                <h1 className="public-paper__issuer">{invoice.issuerName}</h1>
                <span className="public-paper__issuer-email">{invoice.issuerEmail}</span>
              </div>

              <div className="public-paper__meta-badge">
                <span className="public-paper__number">{invoice.number}</span>
                <Badge status={invoice.status} />
              </div>
            </header>

            {/* Bill to & Dates Grid */}
            <div className="public-paper__grid">
              <div className="public-paper__col">
                <span className="eyebrow">BILLED TO</span>
                <div className="public-paper__client">
                  <Avatar initials={invoice.clientInitials} tone={invoice.clientTone} size="md" />
                  <div>
                    <strong>{invoice.clientName}</strong>
                    <div className="public-paper__client-sub">
                      <span>
                        <Buildings size={13} /> {invoice.clientCompany}
                      </span>
                      <span>
                        <EnvelopeSimple size={13} /> {invoice.clientEmail}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="public-paper__col public-paper__col--right">
                <div className="public-paper__date-row">
                  <span className="eyebrow">DATE ISSUED</span>
                  <b>{formattedIssueDate}</b>
                </div>
                <div className="public-paper__date-row">
                  <span className="eyebrow">DUE DATE</span>
                  <b>{formattedDueDate}</b>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="public-paper__table-wrap">
              <table className="public-paper__table">
                <thead>
                  <tr>
                    <th>Service &amp; Description</th>
                    <th style={{ textAlign: "right" }}>Rate</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.description}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>{fmt.format(item.rate)}</td>
                      <td style={{ textAlign: "center" }}>{item.qty}</td>
                      <td style={{ textAlign: "right" }}>
                        <b>{fmt.format(item.rate * item.qty)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="public-paper__footer">
              {invoice.notes && (
                <div className="public-paper__notes">
                  <span className="eyebrow">NOTES / TERMS</span>
                  <p>{invoice.notes}</p>
                </div>
              )}

              <div className="public-paper__totals">
                <div className="public-paper__total-row">
                  <span>Subtotal</span>
                  <span>{fmt.format(invoice.subtotal)}</span>
                </div>
                <div className="public-paper__total-row">
                  <span>Tax ({invoice.taxRate}%)</span>
                  <span>{fmt.format(invoice.tax)}</span>
                </div>
                <div className="public-paper__total-row public-paper__total-row--final">
                  <b>Total Amount Due</b>
                  <strong>{fmt.format(invoice.total)}</strong>
                </div>
              </div>
            </div>
          </article>

          {/* Payment Panel (Only shown if not paid, or displays summary when paid) */}
          <aside className="public-pay-card">
            {isPaid ? (
              <div className="public-pay-card__paid-state">
                <div className="public-pay-card__paid-icon">
                  <CheckCircle size={42} weight="fill" />
                </div>
                <h2>Receipt Confirmed</h2>
                <p>
                  This invoice has been marked as <b>Paid</b>. A receipt has been registered with {invoice.issuerName}.
                </p>
                <div className="public-pay-card__summary-box">
                  <div className="public-pay-card__summary-row">
                    <span>Amount Paid:</span>
                    <strong>{fmt.format(invoice.total)}</strong>
                  </div>
                  <div className="public-pay-card__summary-row">
                    <span>Reference:</span>
                    <code>{invoice.number}</code>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => window.print()}
                >
                  <DownloadSimple size={17} weight="bold" />
                  Print Official Receipt
                </button>
              </div>
            ) : (
              <div className="public-pay-card__form">
                <div className="public-pay-card__header">
                  <p className="eyebrow">SECURE CHECKOUT</p>
                  <h2>Pay Online</h2>
                  <div className="public-pay-card__amount-pill">
                    <span>Total:</span>
                    <strong>{fmt.format(invoice.total)}</strong>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="public-pay-card__methods">
                  <button
                    type="button"
                    className={`public-pay-method${paymentMethod === "card" ? " public-pay-method--active" : ""}`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard size={18} />
                    <span>Credit Card</span>
                  </button>
                  <button
                    type="button"
                    className={`public-pay-method${paymentMethod === "bank" ? " public-pay-method--active" : ""}`}
                    onClick={() => setPaymentMethod("bank")}
                  >
                    <Bank size={18} />
                    <span>Bank Transfer</span>
                  </button>
                </div>

                {paymentMethod === "card" ? (
                  <div className="public-pay-fields">
                    <label className="modal-field">
                      <span>Name on Card</span>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Cardholder Name"
                      />
                    </label>

                    <label className="modal-field">
                      <span>Card Number</span>
                      <div className="public-input-icon-wrap">
                        <CreditCard size={18} className="public-input-icon" />
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4242 4242 4242 4242"
                        />
                      </div>
                    </label>

                    <div className="public-pay-fields__row">
                      <label className="modal-field">
                        <span>Expires</span>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                        />
                      </label>
                      <label className="modal-field">
                        <span>CVC</span>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="123"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="public-pay-fields">
                    <div className="public-bank-instructions">
                      <p>
                        Instant ACH payment simulation is enabled. Clicking <b>Authorize Payment</b> will verify with test funds and mark this invoice settled.
                      </p>
                      <div className="public-bank-row">
                        <span>Routing Number:</span>
                        <code>021000021</code>
                      </div>
                      <div className="public-bank-row">
                        <span>Account:</span>
                        <code>••••••••8912</code>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn--primary public-pay-btn"
                  onClick={handlePay}
                  disabled={isProcessing}
                >
                  {isProcessing || paymentStep === "authorizing" ? (
                    <>
                      <span className="auth-submit__spinner" />
                      Processing payment…
                    </>
                  ) : (
                    <>
                      <Lock size={16} weight="bold" />
                      Pay {fmt.format(invoice.total)} Now
                      <ArrowRight size={15} weight="bold" />
                    </>
                  )}
                </button>

                <div className="public-pay-guarantee">
                  <ShieldCheck size={16} weight="fill" />
                  <span>256-bit encrypted checkout powered by Billora Payments</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
