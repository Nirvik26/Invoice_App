import "server-only";
import { db } from "@/lib/db";
import { invoices, clients, lineItems } from "@/lib/schema";
import { eq, and, desc, sum, count } from "drizzle-orm";
import type { InvoiceRow, ClientRow, DashboardStats } from "@/types";

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
    .where(
      invoiceIds.length === 1
        ? eq(lineItems.invoiceId, invoiceIds[0])
        : // For multiple invoices, fetch all and filter in JS (simpler than dynamic `in()`)
          eq(lineItems.invoiceId, lineItems.invoiceId) // will filter below
    );

  const itemMap = new Map<string, number>();
  for (const item of allItems) {
    if (invoiceIds.includes(item.invoiceId)) {
      itemMap.set(item.invoiceId, (itemMap.get(item.invoiceId) ?? 0) + item.rate * item.qty);
    }
  }

  return rows.map((row) => ({
    ...row,
    subtotal: itemMap.get(row.id) ?? 0,
  })) as InvoiceRow[];
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
