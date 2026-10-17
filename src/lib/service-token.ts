import "server-only";
import { SignJWT } from "jose";
import { encrypt } from "./session";
import type { SessionPayload } from "@/types";

export async function serviceToken(session: SessionPayload) {
  const secret = process.env.API_SIGNING_SECRET;
  if (!secret) {
    if (process.env.APP_ENV === "production") throw new Error("API_SIGNING_SECRET is required.");
    return encrypt(session);
  }
  return new SignJWT({ userId: session.userId }).setProtectedHeader({ alg: "HS256" })
    .setIssuer("billora-web").setAudience("billora-api").setIssuedAt().setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret));
}
