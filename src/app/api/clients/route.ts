import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, invoices, lineItems } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/session";
import type { NewClient } from "@/types";

// ── GET /api/clients ───────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      .where(eq(clients.userId, session.userId))
      .groupBy(clients.id)
      .orderBy(desc(clients.createdAt));

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    const userLineItems = await db
      .select({
        clientId: invoices.clientId,
        rate: lineItems.rate,
        qty: lineItems.qty,
      })
      .from(lineItems)
      .innerJoin(invoices, eq(lineItems.invoiceId, invoices.id))
      .where(eq(invoices.userId, session.userId));

    const result = rows.map((client) => {
      const value = userLineItems
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Omit<NewClient, "userId">;
    if (!body.name || !body.company || !body.email) {
      return NextResponse.json({ error: "Name, company, and email are required" }, { status: 400 });
    }

    const initials = body.initials || body.name.slice(0, 2).toUpperCase();

    const [created] = await db
      .insert(clients)
      .values({
        ...body,
        initials,
        userId: session.userId,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/clients]", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
