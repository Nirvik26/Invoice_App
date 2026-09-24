/**
 * Seed script — populates the database with demo data.
 * Run with: pnpm db:seed
 * Demo credentials: demo@billora.app / demo1234
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding database…");

  // ── Wipe ──────────────────────────────────────────────────────────────────
  await db.delete(schema.lineItems);
  await db.delete(schema.invoices);
  await db.delete(schema.clients);
  await db.delete(schema.users);

  // ── Demo user ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const [user] = await db
    .insert(schema.users)
    .values({
      name: "Jordan Davis",
      email: "demo@billora.app",
      passwordHash,
      plan: "Studio",
      initials: "JD",
      tone: "blue",
    })
    .returning();

  console.log(`✅ Demo user created: demo@billora.app / demo1234`);

  // ── Clients ───────────────────────────────────────────────────────────────
  const [mira, noah, sofia, eli, amara] = await db
    .insert(schema.clients)
    .values([
      { userId: user.id, name: "Mira Chen", company: "Atelier Miro", email: "mira@ateliermiro.com", initials: "MC", tone: "peach" },
      { userId: user.id, name: "Noah Williams", company: "Northline Studio", email: "noah@northline.studio", initials: "NW", tone: "blue" },
      { userId: user.id, name: "Sofia Patel", company: "Common Ground", email: "sofia@commonground.co", initials: "SP", tone: "rose" },
      { userId: user.id, name: "Eli Foster", company: "Field Notes Co.", email: "eli@fieldnotes.co", initials: "EF", tone: "green" },
      { userId: user.id, name: "Amara Okafor", company: "Studio Aster", email: "hello@studioaster.co", initials: "AO", tone: "violet" },
    ])
    .returning();

  // ── Invoices ──────────────────────────────────────────────────────────────
  const [inv1038, inv1037, inv1036, inv1035, inv1034] = await db
    .insert(schema.invoices)
    .values([
      { userId: user.id, number: "INV-1038", clientId: mira.id, status: "Sent", dueDate: "2026-09-05" },
      { userId: user.id, number: "INV-1037", clientId: noah.id, status: "Paid", dueDate: "2026-09-01" },
      { userId: user.id, number: "INV-1036", clientId: sofia.id, status: "Overdue", dueDate: "2026-08-26" },
      { userId: user.id, number: "INV-1035", clientId: eli.id, status: "Draft", dueDate: "2026-08-24" },
      { userId: user.id, number: "INV-1034", clientId: amara.id, status: "Paid", dueDate: "2026-08-18" },
    ])
    .returning();

  // ── Line Items ────────────────────────────────────────────────────────────
  await db.insert(schema.lineItems).values([
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

  console.log("✅ Seed complete! 5 clients, 5 invoices seeded.");
  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
