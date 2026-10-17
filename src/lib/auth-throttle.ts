import "server-only";
import { createHash } from "node:crypto";
import { serviceToken } from "./service-token";

export async function authenticationAllowed(email: string): Promise<boolean> {
  // Redis stores an opaque account bucket, never the email or password.
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const userId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  try {
    const token = await serviceToken({ userId, expiresAt: new Date(Date.now() + 60000) });
    const response = await fetch(`${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/auth-limit/`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch { return process.env.APP_ENV !== "production"; }
}
