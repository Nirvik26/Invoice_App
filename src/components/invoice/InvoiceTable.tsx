import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { AvatarTone, InvoiceRow } from "@/types";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface InvoiceTableProps {
  rows: InvoiceRow[];
  onSelectInvoice?: (inv: InvoiceRow) => void;
}

export function InvoiceTable({ rows, onSelectInvoice }: InvoiceTableProps) {
  return (
    <div className="inv-table" role="table" aria-label="Invoice list">
      {/* Header */}
      <div className="inv-table__head inv-table__row" role="row">
        <span role="columnheader">Client</span>
        <span role="columnheader">Invoice</span>
        <span role="columnheader">Due</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" style={{ textAlign: "right" }}>Amount</span>
      </div>

      {/* Rows */}
      {rows.map((inv) => {
        const due = new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <div
            key={inv.id}
            className={`inv-table__row inv-table__row--data${onSelectInvoice ? " inv-table__row--interactive" : ""}`}
            role="row"
            tabIndex={0}
            onClick={() => onSelectInvoice?.(inv)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectInvoice?.(inv);
              }
            }}
          >
            <span className="inv-table__client" role="cell">
              <Avatar
                initials={inv.clientInitials}
                tone={inv.clientTone as AvatarTone}
                size="sm"
              />
              <span>
                <b>{inv.clientName}</b>
                <small>{inv.clientCompany}</small>
              </span>
            </span>
            <span className="inv-table__mono" role="cell">{inv.number}</span>
            <span role="cell">{due}</span>
            <span role="cell"><Badge status={inv.status} /></span>
            <strong role="cell" style={{ textAlign: "right" }}>{fmt.format(inv.subtotal)}</strong>
          </div>
        );
      })}
    </div>
  );
}
