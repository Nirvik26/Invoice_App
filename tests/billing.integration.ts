import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  users,
  clients,
  proposals,
  proposalEvents,
  invoices,
  lineItems,
  payments,
} from "../src/lib/schema";

// This suite never reads .env.local. Supply a dedicated, migrated test database.
test(
  "proposal approval and verified installment lifecycle",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.STRIPE_SECRET_KEY = "sk_test_integration_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration_fixture";
    process.env.APP_URL = "http://localhost:3107";
    const { db } = await import("../src/lib/db");
    const service = await import("../src/lib/proposal-service");
    const { startCheckout, fulfillCheckout } =
      await import("../src/lib/payments");
    const { getPublicInvoiceByToken, getDashboardStats } =
      await import("../src/lib/queries");
    const { proposalDetail } = await import("../src/lib/proposals");
    const suffix = crypto.randomUUID();
    const [owner, other] = await db
      .insert(users)
      .values([
        {
          name: "Test owner",
          email: `owner-${suffix}@example.test`,
          passwordHash: "test-only",
          initials: "TO",
        },
        {
          name: "Other owner",
          email: `other-${suffix}@example.test`,
          passwordHash: "test-only",
          initials: "OO",
        },
      ])
      .returning();
    const [client] = await db
      .insert(clients)
      .values({
        userId: owner.id,
        name: "Test client",
        company: "Studio",
        email: "client@example.test",
        initials: "TC",
      })
      .returning();
    const content = {
      scope: "Design and deliver a website.",
      items: [{ description: "Website", rate: 1000, qty: 1 }],
      taxRate: 8,
      paymentDays: 30,
      paymentPlan: [
        { label: "Deposit", percent: 30 },
        { label: "Final delivery", percent: 70 },
      ],
    };
    let proposalId = "",
      token = "",
      invoiceId = "",
      invoiceToken = "";
    const providerSessions = new Map<string, Stripe.Checkout.Session>();
    let loseResponse = false,
      creates = 0;
    const gateway = {
      checkout: {
        sessions: {
          async create(
            params: Stripe.Checkout.SessionCreateParams,
            options: Stripe.RequestOptions,
          ) {
            const key = options.idempotencyKey!;
            let session = providerSessions.get(key);
            if (!session) {
              creates++;
              session = {
                id: `cs_test_${crypto.randomUUID()}`,
                metadata: params.metadata,
                amount_total: params.line_items![0].price_data!.unit_amount,
                currency: "usd",
                livemode: false,
                payment_status: "unpaid",
                status: "open",
                url: "https://checkout.stripe.com/test-fixture",
              } as Stripe.Checkout.Session;
              providerSessions.set(key, session);
            }
            if (loseResponse) {
              loseResponse = false;
              throw new Error(
                "Simulated connection lost after provider success",
              );
            }
            return session;
          },
          async retrieve(id: string) {
            const session = [...providerSessions.values()].find(
              (s) => s.id === id,
            );
            assert.ok(session);
            return session;
          },
        },
      },
    } as unknown as Pick<Stripe, "checkout">;
    try {
      await t.test(
        "ownership, unpublished access, consent, revision conflicts and immutable acceptance",
        async () => {
          const unauthorized = await service.saveProposalForUser(other.id, {
            title: "Wrong workspace",
            clientId: client.id,
            content,
          });
          assert.ok(unauthorized.error);
          const saved = await service.saveProposalForUser(owner.id, {
            title: "Website proposal",
            clientId: client.id,
            content,
          });
          assert.ok(saved.id, saved.error);
          proposalId = saved.id;
          const [p] = await db
            .select()
            .from(proposals)
            .where(eq(proposals.id, proposalId));
          token = p.publicToken;
          assert.equal(await proposalDetail(token), null);
          assert.equal(await proposalDetail(proposalId, other.id), null);
          assert.ok(
            (await service.shareProposalForUser(other.id, proposalId, 1)).error,
          );
          assert.ok(
            (await service.shareProposalForUser(owner.id, proposalId, 1)).token,
          );
          assert.ok(
            (
              await service.recordProposalResponse({
                token,
                version: 1,
                action: "accept",
                name: "Client",
                message: "",
              })
            ).error,
          );
          assert.ok(
            (
              await service.recordProposalResponse({
                token,
                version: 1,
                action: "changes",
                name: "Client",
                message: "Include source files.",
              })
            ).success,
          );
          assert.ok(
            (
              await service.recordProposalResponse({
                token,
                version: 1,
                action: "accept",
                name: "Client",
                message: "",
                consent: true,
              })
            ).error,
          );
          assert.ok(
            (
              await service.saveProposalForUser(owner.id, {
                id: proposalId,
                version: 1,
                title: "Website proposal",
                clientId: client.id,
                content: {
                  ...content,
                  scope: "Design, website and source files.",
                },
              })
            ).id,
          );
          assert.ok(
            (
              await service.saveProposalForUser(owner.id, {
                id: proposalId,
                version: 1,
                title: "Stale update",
                clientId: client.id,
                content,
              })
            ).error,
          );
          assert.ok(
            (await service.shareProposalForUser(owner.id, proposalId, 2)).token,
          );
          assert.ok(
            (
              await service.recordProposalResponse({
                token,
                version: 1,
                action: "accept",
                name: "Client",
                message: "",
                consent: true,
              })
            ).error,
          );
          const results = await Promise.all(
            [1, 2].map(() =>
              service.recordProposalResponse({
                token,
                version: 2,
                action: "accept",
                name: "Client",
                message: "Approved",
                consent: true,
              }),
            ),
          );
          assert.equal(results.filter((r) => r.success).length, 1);
          invoiceToken = results.find((r) => r.invoiceToken)!.invoiceToken!;
          const rows = await db
            .select()
            .from(invoices)
            .where(eq(invoices.userId, owner.id));
          assert.equal(rows.length, 1);
          invoiceId = rows[0].id;
          assert.deepEqual(rows[0].paymentPlan, content.paymentPlan);
          assert.ok(
            (
              await service.saveProposalForUser(owner.id, {
                id: proposalId,
                version: 2,
                title: "Cannot edit",
                clientId: client.id,
                content,
              })
            ).error,
          );
          const history = await db
            .select()
            .from(proposalEvents)
            .where(eq(proposalEvents.proposalId, proposalId));
          assert.equal(history.filter((e) => e.kind === "accept").length, 1);
          assert.equal(
            history.find((e) => e.kind === "revision" && e.version === 1)
              ?.snapshot?.scope,
            content.scope,
          );
          assert.equal(
            history.find((e) => e.kind === "accept")?.snapshot?.scope,
            "Design, website and source files.",
          );
          assert.equal(await getPublicInvoiceByToken(rows[0].number), null);
          assert.equal(
            (await getPublicInvoiceByToken(invoiceToken))?.balanceCents,
            108000,
          );
        },
      );

      await t.test(
        "lost responses and concurrent checkout requests reuse one payment attempt",
        async () => {
          loseResponse = true;
          await assert.rejects(
            startCheckout(invoiceToken, gateway),
            /connection lost/,
          );
          await Promise.all([
            startCheckout(invoiceToken, gateway),
            startCheckout(invoiceToken, gateway),
          ]);
          const attempts = await db
            .select()
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId));
          assert.equal(attempts.length, 1);
          assert.equal(creates, 1);
          assert.equal(attempts[0].amountCents, 32400);
        },
      );

      await t.test(
        "unpaid and mismatched events cannot credit an invoice; duplicate paid events credit once",
        async () => {
          const session = [...providerSessions.values()][0];
          await fulfillCheckout(session, "checkout.session.completed");
          assert.equal(
            (await getPublicInvoiceByToken(invoiceToken))?.paidCents,
            0,
          );
          await assert.rejects(
            fulfillCheckout(
              { ...session, amount_total: 1, payment_status: "paid" },
              "checkout.session.completed",
            ),
          );
          await assert.rejects(
            fulfillCheckout(
              { ...session, currency: "eur", payment_status: "paid" },
              "checkout.session.completed",
            ),
          );
          await assert.rejects(
            fulfillCheckout(
              { ...session, livemode: true, payment_status: "paid" },
              "checkout.session.completed",
            ),
          );
          session.status = "complete";
          session.payment_status = "paid";
          await Promise.all([
            fulfillCheckout(session, "checkout.session.completed"),
            fulfillCheckout(session, "checkout.session.completed"),
          ]);
          const invoice = await getPublicInvoiceByToken(invoiceToken);
          assert.equal(invoice?.paidCents, 32400);
          assert.equal(invoice?.balanceCents, 75600);
          assert.equal(invoice?.status, "Sent");
          const stats = await getDashboardStats(owner.id);
          assert.equal(stats.revenueThisMonth, 324);
          assert.equal(stats.outstanding, 756);
          await fulfillCheckout(session, "checkout.session.expired");
          assert.equal(
            (await getPublicInvoiceByToken(invoiceToken))?.paidCents,
            32400,
          );
        },
      );

      await t.test(
        "expired and failed checkouts can be retried and final payment clears the balance",
        async () => {
          await startCheckout(invoiceToken, gateway);
          const expired = [...providerSessions.values()][1];
          expired.status = "expired";
          await startCheckout(invoiceToken, gateway);
          const failed = [...providerSessions.values()][2];
          await fulfillCheckout(
            failed,
            "checkout.session.async_payment_failed",
          );
          await startCheckout(invoiceToken, gateway);
          const final = [...providerSessions.values()][3];
          final.status = "complete";
          final.payment_status = "paid";
          assert.equal(final.amount_total, 75600);
          await fulfillCheckout(final, "checkout.session.completed");
          const invoice = await getPublicInvoiceByToken(invoiceToken);
          assert.equal(invoice?.balanceCents, 0);
          assert.equal(invoice?.status, "Paid");
          assert.equal(
            invoice?.paymentHistory.filter((p) => p.status === "paid").length,
            2,
          );
          await assert.rejects(
            startCheckout(invoiceToken, gateway),
            /already paid/,
          );
          await assert.rejects(
            db.delete(invoices).where(eq(invoices.id, invoiceId)),
          );
        },
      );
    } finally {
      if (proposalId)
        await db.delete(proposals).where(eq(proposals.id, proposalId));
      if (invoiceId) {
        await db.delete(payments).where(eq(payments.invoiceId, invoiceId));
        await db.delete(lineItems).where(eq(lineItems.invoiceId, invoiceId));
        await db.delete(invoices).where(eq(invoices.id, invoiceId));
      }
      await db.delete(clients).where(eq(clients.id, client.id));
      await db.delete(users).where(eq(users.id, owner.id));
      await db.delete(users).where(eq(users.id, other.id));
      await db.$client.end();
    }
  },
);

test(
  "additive migration preserves legacy invoices and can be rerun",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const sql = postgres(process.env.TEST_DATABASE_URL!, {
      max: 1,
      onnotice: () => {},
    });
    const schema = `billing_upgrade_${crypto.randomUUID().replaceAll("-", "")}`;
    const rollback = new Error("Rollback isolated migration fixture");
    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx.unsafe(`CREATE SCHEMA "${schema}"`);
          await tx.unsafe(`SET LOCAL search_path TO "${schema}"`);
          await tx.unsafe(
            "CREATE TABLE users (id uuid PRIMARY KEY); CREATE TABLE clients (id uuid PRIMARY KEY); CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL, notes text);",
          );
          await tx`INSERT INTO invoices(number, notes) VALUES ('INV-1001', 'Keep these terms'), ('INV-1002', 'Keep this invoice')`;
          const migration = await readFile(
            "migrations/001_proposals_payments.sql",
            "utf8",
          );
          await tx.unsafe(migration);
          await tx.unsafe(migration);
          const rows = await tx`SELECT * FROM invoices ORDER BY number`;
          assert.equal(rows.length, 2);
          assert.equal(rows[0].notes, "Keep these terms");
          assert.ok(rows[0].public_token);
          assert.notEqual(rows[0].public_token, rows[1].public_token);
          assert.deepEqual(rows[0].payment_plan, [
            { label: "Full payment", percent: 100 },
          ]);
          throw rollback; // Roll back the entire temporary schema; no existing data is touched.
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end();
    }
  },
);
