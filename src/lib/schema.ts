import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
  publicToken: uuid("public_token").notNull().defaultRandom().unique(),
  paymentPlan: jsonb("payment_plan")
    .$type<{ label: string; percent: number }[]>()
    .notNull()
    .default([{ label: "Full payment", percent: 100 }]),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  number: text("number").notNull(), // e.g. "INV-1039"
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  status: invoiceStatusEnum("status").notNull().default("Draft"),
  dueDate: text("due_date").notNull(), // ISO date string
  notes: text("notes").default(
    "Thank you for working with us. Payment is due within 14 days.",
  ),
  taxRate: integer("tax_rate").notNull().default(8),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    sessionId: text("session_id").unique(),
    amountCents: integer("amount_cents").notNull(),
    label: text("label").notNull(),
    status: text("status")
      .$type<"pending" | "paid" | "expired" | "failed">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (table) => [
    index("payments_invoice_idx").on(table.invoiceId),
    uniqueIndex("payments_one_pending")
      .on(table.invoiceId)
      .where(sql`${table.status} = 'pending'`),
    check("payments_amount_positive", sql`${table.amountCents} > 0`),
    check(
      "payments_status_valid",
      sql`${table.status} in ('pending', 'paid', 'expired', 'failed')`,
    ),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicToken: uuid("public_token").notNull().defaultRandom().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    title: text("title").notNull(),
    status: text("status")
      .$type<"Draft" | "Sent" | "Changes requested" | "Accepted">()
      .notNull()
      .default("Draft"),
    version: integer("version").notNull().default(1),
    content: jsonb("content")
      .$type<import("./billing").ProposalContent>()
      .notNull(),
    invoiceId: uuid("invoice_id")
      .unique()
      .references(() => invoices.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("proposals_user_idx").on(table.userId),
    check(
      "proposals_status_valid",
      sql`${table.status} in ('Draft', 'Sent', 'Changes requested', 'Accepted')`,
    ),
  ],
);

export const proposalEvents = pgTable(
  "proposal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    actor: text("actor").notNull(),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    snapshot: jsonb("snapshot").$type<import("./billing").ProposalContent>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("proposal_events_proposal_idx").on(table.proposalId)],
);

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
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  lineItems: many(lineItems),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [lineItems.invoiceId],
    references: [invoices.id],
  }),
}));
