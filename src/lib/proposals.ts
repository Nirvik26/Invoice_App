import "server-only";
import { db } from "./db";
import { proposals, proposalEvents, clients, invoices, users } from "./schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { tokenSchema } from "./billing";

export async function listProposals(userId: string) {
  return db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      version: proposals.version,
      content: proposals.content,
      clientId: proposals.clientId,
      clientName: clients.name,
      publicToken: proposals.publicToken,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .innerJoin(clients, eq(proposals.clientId, clients.id))
    .where(eq(proposals.userId, userId))
    .orderBy(desc(proposals.createdAt));
}

export async function proposalDetail(idOrToken: string, userId?: string) {
  if (!tokenSchema.safeParse(idOrToken).success) return null;
  const [row] = await db
    .select({
      proposal: proposals,
      clientName: clients.name,
      issuerName: users.name,
      invoiceToken: invoices.publicToken,
    })
    .from(proposals)
    .innerJoin(clients, eq(proposals.clientId, clients.id))
    .innerJoin(users, eq(proposals.userId, users.id))
    .leftJoin(invoices, eq(proposals.invoiceId, invoices.id))
    .where(
      userId
        ? and(eq(proposals.id, idOrToken), eq(proposals.userId, userId))
        : eq(proposals.publicToken, idOrToken),
    )
    .limit(1);
  if (!row || (!userId && row.proposal.status === "Draft")) return null;
  const events = await db
    .select()
    .from(proposalEvents)
    .where(eq(proposalEvents.proposalId, row.proposal.id))
    .orderBy(asc(proposalEvents.createdAt));
  return { ...row, events };
}

export type ProposalList = Awaited<ReturnType<typeof listProposals>>;
export type ProposalDetail = NonNullable<
  Awaited<ReturnType<typeof proposalDetail>>
>;
