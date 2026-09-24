"use client";

import { ArrowLeft, Bell, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { View } from "@/types";

interface TopbarProps {
  view: View;
  query: string;
  onQueryChange: (v: string) => void;
  onNavigate: (view: View) => void;
  onNewInvoice: () => void;
  onNotify: (msg: string) => void;
}

export function Topbar({
  view,
  query,
  onQueryChange,
  onNavigate,
  onNewInvoice,
  onNotify,
}: TopbarProps) {
  const isEditor = view === "editor";
  const placeholder = view === "clients" ? "Search clients…" : "Search invoices…";

  return (
    <header className="topbar" role="banner">
      {/* Mobile brand mark */}
      <div className="topbar__mobile-brand" aria-hidden="true">
        <span className="sidebar__logo">B</span>
        <b>Billora</b>
      </div>

      {/* Left: back button or search */}
      {isEditor ? (
        <button className="topbar__back" onClick={() => onNavigate("invoices")}>
          <ArrowLeft size={16} weight="bold" />
          <span>Invoices</span>
        </button>
      ) : (
        <label className="topbar__search" htmlFor="topbar-search">
          <MagnifyingGlass size={16} className="topbar__search-icon" />
          <input
            id="topbar-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
          <kbd>⌘ K</kbd>
        </label>
      )}

      {/* Right: actions */}
      <div className="topbar__actions">
        <button
          className="topbar__bell"
          onClick={() => onNotify("You're all caught up")}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <i className="topbar__bell-dot" aria-hidden="true" />
        </button>

        {!isEditor && (
          <button className="btn btn--primary" onClick={onNewInvoice} id="new-invoice-btn">
            <Plus size={16} weight="bold" />
            New invoice
          </button>
        )}
      </div>
    </header>
  );
}
