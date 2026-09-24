"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, lineItems, clients } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getNextInvoiceNumber } from "@/lib/queries";
import { eq, desc } from "drizzle-orm";
import type { FormState } from "@/types";

// ── Zod schema ─────────────────────────────────────────────────────────────
const LineItemSchema = z.object({
  description: z.string().min(1),
  rate: z.number().min(0),
  qty: z.number().min(1),
});

const CreateInvoiceSchema = z.object({
  clientName: z.string().min(1, "Please select a client."),
  notes: z.string().optional(),
  items: z.array(LineItemSchema).min(1, "Add at least one line item."),
});

// ── Create invoice ─────────────────────────────────────────────────────────
export async function createInvoiceAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // Parse items JSON from hidden field
  let items: unknown[];
  try {
    items = JSON.parse(formData.get("items") as string);
  } catch {
    return { message: "Invalid line items data." };
  }

  const parsed = CreateInvoiceSchema.safeParse({
    clientName: formData.get("clientName"),
    notes: formData.get("notes") ?? undefined,
    items,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Please fix the errors above.",
    };
  }

  // Find or create the client
  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.name, parsed.data.clientName))
    .limit(1);

  let clientId = existingClient?.id;

  if (!clientId) {
    // Auto-create a basic client record
    const name = parsed.data.clientName.trim();
    const parts = name.split(/\s+/);
    const initials = (
      parts.length >= 2
        ? parts[0][0] + parts[parts.length - 1][0]
        : parts[0].slice(0, 2)
    ).toUpperCase();
    const tones = ["blue", "violet", "peach", "green", "rose", "amber"] as const;
    const tone = tones[Math.floor(Math.random() * tones.length)];

    const [newClient] = await db
      .insert(clients)
      .values({
        userId: session.userId,
        name,
        company: name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@client.com`,
        initials,
        tone,
      })
      .returning({ id: clients.id });
    clientId = newClient.id;
  }

  // Generate invoice number
  const number = await getNextInvoiceNumber(session.userId);

  // Due date = 14 days from now
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [invoice] = await db
    .insert(invoices)
    .values({
      userId: session.userId,
      clientId,
      number,
      status: "Draft",
      dueDate,
      notes: parsed.data.notes,
    })
    .returning({ id: invoices.id });

  await db.insert(lineItems).values(
    parsed.data.items.map((item, i) => ({
      invoiceId: invoice.id,
      description: item.description,
      rate: item.rate,
      qty: item.qty,
      sortOrder: i,
    }))
  );

  redirect("/");
}
