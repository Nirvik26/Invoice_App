import "server-only";
import { db } from "@/lib/db";
import { invoices, clients, lineItems, users, payments } from "@/lib/schema";
import { totalCents, tokenSchema, summarizeInvoices } from "./billing";
import { eq, and, desc, asc, count, inArray, sql } from "drizzle-orm";
import type {
  InvoiceRow,
  InvoiceWithDetails,
  PublicInvoice,
  ClientRow,
  DashboardStats,
  AvatarTone,
} from "@/types";

// ── Invoices ───────────────────────────────────────────────────────────────
export async function getInvoicesForUser(
  userId: string,
): Promise<InvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      publicToken: invoices.publicToken,
      taxRate: invoices.taxRate,
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
    .select({
      invoiceId: lineItems.invoiceId,
      rate: lineItems.rate,
      qty: lineItems.qty,
    })
    .from(lineItems)
    .where(inArray(lineItems.invoiceId, invoiceIds));

  const itemMap = new Map<string, number>();
  for (const item of allItems) {
    itemMap.set(
      item.invoiceId,
      (itemMap.get(item.invoiceId) ?? 0) + item.rate * item.qty,
    );
  }

  const history = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      label: payments.label,
      amountCents: payments.amountCents,
      status: payments.status,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .where(inArray(payments.invoiceId, invoiceIds));
  return rows.map((row) => {
    const total = totalCents(
      [{ rate: itemMap.get(row.id) ?? 0, qty: 1 }],
      row.taxRate,
    );
    const paymentHistory = history.filter((p) => p.invoiceId === row.id);
    const paid =
      row.status === "Paid"
        ? total
        : paymentHistory
            .filter((p) => p.status === "paid")
            .reduce((s, p) => s + p.amountCents, 0);
    return {
      ...row,
      clientTone: row.clientTone as AvatarTone,
      subtotal: itemMap.get(row.id) ?? 0,
      totalCents: total,
      paidCents: paid,
      balanceCents: Math.max(0, total - paid),
      paymentHistory,
    };
  });
}

export async function getInvoiceDetails(
  invoiceId: string,
  userId: string,
): Promise<InvoiceWithDetails | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      publicToken: invoices.publicToken,
      paymentPlan: invoices.paymentPlan,
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
  const paymentHistory = await paymentHistoryFor(row.id);
  const total = totalCents(items, row.taxRate);
  const paidCents =
    row.status === "Paid"
      ? total
      : paymentHistory
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amountCents, 0);

  return {
    ...row,
    clientTone: row.clientTone as AvatarTone,
    subtotal,
    items,
    totalCents: total,
    paidCents,
    balanceCents: Math.max(0, total - paidCents),
    paymentHistory,
  };
}

export async function getPublicInvoiceByToken(
  token: string,
): Promise<PublicInvoice | null> {
  if (!tokenSchema.safeParse(token).success) return null;
  const [row] = await db
    .select({
      id: invoices.id,
      publicToken: invoices.publicToken,
      paymentPlan: invoices.paymentPlan,
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
    .where(eq(invoices.publicToken, token))
    .limit(1);

  if (!row || row.status === "Draft") return null;

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.invoiceId, row.id))
    .orderBy(asc(lineItems.sortOrder));

  const subtotal = items.reduce((sum, item) => sum + item.rate * item.qty, 0);
  const total = totalCents(items, row.taxRate) / 100;
  const tax = total - subtotal;
  const paymentHistory = await paymentHistoryFor(row.id);
  const paidCents =
    row.status === "Paid"
      ? Math.round(total * 100)
      : paymentHistory
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amountCents, 0);

  return {
    ...row,
    clientTone: row.clientTone as AvatarTone,
    subtotal,
    tax,
    total,
    items,
    paidCents,
    balanceCents: Math.max(0, Math.round(total * 100) - paidCents),
    paymentHistory,
  };
}

async function paymentHistoryFor(invoiceId: string) {
  return db
    .select({
      id: payments.id,
      label: payments.label,
      amountCents: payments.amountCents,
      status: payments.status,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));
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
      valueMap.set(
        item.clientId,
        (valueMap.get(item.clientId) ?? 0) + item.rate * item.qty,
      );
    }
  }

  return rows.map((row) => ({
    ...row,
    lifetimeValue: valueMap.get(row.id) ?? 0,
  }));
}

// ── Dashboard stats ────────────────────────────────────────────────────────
export async function getDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const rows = await getInvoicesForUser(userId);
  const [{ activeClients }] = await db
    .select({ activeClients: count(clients.id) })
    .from(clients)
    .where(eq(clients.userId, userId));
  return {
    ...summarizeInvoices(rows),
    revenueGrowth: 0,
    activeClients: Number(activeClients),
  };
}

// ── Next invoice number ────────────────────────────────────────────────────
export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const [latest] = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        sql`${invoices.number} ~ '^INV-[0-9]{4,7}$'`,
      ),
    )
    .orderBy(desc(sql`substring(${invoices.number} from 5)::integer`))
    .limit(1);
  return latest ? `INV-${Number(latest.number.slice(4)) + 1}` : "INV-1001";
}
