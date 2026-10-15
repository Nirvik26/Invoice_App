import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  totalCents,
  installments,
  nextInstallment,
  proposalContentSchema,
  planSchema,
} from "../src/lib/billing";

test("installments conserve every cent, including uneven percentages", () => {
  for (let total = 50; total < 100000; total += 137) {
    const plan = [
      { label: "Deposit", percent: 33 },
      { label: "Review", percent: 33 },
      { label: "Delivery", percent: 34 },
    ];
    const parts = installments(total, plan);
    assert.equal(
      parts.reduce((sum, p) => sum + p.amountCents, 0),
      total,
    );
    assert.equal(
      nextInstallment(total, parts[0].amountCents, plan)?.amountCents,
      parts[1].amountCents,
    );
    assert.equal(nextInstallment(total, total, plan), null);
  }
});

test("money is rounded in cents and residual installment balances are exact", () => {
  assert.equal(totalCents([{ rate: 1.01, qty: 3 }], 8), 327);
  const plan = [
    { label: "Deposit", percent: 30 },
    { label: "Final", percent: 70 },
  ];
  assert.deepEqual(nextInstallment(10800, 1000, plan), {
    label: "Deposit",
    amountCents: 2240,
  });
});

test("invalid schedules, oversized invoices, and sub-minimum installments are rejected", () => {
  assert.equal(
    planSchema.safeParse([{ label: "Deposit", percent: 30 }]).success,
    false,
  );
  const content = {
    scope: "Website",
    taxRate: 8,
    paymentDays: 30,
    items: [{ description: "Design", rate: 100, qty: 1 }],
    paymentPlan: [{ label: "Full", percent: 100 }],
  };
  assert.equal(proposalContentSchema.safeParse(content).success, true);
  assert.equal(
    proposalContentSchema.safeParse({
      ...content,
      items: [{ description: "Design", rate: 1000000, qty: 10000 }],
    }).success,
    false,
  );
  assert.equal(
    proposalContentSchema.safeParse({
      ...content,
      items: [{ description: "Design", rate: 1, qty: 1 }],
      paymentPlan: [
        { label: "Deposit", percent: 1 },
        { label: "Final", percent: 99 },
      ],
    }).success,
    false,
  );
});

test("Stripe signatures reject tampered payloads and expired signatures", () => {
  const stripe = new Stripe("sk_test_unit_fixture");
  const secret = "whsec_unit_fixture";
  const payload = JSON.stringify({
    id: "evt_fixture",
    type: "checkout.session.completed",
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, signature, secret).id,
    "evt_fixture",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload + " ", signature, secret),
  );
  const old = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  assert.throws(() => stripe.webhooks.constructEvent(payload, old, secret));
});
