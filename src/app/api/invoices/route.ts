import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, lineItems, clients } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import type { NewInvoice, NewLineItem } from "@/types";

// ── GET /api/invoices ──────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
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
      .orderBy(desc(invoices.createdAt));

    // Fetch line items for all invoices to compute amounts
    const allLineItems = await db.select().from(lineItems);

    const result = rows.map((row) => {
      const items = allLineItems.filter((li) => li.invoiceId === row.id);
      const subtotal = items.reduce((sum, li) => sum + li.rate * li.qty, 0);
      return { ...row, subtotal, lineItems: items };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/invoices]", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

// ── POST /api/invoices ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      invoice: NewInvoice;
      items: Omit<NewLineItem, "invoiceId">[];
    };

    const [created] = await db.insert(invoices).values(body.invoice).returning();

    if (body.items?.length) {
      await db.insert(lineItems).values(
        body.items.map((item, i) => ({ ...item, invoiceId: created.id, sortOrder: i }))
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/invoices]", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
