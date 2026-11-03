import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, invoices, lineItems, payments, proposals, users } from "@/lib/schema";

export const DEMO_EMAIL = "demo@billora.app";

export function demoEnabled() {
  return process.env.DEMO_MODE === "true";
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Recreates the shared demo workspace. Only rows owned by the demo user are
 * touched, so this is safe to run against a database that also holds real accounts.
 */
export async function resetDemoWorkspace() {
  // The demo account is passwordless (sessions are minted server-side), so its hash is unguessable.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  let userId = existing?.id;

  if (userId) {
    const owned = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.userId, userId));
    const invoiceIds = owned.map(row => row.id);
    // Proposal events cascade; payments restrict invoice deletion, so remove them first.
    await db.delete(proposals).where(eq(proposals.userId, userId));
    if (invoiceIds.length) await db.delete(payments).where(inArray(payments.invoiceId, invoiceIds));
    await db.delete(invoices).where(eq(invoices.userId, userId));
    await db.delete(clients).where(eq(clients.userId, userId));
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  } else {
    const [created] = await db
      .insert(users)
      .values({ name: "Jordan Davis", email: DEMO_EMAIL, passwordHash, plan: "Studio", initials: "JD", tone: "blue" })
      .returning({ id: users.id });
    userId = created.id;
  }

  const [mira, noah, sofia, eli, amara] = await db
    .insert(clients)
    .values([
      { userId, name: "Mira Chen", company: "Atelier Miro", email: "mira@ateliermiro.com", initials: "MC", tone: "peach" },
      { userId, name: "Noah Williams", company: "Northline Studio", email: "noah@northline.studio", initials: "NW", tone: "blue" },
      { userId, name: "Sofia Patel", company: "Common Ground", email: "sofia@commonground.co", initials: "SP", tone: "rose" },
      { userId, name: "Eli Foster", company: "Field Notes Co.", email: "eli@fieldnotes.co", initials: "EF", tone: "green" },
      { userId, name: "Amara Okafor", company: "Studio Aster", email: "hello@studioaster.co", initials: "AO", tone: "violet" },
    ])
    .returning();

  const [inv1038, inv1037, inv1036, inv1035, inv1034] = await db
    .insert(invoices)
    .values([
      { userId, number: "INV-1038", clientId: mira.id, status: "Sent", dueDate: daysFromNow(9) },
      { userId, number: "INV-1037", clientId: noah.id, status: "Paid", dueDate: daysFromNow(-4) },
      { userId, number: "INV-1036", clientId: sofia.id, status: "Overdue", dueDate: daysFromNow(-12) },
      { userId, number: "INV-1035", clientId: eli.id, status: "Draft", dueDate: daysFromNow(14) },
      { userId, number: "INV-1034", clientId: amara.id, status: "Paid", dueDate: daysFromNow(-20) },
    ])
    .returning();

  await db.insert(lineItems).values([
    { invoiceId: inv1038.id, description: "Brand strategy workshop", rate: 1200, qty: 1, sortOrder: 0 },
    { invoiceId: inv1038.id, description: "Visual identity direction", rate: 1800, qty: 1, sortOrder: 1 },
    { invoiceId: inv1038.id, description: "Website design · 4 pages", rate: 396, qty: 4, sortOrder: 2 },
    { invoiceId: inv1037.id, description: "UI/UX design sprint", rate: 2000, qty: 1, sortOrder: 0 },
    { invoiceId: inv1037.id, description: "Prototype & handoff", rate: 1400, qty: 1, sortOrder: 1 },
    { invoiceId: inv1036.id, description: "Brand identity package", rate: 2750, qty: 1, sortOrder: 0 },
    { invoiceId: inv1035.id, description: "Editorial photography", rate: 925, qty: 2, sortOrder: 0 },
    { invoiceId: inv1034.id, description: "Full brand refresh", rate: 4200, qty: 1, sortOrder: 0 },
    { invoiceId: inv1034.id, description: "Motion & animation package", rate: 2000, qty: 1, sortOrder: 1 },
  ]);

  return userId;
}

export async function demoUserId() {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  return row?.id ?? resetDemoWorkspace();
}
