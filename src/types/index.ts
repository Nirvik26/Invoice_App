import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { users, clients, invoices, lineItems } from "@/lib/schema";

// ── Table row types (SELECT) ───────────────────────────────────────────────
export type User = InferSelectModel<typeof users>;
export type Client = InferSelectModel<typeof clients>;
export type Invoice = InferSelectModel<typeof invoices>;
export type LineItem = InferSelectModel<typeof lineItems>;

// ── Insert types ──────────────────────────────────────────────────────────
export type NewUser = InferInsertModel<typeof users>;
export type NewClient = InferInsertModel<typeof clients>;
export type NewInvoice = InferInsertModel<typeof invoices>;
export type NewLineItem = InferInsertModel<typeof lineItems>;

// ── Composite / view types ────────────────────────────────────────────────

/** Flat invoice row returned from the dashboard query */
export type InvoiceRow = {
  id: string;
  number: string;
  status: "Draft" | "Sent" | "Paid" | "Overdue";
  dueDate: string;
  createdAt: Date;
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientInitials: string;
  clientTone: AvatarTone;
  subtotal: number;
};

/** Full invoice detail with its line items and client contact */
export type InvoiceWithDetails = InvoiceRow & {
  notes?: string | null;
  taxRate: number;
  clientEmail: string;
  items: LineItem[];
};

/** Publicly viewable invoice payload for client portal */
export type PublicInvoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  dueDate: string;
  notes: string | null;
  taxRate: number;
  createdAt: Date;
  issuerName: string;
  issuerEmail: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientInitials: string;
  clientTone: AvatarTone;
  subtotal: number;
  tax: number;
  total: number;
  items: LineItem[];
};

/** Client enriched with project count and lifetime value */
export type ClientRow = Client & {
  projectCount: number;
  lifetimeValue: number;
};

/** Dashboard summary stats */
export type DashboardStats = {
  revenueThisMonth: number;
  revenueGrowth: number;
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  activeClients: number;
};

/** Session payload stored in the JWT */
export type SessionPayload = {
  userId: string;
  expiresAt: Date;
};

/** Navigation views */
export type View = "overview" | "invoices" | "clients" | "editor";

/** Status badge values */
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";

/** Avatar tone values */
export type AvatarTone = "peach" | "blue" | "rose" | "green" | "violet" | "amber";

/** Form action state */
export type FormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;
