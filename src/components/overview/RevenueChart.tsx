const BARS = [
  { month: "Mar", revenue: 38, expense: 22 },
  { month: "Apr", revenue: 55, expense: 35 },
  { month: "May", revenue: 44, expense: 28 },
  { month: "Jun", revenue: 72, expense: 45 },
  { month: "Jul", revenue: 63, expense: 40 },
  { month: "Aug", revenue: 88, expense: 55 },
];

export function RevenueChart() {
  return (
    <div className="rev-chart" role="img" aria-label="Revenue bar chart — last 6 months">
      {BARS.map((bar) => (
        <div key={bar.month} className="rev-chart__col">
          <div className="rev-chart__bars">
            <i
              className="rev-chart__bar rev-chart__bar--revenue"
              style={{ height: `${bar.revenue}%` }}
              title={`Revenue ${bar.revenue}%`}
            />
            <i
              className="rev-chart__bar rev-chart__bar--expense"
              style={{ height: `${bar.expense}%` }}
              title={`Expense ${bar.expense}%`}
            />
          </div>
          <small className="rev-chart__label">{bar.month}</small>
        </div>
      ))}
    </div>
  );
}
