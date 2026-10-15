import { NextRequest, NextResponse } from "next/server";
import { encrypt, getSession } from "@/lib/session";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const publicPath = path.length === 2 && ["guest", "qr"].includes(path[0]) && /^[0-9a-f-]{36}$/i.test(path[1]);
  const privatePath = path.length === 1 && ["workspace", "command"].includes(path[0]);
  if ((!publicPath && !privatePath) || (publicPath && request.method !== "GET")) return new NextResponse(null, { status: 404 });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!publicPath) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (request.method === "POST" && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    headers.Authorization = `Bearer ${await encrypt(session)}`;
  }
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 64000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const response = await fetch(`${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/${path.join("/")}/`, { method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(10000) });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "The billing backend is unavailable. Start Django and try again." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
