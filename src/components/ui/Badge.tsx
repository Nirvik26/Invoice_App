import type { InvoiceStatus } from "@/types";

const STATUS_CONFIG: Record<InvoiceStatus, { dot: string; label: string }> = {
  Paid: { dot: "#22c55e", label: "Paid" },
  Sent: { dot: "#3b82f6", label: "Sent" },
  Overdue: { dot: "#ef4444", label: "Overdue" },
  Draft: { dot: "#9ca3af", label: "Draft" },
};

export function Badge({ status }: { status: InvoiceStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      <i style={{ background: config.dot }} />
      {config.label}
    </span>
  );
}
