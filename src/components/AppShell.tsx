"use client";

import { useState, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { InvoiceTable } from "@/components/invoice/InvoiceTable";
import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";
import { MetricCard } from "@/components/overview/MetricCard";
import { RevenueChart } from "@/components/overview/RevenueChart";
import { ClientCard } from "@/components/clients/ClientCard";
import {
  ArrowUp, CalendarBlank, CaretDown, Clock, FileText,
  MagnifyingGlass, Plus, Sparkle, TrendUp, UsersThree,
} from "@phosphor-icons/react";
import type {
  View, InvoiceStatus, InvoiceRow, ClientRow, DashboardStats, AvatarTone,
} from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const FILTERS: ("All" | InvoiceStatus)[] = ["All", "Draft", "Sent", "Paid", "Overdue"];
const SPARK = [45, 62, 51, 78, 68, 92, 73, 105, 81, 120];

interface AppShellProps {
  user: {
    name: string;
    email: string;
    plan: string;
    initials: string;
    tone: string;
  };
  invoices: InvoiceRow[];
  clients: ClientRow[];
  stats: DashboardStats;
  nextInvoiceNumber: string;
}

export function AppShell({ user, invoices, clients, stats, nextInvoiceNumber }: AppShellProps) {
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | InvoiceStatus>("All");
  const [toast, setToast] = useState("");

  const go = useCallback((next: View) => { setView(next); setQuery(""); }, []);
  const notify = useCallback((msg: string) => setToast(msg), []);

  const filteredInvoices = useMemo(() => {
    const q = query.toLowerCase().trim();
    return invoices.filter(
      (inv) =>
        (!q || [inv.number, inv.clientName, inv.clientCompany].some(
          (v) => v.toLowerCase().includes(q)
        )) &&
        (filter === "All" || inv.status === filter)
    );
  }, [query, filter, invoices]);

  const filteredClients = useMemo(() => {
    const q = query.toLowerCase().trim();
    return clients.filter(
      (c) => !q || [c.name, c.company, c.email].some((v) => v.toLowerCase().includes(q))
    );
  }, [query, clients]);

  const totalClientValue = useMemo(
    () => clients.reduce((sum, c) => sum + c.lifetimeValue, 0),
    [clients]
  );
  const avgProject = useMemo(
    () => (clients.length > 0 ? totalClientValue / clients.length : 0),
    [clients, totalClientValue]
  );

  const isEditor = view === "editor";

  return (
    <div className="app">
      <Sidebar
        activeView={view}
        onNavigate={go}
        onNotify={notify}
        user={user}
      />

      <div className="app__workspace">
        <Topbar
          view={view}
          query={query}
          onQueryChange={setQuery}
          onNavigate={go}
          onNewInvoice={() => go("editor")}
          onNotify={notify}
        />

        <main className="app__main" id="main-content">
          {!isEditor && (
            <div className="page">
              {/* ── Page heading ── */}
              <div className="page__heading">
                <div>
                  <p className="eyebrow">WORKSPACE / {view.toUpperCase()}</p>
                  <h1>
                    {view === "overview"
                      ? "Overview"
                      : view === "invoices"
                      ? "Invoices"
                      : "Clients"}
                  </h1>
                  <p className="page__sub">
                    {view === "overview"
                      ? `Good morning, ${user.name.split(" ")[0]}. Here's how your business is moving.`
                      : view === "invoices"
                      ? "Track every invoice from draft to paid."
                      : "Keep your best relationships and revenue in view."}
                  </p>
                </div>
                <button className="period-pill">
                  <CalendarBlank size={15} />
                  {new Date().toLocaleString("en-US", { month: "short" })}{" "}
                  2026
                  <CaretDown size={12} />
                </button>
              </div>

              {/* ═══════════════════ OVERVIEW ═══════════════════ */}
              {view === "overview" && (
                <>
                  <div className="metrics">
                    {/* Hero revenue card */}
                    <article className="metric-card metric-card--hero">
                      <div className="metric-card__hero-top">
                        <div>
                          <small>Revenue this month</small>
                          <b className="metric-card__trend">
                            <ArrowUp size={11} weight="bold" />{" "}
                            {stats.revenueGrowth}%
                          </b>
                        </div>
                        <strong className="metric-card__hero-value">
                          {fmt.format(stats.revenueThisMonth)}
                        </strong>
                      </div>
                      <div className="spark">
                        {SPARK.map((h, i) => (
                          <i
                            key={i}
                            className={`spark__bar${i > 7 ? " spark__bar--hot" : ""}`}
                            style={{ height: h }}
                          />
                        ))}
                      </div>
                      <p className="metric-card__hero-sub">
                        <Sparkle size={13} weight="fill" />{" "}
                        {stats.revenueThisMonth > 0
                          ? "You're on track for your best month yet."
                          : "Send your first invoice to start earning."}
                      </p>
                    </article>

                    <MetricCard
                      label="Outstanding"
                      value={fmt.format(stats.outstanding)}
                      sub={
                        <>
                          <b>{stats.outstandingCount} invoice{stats.outstandingCount !== 1 ? "s" : ""}</b>{" "}
                          waiting for payment
                        </>
                      }
                      icon={<TrendUp size={19} />}
                    />
                    <MetricCard
                      label="Overdue"
                      value={fmt.format(stats.overdue)}
                      sub={
                        <>
                          <b>{stats.overdueCount} invoice{stats.overdueCount !== 1 ? "s" : ""}</b>{" "}
                          need{stats.overdueCount === 1 ? "s" : ""} attention
                        </>
                      }
                      icon={<Clock size={19} />}
                      variant="warning"
                    />
                    <MetricCard
                      label="Active clients"
                      value={String(stats.activeClients)}
                      sub={<>All time</>}
                      icon={<UsersThree size={19} />}
                    />
                  </div>

                  {/* Charts + quick action */}
                  <div className="overview-grid">
                    <article className="card card--chart">
                      <div className="card__header">
                        <p className="eyebrow">CASH FLOW</p>
                        <h2>Revenue pulse</h2>
                      </div>
                      <RevenueChart />
                    </article>

                    <article className="card card--quick">
                      <div className="card__header">
                        <p className="eyebrow">SHORTCUT</p>
                        <h2>Get paid, faster</h2>
                      </div>
                      <p>Turn finished work into revenue while it&apos;s still fresh.</p>
                      <button
                        className="quick-action"
                        onClick={() => go("editor")}
                        id="quick-create-btn"
                      >
                        <span className="quick-action__icon">
                          <FileText size={20} />
                        </span>
                        <div>
                          <b>Create an invoice</b>
                          <small>Next: {nextInvoiceNumber}</small>
                        </div>
                        <ArrowUp className="quick-action__arrow" />
                      </button>

                      {invoices.length > 0 && (
                        <div className="on-time-rate">
                          <div className="on-time-rate__top">
                            <span>On-time payment rate</span>
                            <b>
                              {invoices.length === 0
                                ? "—"
                                : Math.round(
                                    (invoices.filter((i) => i.status === "Paid").length /
                                      invoices.length) *
                                      100
                                  ) + "%"}
                            </b>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-bar__fill"
                              style={{
                                width: `${
                                  invoices.length === 0
                                    ? 0
                                    : Math.round(
                                        (invoices.filter((i) => i.status === "Paid").length /
                                          invoices.length) *
                                          100
                                      )
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </article>
                  </div>

                  {/* Recent invoices */}
                  <article className="card card--recent">
                    <div className="card__header">
                      <div>
                        <p className="eyebrow">RECENT ACTIVITY</p>
                        <h2>Latest invoices</h2>
                      </div>
                      <button
                        className="card__view-all"
                        onClick={() => go("invoices")}
                      >
                        View all{" "}
                        <ArrowUp style={{ transform: "rotate(45deg)" }} size={13} />
                      </button>
                    </div>
                    {invoices.length === 0 ? (
                      <EmptyInvoices onCreate={() => go("editor")} />
                    ) : (
                      <InvoiceTable rows={invoices.slice(0, 5)} />
                    )}
                  </article>
                </>
              )}

              {/* ═══════════════════ INVOICES ═══════════════════ */}
              {view === "invoices" && (
                <article className="card">
                  <div
                    className="inv-filters"
                    role="tablist"
                    aria-label="Invoice status filter"
                  >
                    {FILTERS.map((f) => (
                      <button
                        key={f}
                        role="tab"
                        aria-selected={filter === f}
                        className={`inv-filter${filter === f ? " inv-filter--active" : ""}`}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                        <span className="inv-filter__count">
                          {f === "All"
                            ? invoices.length
                            : invoices.filter((i) => i.status === f).length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {filteredInvoices.length === 0 ? (
                    query ? (
                      <div className="empty-state">
                        <MagnifyingGlass size={28} />
                        <h3>No results for &ldquo;{query}&rdquo;</h3>
                        <p>Try a different search term.</p>
                      </div>
                    ) : (
                      <EmptyInvoices onCreate={() => go("editor")} />
                    )
                  ) : (
                    <InvoiceTable rows={filteredInvoices} />
                  )}
                </article>
              )}

              {/* ═══════════════════ CLIENTS ═══════════════════ */}
              {view === "clients" && (
                <>
                  <div className="client-stats">
                    <article className="card client-stats__card">
                      <span>Total client value</span>
                      <strong>{fmt.format(totalClientValue)}</strong>
                      <small>Across {clients.length} client{clients.length !== 1 ? "s" : ""}</small>
                    </article>
                    <article className="card client-stats__card">
                      <span>Average project</span>
                      <strong>{fmt.format(avgProject)}</strong>
                      <small>Per client lifetime</small>
                    </article>
                    <button
                      className="btn btn--primary client-stats__add"
                      onClick={() => notify("Client creation coming soon")}
                      id="add-client-btn"
                    >
                      <Plus size={15} weight="bold" /> Add new client
                    </button>
                  </div>

                  {filteredClients.length === 0 ? (
                    <div className="empty-state">
                      <UsersThree size={28} />
                      <h3>No clients yet</h3>
                      <p>Create your first invoice to add a client automatically.</p>
                      <button
                        className="btn btn--primary"
                        onClick={() => go("editor")}
                      >
                        <Plus size={15} weight="bold" /> New invoice
                      </button>
                    </div>
                  ) : (
                    <div className="client-grid">
                      {filteredClients.map((c) => (
                        <ClientCard
                          key={c.id}
                          name={c.name}
                          company={c.company}
                          email={c.email}
                          initials={c.initials}
                          tone={c.tone as AvatarTone}
                          projectCount={c.projectCount}
                          lifetimeValue={c.lifetimeValue}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {isEditor && (
            <div className="page">
              <InvoiceEditor
                availableClients={clients.map((c) => c.name)}
                nextInvoiceNumber={nextInvoiceNumber}
                onNotify={notify}
              />
            </div>
          )}
        </main>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </div>
  );
}

function EmptyInvoices({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <FileText size={28} />
      <h3>No invoices yet</h3>
      <p>Create your first invoice and start getting paid.</p>
      <button className="btn btn--primary" onClick={onCreate}>
        <Plus size={15} weight="bold" /> New invoice
      </button>
    </div>
  );
}
