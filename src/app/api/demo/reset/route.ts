import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { demoEnabled, resetDemoWorkspace } from "@/lib/demo";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called by the scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
export async function GET(request: NextRequest) {
  if (!demoEnabled()) return NextResponse.json({ error: "Demo mode is off." }, { status: 404 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await resetDemoWorkspace();
  return NextResponse.json({ status: "reset" }, { headers: { "Cache-Control": "no-store" } });
}
