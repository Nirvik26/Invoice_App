import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  sub: ReactNode;
  icon: ReactNode;
  variant?: "default" | "accent" | "warning";
}

export function MetricCard({ label, value, sub, icon, variant = "default" }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${variant}`}>
      <div className="metric-card__icon">{icon}</div>
      <small className="metric-card__label">{label}</small>
      <strong className="metric-card__value">{value}</strong>
      <p className="metric-card__sub">{sub}</p>
    </article>
  );
}
