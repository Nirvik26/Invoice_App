import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, invoices, lineItems } from "@/lib/schema";
import { eq, desc, sum, count } from "drizzle-orm";
import type { NewClient } from "@/types";

// ── GET /api/clients ───────────────────────────────────────────────────────
export async function GET() {
  try {
    const rows = await db
      .select({
        id: clients.id,
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
      .groupBy(clients.id)
      .orderBy(desc(clients.createdAt));

    // Compute lifetime value per client from line items
    const allLineItems = await db
      .select({
        invoiceId: lineItems.invoiceId,
        rate: lineItems.rate,
        qty: lineItems.qty,
        clientId: invoices.clientId,
      })
      .from(lineItems)
      .innerJoin(invoices, eq(lineItems.invoiceId, invoices.id));

    const result = rows.map((client) => {
      const value = allLineItems
        .filter((li) => li.clientId === client.id)
        .reduce((sum, li) => sum + li.rate * li.qty, 0);
      return { ...client, lifetimeValue: value };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/clients]", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

// ── POST /api/clients ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as NewClient;
    const [created] = await db.insert(clients).values(body).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/clients]", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
