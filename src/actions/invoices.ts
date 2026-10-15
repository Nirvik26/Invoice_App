"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, lineItems, clients, payments } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getNextInvoiceNumber } from "@/lib/queries";
import { eq, and } from "drizzle-orm";
import {
  itemSchema,
  planSchema,
  totalCents,
  installments,
} from "@/lib/billing";
import type { FormState } from "@/types";

// ── Zod schema ─────────────────────────────────────────────────────────────
const LineItemSchema = itemSchema;

const CreateInvoiceSchema = z.object({
  clientName: z.string().trim().min(1, "Please select a client.").max(200),
  notes: z.string().optional(),
  paymentPlan: planSchema,
  items: z.array(LineItemSchema).min(1, "Add at least one line item."),
});

// ── Create invoice ─────────────────────────────────────────────────────────
export async function createInvoiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // Parse items JSON from hidden field
  let items: unknown[];
  let paymentPlan: unknown;
  try {
    items = JSON.parse(formData.get("items") as string);
    paymentPlan = JSON.parse(
      String(
        formData.get("paymentPlan") ||
          '[{"label":"Full payment","percent":100}]',
      ),
    );
  } catch {
    return { message: "Invalid line items data." };
  }

  const parsed = CreateInvoiceSchema.safeParse({
    clientName: formData.get("clientName"),
    notes: formData.get("notes") ?? undefined,
    items,
    paymentPlan,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Please fix the errors above.",
    };
  }

  const total = totalCents(parsed.data.items, 8);
  if (
    total > 99_999_999 ||
    installments(total, parsed.data.paymentPlan).some((p) => p.amountCents < 50)
  )
    return {
      message:
        "Each installment must be at least $0.50 and the total cannot exceed $999,999.99.",
    };

  // Find or create the client scoped to this user
  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.name, parsed.data.clientName),
        eq(clients.userId, session.userId),
      ),
    )
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
    const tones = [
      "blue",
      "violet",
      "peach",
      "green",
      "rose",
      "amber",
    ] as const;
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

  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        userId: session.userId,
        clientId,
        number,
        status: "Sent",
        dueDate,
        notes: parsed.data.notes,
        paymentPlan: parsed.data.paymentPlan,
      })
      .returning({ id: invoices.id });

    await tx.insert(lineItems).values(
      parsed.data.items.map((item, i) => ({
        invoiceId: invoice.id,
        description: item.description,
        rate: item.rate,
        qty: item.qty,
        sortOrder: i,
      })),
    );
  });
  redirect("/");
}

// ── Update invoice status ──────────────────────────────────────────────────
export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: "Draft" | "Sent" | "Paid" | "Overdue",
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!["Draft", "Sent", "Overdue"].includes(status))
    return {
      success: false,
      error: "Paid status is set only by verified payments.",
    };
  try {
    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(eq(invoices.id, invoiceId), eq(invoices.userId, session.userId)),
        )
        .for("update");
      if (!invoice) throw new Error("Invoice not found.");
      const history = await tx
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId));
      if (
        invoice.status === "Paid" ||
        history.some((p) => p.status === "paid" || p.status === "pending")
      )
        throw new Error(
          "Invoices with payments or active checkout cannot be manually changed.",
        );
      await tx
        .update(invoices)
        .set({ status })
        .where(eq(invoices.id, invoiceId));
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not update invoice.",
    };
  }
}

// ── Delete invoice ─────────────────────────────────────────────────────────
export async function deleteInvoiceAction(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const [deleted] = await db
      .delete(invoices)
      .where(
        and(eq(invoices.id, invoiceId), eq(invoices.userId, session.userId)),
      )
      .returning({ id: invoices.id });

    if (!deleted) {
      return { success: false, error: "Invoice not found." };
    }

    return { success: true };
  } catch (err) {
    console.error("[deleteInvoiceAction]", err);
    return {
      success: false,
      error:
        "This invoice has payment or proposal history and cannot be deleted.",
    };
  }
}

// ── Get invoice details for preview ────────────────────────────────────────
export async function getInvoiceDetailsAction(invoiceId: string) {
  const session = await getSession();
  if (!session) return null;

  const { getInvoiceDetails } = await import("@/lib/queries");
  return getInvoiceDetails(invoiceId, session.userId);
}
