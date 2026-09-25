"use client";

import { useState, useEffect, useTransition } from "react";
import {
  X,
  CheckCircle,
  Printer,
  Trash,
  Copy,
  Buildings,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  getInvoiceDetailsAction,
  updateInvoiceStatusAction,
  deleteInvoiceAction,
} from "@/actions/invoices";
import type { InvoiceRow, InvoiceWithDetails, InvoiceStatus, AvatarTone } from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface InvoiceDetailDrawerProps {
  invoice: InvoiceRow | null;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: InvoiceStatus) => void;
  onDelete: (id: string) => void;
  onNotify: (msg: string) => void;
}

const STATUS_OPTIONS: InvoiceStatus[] = ["Draft", "Sent", "Paid", "Overdue"];

export function InvoiceDetailDrawer({
  invoice,
  onClose,
  onStatusChange,
  onDelete,
  onNotify,
}: InvoiceDetailDrawerProps) {
  const [details, setDetails] = useState<InvoiceWithDetails | null>(null);
  const [isUpdating, startUpdating] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const loading = !details || details.id !== invoice?.id;

  // Fetch full details whenever the selected invoice changes
  useEffect(() => {
    if (!invoice?.id) return;

    let active = true;

    getInvoiceDetailsAction(invoice.id).then((res) => {
      if (active) {
        setDetails(res);
      }
    });

    return () => {
      active = false;
    };
  }, [invoice?.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && invoice) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invoice, onClose]);

  if (!invoice) return null;

  const handleStatusUpdate = (status: InvoiceStatus) => {
    if (status === invoice.status) return;

    startUpdating(async () => {
      const res = await updateInvoiceStatusAction(invoice.id, status);
      if (res.success) {
        onStatusChange(invoice.id, status);
        if (details) {
          setDetails({ ...details, status });
        }
        onNotify(`Invoice status updated to ${status}`);
      } else {
        onNotify(res.error || "Failed to update status");
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Are you sure you want to permanently delete invoice ${invoice.number}? This action cannot be undone.`
      )
    ) {
      return;
    }

    startDeleting(async () => {
      const res = await deleteInvoiceAction(invoice.id);
      if (res.success) {
        onDelete(invoice.id);
        onNotify(`Invoice ${invoice.number} deleted`);
        onClose();
      } else {
        onNotify(res.error || "Failed to delete invoice");
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invoice/${invoice.number}`
      );
      onNotify("Invoice link copied to clipboard");
    } catch {
      onNotify("Failed to copy link");
    }
  };

  const subtotal = details?.subtotal ?? invoice.subtotal;
  const taxRate = details?.taxRate ?? 8;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-invoice-number"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-panel" id="invoice-printable-sheet">
        {/* Drawer Header */}
        <header className="drawer-panel__header">
          <div className="drawer-panel__title-wrap">
            <Badge status={invoice.status} />
            <h2 id="drawer-invoice-number" className="drawer-panel__title">
              {invoice.number}
            </h2>
          </div>
          <div className="drawer-panel__header-actions">
            <button
              type="button"
              className="drawer-icon-btn"
              onClick={handleCopyLink}
              title="Copy shareable link"
              aria-label="Copy shareable link"
            >
              <Copy size={17} />
            </button>
            <button
              type="button"
              className="drawer-icon-btn"
              onClick={() => window.print()}
              title="Print or export PDF"
              aria-label="Print or export PDF"
            >
              <Printer size={17} />
            </button>
            <button
              type="button"
              className="drawer-icon-btn drawer-icon-btn--close"
              onClick={onClose}
              title="Close drawer"
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Quick Status Control Bar */}
        <div className="drawer-status-bar">
          <div className="drawer-status-bar__label">
            <span>Change Status:</span>
            {isUpdating && <span className="auth-submit__spinner" style={{ width: 14, height: 14 }} />}
          </div>
          <div className="drawer-status-chips">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                className={`drawer-status-chip drawer-status-chip--${st.toLowerCase()}${
                  invoice.status === st ? " drawer-status-chip--active" : ""
                }`}
                disabled={isUpdating}
                onClick={() => handleStatusUpdate(st)}
              >
                {st}
              </button>
            ))}
          </div>

          {invoice.status !== "Paid" && (
            <button
              type="button"
              className="btn btn--primary drawer-mark-paid"
              onClick={() => handleStatusUpdate("Paid")}
              disabled={isUpdating}
            >
              <CheckCircle size={16} weight="fill" />
              Mark as Paid
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="drawer-panel__body">
          {/* Client & Date Info Card */}
          <div className="drawer-info-card">
            <div className="drawer-info-block">
              <span className="drawer-info-sub">Billed To</span>
              <div className="drawer-client-row">
                <Avatar
                  initials={invoice.clientInitials}
                  tone={invoice.clientTone as AvatarTone}
                  size="md"
                />
                <div>
                  <strong>{invoice.clientName}</strong>
                  <div className="drawer-client-meta">
                    <span title="Company">
                      <Buildings size={13} /> {invoice.clientCompany}
                    </span>
                    {details?.clientEmail && (
                      <span title="Email">
                        <EnvelopeSimple size={13} /> {details.clientEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="drawer-info-block drawer-info-block--dates">
              <div>
                <span className="drawer-info-sub">Payment Due</span>
                <strong>{formattedDueDate}</strong>
              </div>
              <div>
                <span className="drawer-info-sub">Issued Date</span>
                <span>
                  {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="drawer-section">
            <h3 className="drawer-section__title">Line Items</h3>
            {loading ? (
              <div className="drawer-skeleton">
                <div className="drawer-skeleton-row" />
                <div className="drawer-skeleton-row" />
                <div className="drawer-skeleton-row" />
              </div>
            ) : details?.items && details.items.length > 0 ? (
              <table className="drawer-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Rate</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {details.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.description}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmt.format(item.rate)}
                      </td>
                      <td style={{ textAlign: "center" }}>{item.qty}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{fmt.format(item.rate * item.qty)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="drawer-empty-items">No item breakdown available.</p>
            )}
          </div>

          {/* Total Calculation */}
          <div className="drawer-totals">
            <div className="drawer-totals__row">
              <span>Subtotal</span>
              <span>{fmt.format(subtotal)}</span>
            </div>
            <div className="drawer-totals__row">
              <span>Tax ({taxRate}%)</span>
              <span>{fmt.format(tax)}</span>
            </div>
            <div className="drawer-totals__row drawer-totals__row--grand">
              <span>Total Due</span>
              <strong>{fmt.format(total)}</strong>
            </div>
          </div>

          {/* Notes */}
          {details?.notes && (
            <div className="drawer-notes">
              <span className="drawer-info-sub">Notes & Payment Terms</span>
              <p>{details.notes}</p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <footer className="drawer-panel__footer">
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash size={16} />
            {isDeleting ? "Deleting…" : "Delete Invoice"}
          </button>

          <button
            type="button"
            className="btn btn--outline"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
