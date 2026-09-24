"use client";

import {
  ChartLineUp, GearSix, GridFour, Question, Receipt,
  UsersThree, CaretDown, SignOut,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { signOutAction } from "@/actions/auth";
import type { View, AvatarTone } from "@/types";

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onNotify: (msg: string) => void;
  user: {
    name: string;
    plan: string;
    initials: string;
    tone: string;
  };
}

const NAV_ITEMS = [
  { view: "overview" as View, icon: GridFour, label: "Overview" },
  { view: "invoices" as View, icon: Receipt, label: "Invoices" },
  { view: "clients" as View, icon: UsersThree, label: "Clients" },
];

export function Sidebar({ activeView, onNavigate, onNotify, user }: SidebarProps) {
  const isInvoiceActive = activeView === "invoices" || activeView === "editor";

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand */}
      <button
        className="sidebar__brand"
        onClick={() => onNavigate("overview")}
        aria-label="Billora home"
      >
        <span className="sidebar__logo" aria-hidden="true">B</span>
        <span className="sidebar__wordmark">Billora</span>
      </button>

      {/* Primary nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const active = view === "invoices" ? isInvoiceActive : activeView === view;
          return (
            <button
              key={view}
              className={`sidebar__link${active ? " sidebar__link--active" : ""}`}
              onClick={() => onNavigate(view)}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          className="sidebar__link"
          onClick={() => onNotify("Reports coming in your next release")}
        >
          <ChartLineUp size={18} />
          <span>Reports</span>
        </button>
      </nav>

      {/* Bottom section */}
      <div className="sidebar__footer">
        <button
          className="sidebar__link"
          onClick={() => onNotify("Help center opened")}
        >
          <Question size={18} />
          <span>Help</span>
        </button>
        <button
          className="sidebar__link"
          onClick={() => onNotify("Settings opened")}
        >
          <GearSix size={18} />
          <span>Settings</span>
        </button>

        {/* Account */}
        <div className="sidebar__account">
          <Avatar initials={user.initials} tone={user.tone as AvatarTone} size="sm" />
          <div className="sidebar__account-info">
            <strong title={user.name}>{user.name}</strong>
            <span>{user.plan} plan</span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="sidebar__signout"
              title="Sign out"
              aria-label="Sign out"
            >
              <SignOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
