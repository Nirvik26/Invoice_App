import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  proposals,
  proposalEvents,
  invoices,
  lineItems,
} from "@/lib/schema";
import { proposalContentSchema, tokenSchema } from "@/lib/billing";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(200),
  clientId: z.string().uuid(),
  content: proposalContentSchema,
});

export async function saveProposalForUser(userId: string, input: unknown) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const [client] = await tx
        .select()
        .from(clients)
        .where(and(eq(clients.id, data.clientId), eq(clients.userId, userId)));
      if (!client) throw new Error("Choose a client from your workspace.");
      let proposal;
      if (data.id) {
        const [existing] = await tx
          .select()
          .from(proposals)
          .where(and(eq(proposals.id, data.id), eq(proposals.userId, userId)))
          .for("update");
        if (!existing) throw new Error("Proposal not found.");
        if (existing.status === "Accepted")
          throw new Error("Accepted proposals cannot be changed.");
        if (existing.version !== data.version)
          throw new Error("This proposal changed. Reload before saving.");
        if (existing.clientId !== data.clientId)
          throw new Error(
            "The client cannot be changed on an existing proposal.",
          );
        [proposal] = await tx
          .update(proposals)
          .set({
            title: data.title,
            content: data.content,
            version: existing.version + 1,
            status: "Draft",
          })
          .where(eq(proposals.id, existing.id))
          .returning();
      } else {
        [proposal] = await tx
          .insert(proposals)
          .values({
            userId: userId,
            clientId: data.clientId,
            title: data.title,
            content: data.content,
          })
          .returning();
      }
      await tx
        .insert(proposalEvents)
        .values({
          proposalId: proposal.id,
          version: proposal.version,
          actor: "Workspace",
          kind: "revision",
          message: `${proposal.title} — revision ${proposal.version} saved`,
          snapshot: data.content,
        });
      return proposal.id;
    });
    return { id: result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save proposal.",
    };
  }
}

export async function shareProposalForUser(
  userId: string,
  id: string,
  version: number,
) {
  if (!tokenSchema.safeParse(id).success) return { error: "Unauthorized." };
  try {
    const token = await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, id), eq(proposals.userId, userId)))
        .for("update");
      if (!p || p.version !== version)
        throw new Error("Proposal changed. Reload and try again.");
      if (p.status === "Changes requested")
        throw new Error("Save a revised proposal before sharing it again.");
      if (p.status === "Draft") {
        await tx
          .update(proposals)
          .set({ status: "Sent" })
          .where(eq(proposals.id, id));
        await tx
          .insert(proposalEvents)
          .values({
            proposalId: id,
            version,
            actor: "Workspace",
            kind: "shared",
            message: "Proposal published for client review.",
          });
      }
      return p.publicToken;
    });
    return { token };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not share proposal.",
    };
  }
}

const responseSchema = z
  .object({
    token: tokenSchema,
    version: z.number().int().positive(),
    action: z.enum(["comment", "changes", "accept"]),
    name: z.string().trim().min(1).max(100),
    message: z.string().trim().max(3000),
    consent: z.boolean().default(false),
  })
  .refine(
    (v) => v.action === "accept" || v.message.length > 0,
    "Please include a message.",
  )
  .refine(
    (v) => v.action !== "accept" || v.consent,
    "Please confirm you are authorized to accept this revision.",
  );

export async function recordProposalResponse(input: unknown) {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  try {
    const invoiceToken = await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(proposals)
        .where(eq(proposals.publicToken, data.token))
        .for("update");
      if (!p || p.status === "Draft")
        throw new Error("This proposal is not available for review.");
      if (p.version !== data.version)
        throw new Error(
          "A newer revision is available. Refresh before responding.",
        );
      if (p.status === "Accepted")
        throw new Error("This proposal has already been accepted.");
      if (data.action === "accept" && p.status !== "Sent")
        throw new Error(
          "Please wait for the revised proposal before accepting.",
        );
      let token: string | undefined;
      if (data.action === "accept") {
        const [invoice] = await tx
          .insert(invoices)
          .values({
            userId: p.userId,
            clientId: p.clientId,
            number: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            status: "Sent",
            dueDate: new Date(Date.now() + p.content.paymentDays * 86400000)
              .toISOString()
              .slice(0, 10),
            notes: p.content.scope,
            taxRate: p.content.taxRate,
            paymentPlan: p.content.paymentPlan,
          })
          .returning();
        await tx
          .insert(lineItems)
          .values(
            p.content.items.map((item, i) => ({
              ...item,
              invoiceId: invoice.id,
              sortOrder: i,
            })),
          );
        await tx
          .update(proposals)
          .set({ status: "Accepted", invoiceId: invoice.id })
          .where(eq(proposals.id, p.id));
        token = invoice.publicToken;
      } else if (data.action === "changes") {
        await tx
          .update(proposals)
          .set({ status: "Changes requested" })
          .where(eq(proposals.id, p.id));
      }
      await tx
        .insert(proposalEvents)
        .values({
          proposalId: p.id,
          version: p.version,
          actor: `Client: ${data.name}`,
          kind: data.action,
          message:
            data.action === "accept"
              ? `Accepted revision ${p.version}. ${data.message}`.trim()
              : data.message,
          snapshot: data.action === "accept" ? p.content : null,
        });
      return token;
    });
    return { success: true, invoiceToken };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not record your response.",
    };
  }
}
