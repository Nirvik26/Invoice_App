import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/types";

const SALT_ROUNDS = 12;

// ── Sign up ────────────────────────────────────────────────────────────────
export async function signUpUser(
  name: string,
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Generate initials from name
  const parts = name.trim().split(/\s+/);
  const initials = (
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2)
  ).toUpperCase();

  // Cycle through tones for variety
  const tones = ["blue", "violet", "peach", "green", "rose", "amber"] as const;
  const tone = tones[Math.floor(Math.random() * tones.length)];

  const [user] = await db
    .insert(users)
    .values({ name: name.trim(), email: email.toLowerCase(), passwordHash, initials, tone })
    .returning();

  return { user };
}

// ── Sign in ────────────────────────────────────────────────────────────────
export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return { error: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  return { user };
}

// ── Get current user ───────────────────────────────────────────────────────
export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}
