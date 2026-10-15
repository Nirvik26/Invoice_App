import Stripe from "stripe";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_"))
    throw new Error(
      "Stripe test payments are not configured. Ask the workspace owner to add a Stripe test key.",
    );
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 });
}

export function paymentsConfigured() {
  return !!(
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.APP_URL
  );
}

export function applicationUrl() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("APP_URL must use HTTPS outside localhost.");
  return url.origin;
}
