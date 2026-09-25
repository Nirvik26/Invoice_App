import "server-only";
import { db } from "@/lib/db";
import { invoices, clients, lineItems, users } from "@/lib/schema";
import { eq, and, desc, asc, count, inArray } from "drizzle-orm";
import type { InvoiceRow, InvoiceWithDetails, PublicInvoice, ClientRow, DashboardStats, AvatarTone } from "@/types";

// ── Invoices ───────────────────────────────────────────────────────────────
export async function getInvoicesForUser(userId: string): Promise<InvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      clientId: invoices.clientId,
      clientName: clients.name,
      clientCompany: clients.company,
      clientInitials: clients.initials,
      clientTone: clients.tone,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt));

  if (rows.length === 0) return [];

  const invoiceIds = rows.map((r) => r.id);
  const allItems = await db
    .select({ invoiceId: lineItems.invoiceId, rate: lineItems.rate, qty: lineItems.qty })
    .from(lineItems)
    .where(inArray(lineItems.invoiceId, invoiceIds));

  const itemMap = new Map<string, number>();
  for (const item of allItems) {
    itemMap.set(item.invoiceId, (itemMap.get(item.invoiceId) ?? 0) + item.rate * item.qty);
  }

  return rows.map((row) => ({
    ...row,
    clientTone: row.clientTone as AvatarTone,
    subtotal: itemMap.get(row.id) ?? 0,
  }));
}

export async function getInvoiceDetails(
  invoiceId: string,
  userId: string
): Promise<InvoiceWithDetails | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      taxRate: invoices.taxRate,
      createdAt: invoices.createdAt,
      clientId: invoices.clientId,
      clientName: clients.name,
      clientCompany: clients.company,
      clientEmail: clients.email,
      clientInitials: clients.initials,
      clientTone: clients.tone,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.invoiceId, invoiceId))
    .orderBy(asc(lineItems.sortOrder));

  const subtotal = items.reduce((sum, item) => sum + item.rate * item.qty, 0);

  return {
    ...row,
    clientTone: row.clientTone as AvatarTone,
    subtotal,
    items,
  };
}

export async function getPublicInvoiceByNumber(
  number: string
): Promise<PublicInvoice | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      taxRate: invoices.taxRate,
      createdAt: invoices.createdAt,
      issuerName: users.name,
      issuerEmail: users.email,
      clientName: clients.name,
      clientCompany: clients.company,
      clientEmail: clients.email,
      clientInitials: clients.initials,
      clientTone: clients.tone,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(users, eq(invoices.userId, users.id))
    .where(eq(invoices.number, number))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.invoiceId, row.id))
    .orderBy(asc(lineItems.sortOrder));

  const subtotal = items.reduce((sum, item) => sum + item.rate * item.qty, 0);
  const tax = subtotal * (row.taxRate / 100);
  const total = subtotal + tax;

  return {
    ...row,
    clientTone: row.clientTone as AvatarTone,
    subtotal,
    tax,
    total,
    items,
  };
}

// ── Clients ────────────────────────────────────────────────────────────────
export async function getClientsForUser(userId: string): Promise<ClientRow[]> {
  const rows = await db
    .select({
      id: clients.id,
      userId: clients.userId,
      name: clients.name,
      company: clients.company,
      email: clients.email,
      initials: clients.initials,
      tone: clients.tone,
      createdAt: clients.createdAt,
      projectCount: count(invoices.id),
    })
    .from(clients)
    .leftJoin(invoices, eq(clients.id, invoices.clientId))
    .where(eq(clients.userId, userId))
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt));

  if (rows.length === 0) return rows.map((r) => ({ ...r, lifetimeValue: 0 }));

  const clientIds = rows.map((r) => r.id);
  const allItems = await db
    .select({
      clientId: invoices.clientId,
      rate: lineItems.rate,
      qty: lineItems.qty,
    })
    .from(lineItems)
    .innerJoin(invoices, eq(lineItems.invoiceId, invoices.id))
    .where(eq(invoices.userId, userId));

  const valueMap = new Map<string, number>();
  for (const item of allItems) {
    if (clientIds.includes(item.clientId)) {
      valueMap.set(item.clientId, (valueMap.get(item.clientId) ?? 0) + item.rate * item.qty);
    }
  }

  return rows.map((row) => ({
    ...row,
    lifetimeValue: valueMap.get(row.id) ?? 0,
  }));
}

// ── Dashboard stats ────────────────────────────────────────────────────────
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // All invoices for the user with their line item totals
  const inv = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.userId, userId));

  const allItems = await db
    .select({ invoiceId: lineItems.invoiceId, rate: lineItems.rate, qty: lineItems.qty })
    .from(lineItems)
    .innerJoin(invoices, eq(lineItems.invoiceId, invoices.id))
    .where(eq(invoices.userId, userId));

  const totalMap = new Map<string, number>();
  for (const item of allItems) {
    totalMap.set(item.invoiceId, (totalMap.get(item.invoiceId) ?? 0) + item.rate * item.qty);
  }

  let revenueThisMonth = 0;
  let outstanding = 0;
  let outstandingCount = 0;
  let overdue = 0;
  let overdueCount = 0;

  for (const invoice of inv) {
    const amount = totalMap.get(invoice.id) ?? 0;

    if (invoice.status === "Paid") {
      const invDate = invoice.createdAt.toISOString().slice(0, 10);
      if (invDate >= startOfMonth) revenueThisMonth += amount;
    }
    if (invoice.status === "Sent") {
      outstanding += amount;
      outstandingCount++;
    }
    if (invoice.status === "Overdue") {
      overdue += amount;
      overdueCount++;
    }
  }

  const [{ activeClients }] = await db
    .select({ activeClients: count(clients.id) })
    .from(clients)
    .where(eq(clients.userId, userId));

  return {
    revenueThisMonth,
    revenueGrowth: 18.4, // Would need historical data in production
    outstanding,
    outstandingCount,
    overdue,
    overdueCount,
    activeClients: Number(activeClients),
  };
}

// ── Next invoice number ────────────────────────────────────────────────────
export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const [latest] = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  if (!latest) return "INV-1001";

  const match = latest.number.match(/INV-(\d+)/);
  if (!match) return "INV-1001";

  return `INV-${Number(match[1]) + 1}`;
}
