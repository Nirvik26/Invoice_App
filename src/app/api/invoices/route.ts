import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoices, lineItems, clients } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getInvoicesForUser } from "@/lib/queries";
import {
  itemSchema,
  planSchema,
  totalCents,
  installments,
} from "@/lib/billing";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getInvoicesForUser(session.userId));
}
const schema = z.object({
  invoice: z.object({
    clientId: z.string().uuid(),
    dueDate: z.iso.date(),
    notes: z.string().max(10000).optional(),
    taxRate: z.number().int().min(0).max(100).default(8),
    status: z.enum(["Draft", "Sent"]).default("Draft"),
    paymentPlan: planSchema.default([{ label: "Full payment", percent: 100 }]),
  }),
  items: z.array(itemSchema).min(1).max(100),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const { invoice, items } = parsed.data;
  const total = totalCents(items, invoice.taxRate);
  if (
    total > 99_999_999 ||
    installments(total, invoice.paymentPlan).some((p) => p.amountCents < 50)
  )
    return NextResponse.json(
      {
        error:
          "Each installment must be at least $0.50 and the invoice total cannot exceed $999,999.99.",
      },
      { status: 400 },
    );
  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, invoice.clientId), eq(clients.userId, session.userId)),
    );
  if (!client)
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoices)
      .values({
        ...invoice,
        userId: session.userId,
        number: "INV-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      })
      .returning();
    await tx
      .insert(lineItems)
      .values(
        items.map((item, i) => ({ ...item, invoiceId: row.id, sortOrder: i })),
      );
    return row;
  });
  return NextResponse.json(created, { status: 201 });
}
