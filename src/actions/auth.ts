"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { signUpUser, verifyCredentials } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";
import type { FormState } from "@/types";

// ── Zod schemas ────────────────────────────────────────────────────────────
const SignUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").trim(),
  email: z.email("Please enter a valid email address.").trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

const SignInSchema = z.object({
  email: z.email("Please enter a valid email address.").trim(),
  password: z.string().min(1, "Password is required."),
});

// ── Sign Up ────────────────────────────────────────────────────────────────
export async function signUpAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await signUpUser(
    parsed.data.name,
    parsed.data.email,
    parsed.data.password
  );

  if ("error" in result) {
    return { message: result.error };
  }

  await createSession(result.user.id);
  redirect("/");
}

// ── Sign In ────────────────────────────────────────────────────────────────
export async function signInAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await verifyCredentials(parsed.data.email, parsed.data.password);

  if ("error" in result) {
    return { message: result.error };
  }

  await createSession(result.user.id);
  redirect("/");
}

// ── Sign Out ───────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  await deleteSession();
  redirect("/sign-in");
}
