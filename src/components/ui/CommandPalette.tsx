"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MagnifyingGlass,
  Receipt,
  UsersThree,
  GridFour,
  Plus,
  CheckCircle,
  Clock,
  ArrowRight,
  FileText,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { View, InvoiceRow, ClientRow, InvoiceStatus, AvatarTone } from "@/types";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRow[];
  clients: ClientRow[];
  onNavigate: (view: View) => void;
  onSelectInvoice: (inv: InvoiceRow) => void;
  onOpenNewInvoice: () => void;
  onOpenNewClient: () => void;
  onFilterInvoices: (filter: "All" | InvoiceStatus) => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Actions" | "Invoices" | "Clients";
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  invoices,
  clients,
  onNavigate,
  onSelectInvoice,
  onOpenNewInvoice,
  onOpenNewClient,
  onFilterInvoices,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle global Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items
  const items = useMemo(() => {
    const list: CommandItem[] = [];
    const q = query.toLowerCase().trim();

    // ── Navigation ──
    const navItems: CommandItem[] = [
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Go to Overview",
        subtitle: "Dashboard metrics & pulse",
        icon: <GridFour size={18} />,
        onSelect: () => {
          onNavigate("overview");
          onClose();
        },
      },
      {
        id: "nav-invoices",
        category: "Navigation",
        title: "Go to Invoices",
        subtitle: "View and manage all billing records",
        icon: <Receipt size={18} />,
        onSelect: () => {
          onNavigate("invoices");
          onClose();
        },
      },
      {
        id: "nav-clients",
        category: "Navigation",
        title: "Go to Clients",
        subtitle: "Directory and client lifetime revenue",
        icon: <UsersThree size={18} />,
        onSelect: () => {
          onNavigate("clients");
          onClose();
        },
      },
    ];

    // ── Actions ──
    const actionItems: CommandItem[] = [
      {
        id: "act-new-invoice",
        category: "Actions",
        title: "Create New Invoice",
        subtitle: "Open invoice drafting canvas",
        icon: <Plus size={18} weight="bold" />,
        onSelect: () => {
          onOpenNewInvoice();
          onClose();
        },
      },
      {
        id: "act-new-client",
        category: "Actions",
        title: "Add New Client",
        subtitle: "Register client profile & billing info",
        icon: <Plus size={18} weight="bold" />,
        onSelect: () => {
          onOpenNewClient();
          onClose();
        },
      },
      {
        id: "filter-paid",
        category: "Actions",
        title: "Filter by Paid Invoices",
        subtitle: "Show only completed payments",
        icon: <CheckCircle size={18} />,
        onSelect: () => {
          onNavigate("invoices");
          onFilterInvoices("Paid");
          onClose();
        },
      },
      {
        id: "filter-overdue",
        category: "Actions",
        title: "Filter by Overdue Invoices",
        subtitle: "Invoices needing urgent follow-up",
        icon: <Clock size={18} />,
        onSelect: () => {
          onNavigate("invoices");
          onFilterInvoices("Overdue");
          onClose();
        },
      },
    ];

    // Append matching navigation & action items
    for (const item of [...navItems, ...actionItems]) {
      if (!q || item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)) {
        list.push(item);
      }
    }

    // ── Invoices ──
    const matchingInvoices = invoices.filter(
      (inv) =>
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientCompany.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q) ||
        String(inv.subtotal).includes(q)
    );

    for (const inv of matchingInvoices.slice(0, 6)) {
      list.push({
        id: `inv-${inv.id}`,
        category: "Invoices",
        title: `${inv.number} · ${inv.clientName}`,
        subtitle: `${inv.clientCompany} — ${fmt.format(inv.subtotal)}`,
        icon: <FileText size={18} />,
        badge: <Badge status={inv.status} />,
        onSelect: () => {
          onSelectInvoice(inv);
          onClose();
        },
      });
    }

    // ── Clients ──
    const matchingClients = clients.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );

    for (const c of matchingClients.slice(0, 5)) {
      list.push({
        id: `client-${c.id}`,
        category: "Clients",
        title: c.name,
        subtitle: `${c.company} · ${c.email}`,
        icon: <Avatar initials={c.initials} tone={c.tone as AvatarTone} size="sm" />,
        onSelect: () => {
          onNavigate("clients");
          onClose();
        },
      });
    }

    return list;
  }, [query, invoices, clients, onNavigate, onClose, onOpenNewInvoice, onOpenNewClient, onFilterInvoices, onSelectInvoice]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[selectedIndex]?.onSelect();
      }
    },
    [items, selectedIndex]
  );

  if (!isOpen) return null;

  return (
    <div
      className="cmd-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmd-modal">
        {/* Search Input Bar */}
        <div className="cmd-input-wrap">
          <MagnifyingGlass size={20} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search invoices, clients…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmd-esc-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="cmd-list" role="listbox">
          {items.length === 0 ? (
            <div className="cmd-empty">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <small>Try searching by invoice #, client name, or navigation commands.</small>
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isFirstOfCategory = idx === 0 || items[idx - 1].category !== item.category;

              return (
                <div key={item.id}>
                  {isFirstOfCategory && (
                    <div className="cmd-category-header">{item.category}</div>
                  )}
                  <div
                    role="option"
                    aria-selected={isSelected}
                    className={`cmd-item${isSelected ? " cmd-item--active" : ""}`}
                    onClick={item.onSelect}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="cmd-item__icon">{item.icon}</span>
                    <div className="cmd-item__content">
                      <span className="cmd-item__title">{item.title}</span>
                      {item.subtitle && (
                        <span className="cmd-item__subtitle">{item.subtitle}</span>
                      )}
                    </div>
                    {item.badge && <span className="cmd-item__badge">{item.badge}</span>}
                    {isSelected && (
                      <ArrowRight size={14} className="cmd-item__arrow" weight="bold" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <footer className="cmd-footer">
          <div className="cmd-shortcut">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="cmd-shortcut">
            <kbd>↵</kbd>
            <span>Select</span>
          </div>
          <div className="cmd-shortcut">
            <kbd>esc</kbd>
            <span>Close</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
