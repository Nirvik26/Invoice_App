import { serviceToken } from "@/lib/service-token";
import { boundedBody, BodyTooLarge } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const publicPath = path.length === 2 && ["guest", "qr", "widget-image"].includes(path[0]) && /^[0-9a-f-]{36}$/i.test(path[1]);
  const privatePath = path.length === 1 && ["workspace", "command", "settings"].includes(path[0]);
  if ((!publicPath && !privatePath) || (publicPath && request.method !== "GET")) return new NextResponse(null, { status: 404 });
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Request-ID": requestId };
  const key = request.headers.get("Idempotency-Key");
  if (key) headers["Idempotency-Key"] = key;
  if (!publicPath) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (request.method === "POST" && request.headers.get("origin") !== (process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    headers.Authorization = `Bearer ${await serviceToken(session)}`;
  }
  if (path[0] === "widget-image") {
    const session = await getSession();
    if (session) headers.Authorization = `Bearer ${await serviceToken(session)}`;
  }
  try {
    const body = request.method === "POST" ? await boundedBody(request, path[0] === "settings" ? 3 * 1024 * 1024 : 64000) : undefined;
    if (body && Buffer.byteLength(body, "utf8") > (path[0] === "settings" ? 3 * 1024 * 1024 : 64000)) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const response = await fetch(`${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/${path.join("/")}/${path[0] === "workspace" && request.nextUrl.searchParams.has("before") ? `?before=${encodeURIComponent(request.nextUrl.searchParams.get("before")!)}` : ""}`, { method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(10000) });
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId, ...(response.headers.has("Retry-After") ? { "Retry-After": response.headers.get("Retry-After")! } : {}) } });
  } catch (error) {
    if (error instanceof BodyTooLarge) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    console.error(JSON.stringify({ event: "backend_unavailable", request_id: requestId, route: path[0] }));
    return NextResponse.json({ error: "The billing backend is unavailable. Start Django and try again." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
