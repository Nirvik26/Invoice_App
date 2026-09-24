"use client";

import { useState, useMemo, useActionState } from "react";
import {
  CalendarBlank, CaretDown, Check, CheckCircle, Copy,
  DownloadSimple, PaperPlaneTilt, Plus, Sparkle, Trash, UserCircle,
} from "@phosphor-icons/react";
import { createInvoiceAction } from "@/actions/invoices";
import type { FormState } from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface Item {
  id: number;
  description: string;
  rate: number;
  qty: number;
}

interface InvoiceEditorProps {
  availableClients: string[];
  nextInvoiceNumber: string;
  onNotify: (msg: string) => void;
}

const DEFAULT_ITEMS: Item[] = [
  { id: 1, description: "Brand strategy workshop", rate: 1200, qty: 1 },
  { id: 2, description: "Visual identity direction", rate: 1800, qty: 1 },
  { id: 3, description: "Website design · 4 pages", rate: 450, qty: 4 },
];

export function InvoiceEditor({
  availableClients,
  nextInvoiceNumber,
  onNotify,
}: InvoiceEditorProps) {
  const [client, setClient] = useState(availableClients[0] ?? "");
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);

  const [state, action, pending] = useActionState<FormState, FormData>(
    createInvoiceAction,
    undefined
  );

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.rate * i.qty, 0),
    [items]
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  const update = (id: number, key: keyof Item, value: string | number) =>
    setItems((rows) =>
      rows.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );

  const addLine = () =>
    setItems((rows) => [
      ...rows,
      { id: Date.now(), description: "New service", rate: 0, qty: 1 },
    ]);

  const removeLine = (id: number) =>
    setItems((rows) => rows.filter((item) => item.id !== id));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/invoice/${nextInvoiceNumber}`
      );
    } catch {}
    onNotify("Secure invoice link copied");
  };

  return (
    <div className="editor">
      <div className="editor__heading">
        <div>
          <p className="eyebrow">DRAFT / {nextInvoiceNumber}</p>
          <h1>New invoice</h1>
        </div>
        <span className="editor__saved">
          <CheckCircle size={15} weight="fill" />
          Auto-saved to database
        </span>
      </div>

      <form
        action={(fd) => {
          // Inject items as JSON before submitting
          fd.set("clientName", client);
          fd.set(
            "items",
            JSON.stringify(
              items.map(({ description, rate, qty }) => ({ description, rate, qty }))
            )
          );
          return action(fd);
        }}
      >
        {state?.message && (
          <div className="auth-error" style={{ marginBottom: 16 }} role="alert">
            {state.message}
          </div>
        )}

        <div className="editor__layout">
          {/* ── Invoice paper ── */}
          <section className="paper" aria-label="Invoice preview">
            <header className="paper__header">
              <div className="paper__brand">
                <span
                  className="sidebar__logo"
                  style={{ width: 26, height: 26, fontSize: 16 }}
                >
                  B
                </span>
                <b>Billora Studio</b>
              </div>
              <span className="paper__label">INVOICE</span>
            </header>

            <div className="paper__meta">
              <label className="paper__field">
                <span>Bill to</span>
                <div className="paper__select">
                  <UserCircle size={16} />
                  <input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    aria-label="Client name"
                    list="client-datalist"
                    placeholder={
                      availableClients[0] ?? "Enter client name…"
                    }
                  />
                  <CaretDown size={13} />
                  <datalist id="client-datalist">
                    {availableClients.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <small>
                  {availableClients.length === 0
                    ? "New client will be created"
                    : "Start typing to select a client"}
                </small>
              </label>
              <label className="paper__field">
                <span>Invoice #</span>
                <input value={nextInvoiceNumber} readOnly />
              </label>
              <label className="paper__field">
                <span>Due date</span>
                <div className="paper__select">
                  <CalendarBlank size={15} />
                  <input value={dueDate} readOnly />
                </div>
              </label>
            </div>

            {/* Line items */}
            <div className="paper__lines">
              <div className="paper__line paper__line--head">
                <span>Service</span>
                <span>Rate</span>
                <span>Qty</span>
                <span>Amount</span>
                <span />
              </div>
              {items.map((item) => (
                <div className="paper__line" key={item.id}>
                  <input
                    className="paper__line-desc"
                    value={item.description}
                    onChange={(e) =>
                      update(item.id, "description", e.target.value)
                    }
                    aria-label="Service description"
                  />
                  <div className="paper__money">
                    <span>$</span>
                    <input
                      type="number"
                      min={0}
                      value={item.rate}
                      onChange={(e) =>
                        update(item.id, "rate", Number(e.target.value))
                      }
                      aria-label="Rate"
                    />
                  </div>
                  <input
                    className="paper__qty"
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) =>
                      update(item.id, "qty", Number(e.target.value))
                    }
                    aria-label="Quantity"
                  />
                  <b className="paper__line-amount">
                    {fmt.format(item.rate * item.qty)}
                  </b>
                  <button
                    type="button"
                    className="paper__line-remove"
                    onClick={() => removeLine(item.id)}
                    aria-label={`Remove ${item.description}`}
                  >
                    <Trash size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="paper__add-line"
                onClick={addLine}
                id="add-line-btn"
              >
                <Plus size={14} weight="bold" />
                Add line item
              </button>
            </div>

            {/* Footer */}
            <div className="paper__footer">
              <label>
                <span>Notes</span>
                <textarea
                  name="notes"
                  defaultValue="Thank you for working with us. Payment is due within 14 days."
                  aria-label="Invoice notes"
                />
              </label>
              <div className="paper__totals">
                <div className="paper__total-row">
                  <span>Subtotal</span>
                  <span>{fmt.format(subtotal)}</span>
                </div>
                <div className="paper__total-row">
                  <span>
                    Tax <em>8%</em>
                  </span>
                  <span>{fmt.format(tax)}</span>
                </div>
                <div className="paper__total-row paper__total-row--final">
                  <b>Total</b>
                  <b>{fmt.format(total)}</b>
                </div>
              </div>
            </div>
          </section>

          {/* ── Sidebar panel ── */}
          <aside className="editor__panel">
            <section className="editor__card">
              <p className="eyebrow">INVOICE TOTAL</p>
              <strong className="editor__total">{fmt.format(total)}</strong>
              <small>USD · due in 14 days</small>

              <div className="editor__payment-toggle">
                <Sparkle
                  size={28}
                  weight="fill"
                  className="editor__payment-icon"
                />
                <div>
                  <b>Online payments on</b>
                  <p>Your client can pay securely by card.</p>
                </div>
                <button
                  type="button"
                  className="editor__payment-check"
                  onClick={() => onNotify("Online payments are enabled")}
                  aria-label="Toggle online payments"
                >
                  <Check size={13} weight="bold" />
                </button>
              </div>

              <button
                type="submit"
                className="btn btn--send"
                id="send-invoice-btn"
                disabled={pending}
              >
                {pending ? (
                  <span className="auth-submit__spinner" />
                ) : (
                  <>
                    <PaperPlaneTilt size={17} weight="fill" /> Save &amp; send
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn--download"
                onClick={() => window.print()}
                id="download-pdf-btn"
              >
                <DownloadSimple size={17} />
                Download PDF
              </button>
            </section>

            <section className="editor__card editor__share">
              <Copy size={20} className="editor__share-icon" />
              <div>
                <b>Share a secure link</b>
                <p>Anyone with the link can view and pay.</p>
              </div>
              <button
                type="button"
                className="btn btn--copy"
                onClick={handleCopy}
                id="copy-link-btn"
              >
                Copy link
              </button>
            </section>

            <p className="editor__tip">
              <Sparkle size={13} weight="fill" />
              Invoice is saved to your database when you submit.
            </p>
          </aside>
        </div>
      </form>
    </div>
  );
}
