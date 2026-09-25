import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/invoice"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public static assets and API routes (API routes handle auth themselves)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublicPrefix = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const token = request.cookies.get("billora_session")?.value;
  const session = token ? await decrypt(token) : null;
  const isAuthenticated = !!session && session.expiresAt > new Date();

  // Redirect unauthenticated users to sign-in for private routes
  if (!isAuthenticated && !isPublicPrefix) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirect authenticated users away from sign-in/sign-up pages
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

