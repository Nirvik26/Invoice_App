import { NextRequest, NextResponse } from "next/server";
import { tokenSchema } from "@/lib/billing";
import { startCheckout } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = tokenSchema.safeParse(body?.token);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid invoice link." },
      { status: 400 },
    );
  try {
    return NextResponse.json({ url: await startCheckout(parsed.data) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start checkout.",
      },
      { status: 409 },
    );
  }
}
