import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { stripeClient } from "@/lib/stripe";
import { fulfillCheckout } from "@/lib/payments";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") || "",
      secret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ].includes(event.type)
  ) {
    try {
      await fulfillCheckout(
        event.data.object as Stripe.Checkout.Session,
        event.type,
      );
      revalidatePath("/");
      revalidatePath("/invoice/[number]", "page");
    } catch (error) {
      console.error(
        "Stripe reconciliation failed",
        error instanceof Error ? error.message : "unknown error",
      );
      return NextResponse.json(
        { error: "Reconciliation failed. Retry delivery." },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ received: true });
}
