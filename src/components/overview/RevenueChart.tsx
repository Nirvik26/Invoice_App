"use client";

import { useMemo, useState } from "react";
import type { InvoiceRow } from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface RevenueChartProps {
  invoices?: InvoiceRow[];
}

interface MonthData {
  month: string;
  year: number;
  paid: number;
  pending: number;
  total: number;
  paidPct: number;
  pendingPct: number;
}

export function RevenueChart({ invoices = [] }: RevenueChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<MonthData | null>(null);

  const monthsData = useMemo(() => {
    const list: MonthData[] = [];
    const now = new Date();

    // Generate last 6 months in chronological order
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      const monthIdx = d.getMonth();

      let paid = 0;
      let pending = 0;

      for (const inv of invoices) {
        const invDate = new Date(inv.createdAt);
        if (invDate.getFullYear() === year && invDate.getMonth() === monthIdx) {
          if (inv.status === "Paid") {
            paid += inv.subtotal;
          } else {
            pending += inv.subtotal;
          }
        }
      }

      list.push({
        month: monthStr,
        year,
        paid,
        pending,
        total: paid + pending,
        paidPct: 0,
        pendingPct: 0,
      });
    }

    // Default sample curve if workspace has no historical invoices yet
    const hasData = list.some((m) => m.total > 0);
    if (!hasData) {
      const sample = [
        { month: "Apr", paid: 3800, pending: 1200 },
        { month: "May", paid: 5500, pending: 1800 },
        { month: "Jun", paid: 4400, pending: 2200 },
        { month: "Jul", paid: 7200, pending: 1500 },
        { month: "Aug", paid: 6300, pending: 3100 },
        { month: "Sep", paid: 8800, pending: 2400 },
      ];
      return sample.map((s) => ({
        month: s.month,
        year: 2026,
        paid: s.paid,
        pending: s.pending,
        total: s.paid + s.pending,
        paidPct: Math.round((s.paid / 11200) * 100),
        pendingPct: Math.round((s.pending / 11200) * 100),
      }));
    }

    const maxVal = Math.max(...list.map((m) => m.total), 1000);

    return list.map((m) => ({
      ...m,
      paidPct: Math.max(Math.round((m.paid / maxVal) * 88), m.paid > 0 ? 8 : 0),
      pendingPct: Math.max(Math.round((m.pending / maxVal) * 88), m.pending > 0 ? 6 : 0),
    }));
  }, [invoices]);

  return (
    <div className="rev-chart-wrap">
      {/* Tooltip Overlay */}
      <div className={`rev-chart-tooltip${hoveredMonth ? " rev-chart-tooltip--visible" : ""}`}>
        {hoveredMonth ? (
          <>
            <strong>{hoveredMonth.month} {hoveredMonth.year}</strong>
            <div className="rev-chart-tooltip__breakdown">
              <span className="rev-chart-tooltip__paid">
                Paid: <b>{fmt.format(hoveredMonth.paid)}</b>
              </span>
              <span className="rev-chart-tooltip__pending">
                Pending: <b>{fmt.format(hoveredMonth.pending)}</b>
              </span>
            </div>
          </>
        ) : (
          <span className="rev-chart-tooltip__hint">Hover over a month for breakdown</span>
        )}
      </div>

      <div className="rev-chart" role="img" aria-label="Revenue bar chart — last 6 months">
        {monthsData.map((bar) => (
          <div
            key={`${bar.month}-${bar.year}`}
            className="rev-chart__col"
            onMouseEnter={() => setHoveredMonth(bar)}
            onMouseLeave={() => setHoveredMonth(null)}
          >
            <div className="rev-chart__bars">
              <i
                className="rev-chart__bar rev-chart__bar--revenue"
                style={{ height: `${bar.paidPct}%` }}
                title={`Paid: ${fmt.format(bar.paid)}`}
              />
              <i
                className="rev-chart__bar rev-chart__bar--expense"
                style={{ height: `${bar.pendingPct}%` }}
                title={`Pending: ${fmt.format(bar.pending)}`}
              />
            </div>
            <small className="rev-chart__label">{bar.month}</small>
          </div>
        ))}
      </div>

      <div className="rev-chart-legend">
        <span className="rev-chart-legend__item">
          <i className="rev-chart-legend__dot rev-chart-legend__dot--revenue" />
          Paid Revenue
        </span>
        <span className="rev-chart-legend__item">
          <i className="rev-chart-legend__dot rev-chart-legend__dot--pending" />
          Pending / Invoiced
        </span>
      </div>
    </div>
  );
}
