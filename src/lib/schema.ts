import {
  pgTable, text, integer, timestamp, uuid, pgEnum, boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────────
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "Draft",
  "Sent",
  "Paid",
  "Overdue",
]);

export const avatarToneEnum = pgEnum("avatar_tone", [
  "peach",
  "blue",
  "rose",
  "green",
  "violet",
  "amber",
]);

// ── Users ──────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").notNull().default("Starter"),
  initials: text("initials").notNull(),
  tone: avatarToneEnum("tone").notNull().default("blue"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Clients ────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull(),
  initials: text("initials").notNull(),
  tone: avatarToneEnum("tone").notNull().default("blue"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Invoices ───────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  number: text("number").notNull(),              // e.g. "INV-1039"
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  status: invoiceStatusEnum("status").notNull().default("Draft"),
  dueDate: text("due_date").notNull(),           // ISO date string
  notes: text("notes").default(
    "Thank you for working with us. Payment is due within 14 days."
  ),
  taxRate: integer("tax_rate").notNull().default(8),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Line Items ─────────────────────────────────────────────────────────────
export const lineItems = pgTable("line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  rate: integer("rate").notNull().default(0),
  qty: integer("qty").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Relations ──────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  invoices: many(invoices),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  lineItems: many(lineItems),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [lineItems.invoiceId], references: [invoices.id] }),
}));
