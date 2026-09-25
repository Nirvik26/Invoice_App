"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { eq, and } from "drizzle-orm";
import type { FormState, AvatarTone } from "@/types";

const CreateClientSchema = z.object({
  name: z.string().min(2, "Client contact name must be at least 2 characters.").trim(),
  company: z.string().min(2, "Company name must be at least 2 characters.").trim(),
  email: z.string().email("Please enter a valid email address.").trim(),
  tone: z.enum(["peach", "blue", "rose", "green", "violet", "amber"]).default("blue"),
});

export async function createClientAction(
  _state: FormState,
  formData: FormData
): Promise<FormState & { client?: { id: string; name: string; company: string; email: string; initials: string; tone: AvatarTone } }> {
  const session = await getSession();
  if (!session) return { message: "Unauthorized. Please sign in." };

  const parsed = CreateClientSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    email: formData.get("email"),
    tone: formData.get("tone") || "blue",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Please correct the errors in the form.",
    };
  }

  const { name, company, email, tone } = parsed.data;

  // Check if client with same email exists for this user
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.email, email), eq(clients.userId, session.userId)))
    .limit(1);

  if (existing) {
    return {
      message: "A client with this email address already exists in your workspace.",
    };
  }

  const parts = name.trim().split(/\s+/);
  const initials = (
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2)
  ).toUpperCase();

  const [newClient] = await db
    .insert(clients)
    .values({
      userId: session.userId,
      name,
      company,
      email,
      initials,
      tone,
    })
    .returning();

  return {
    client: {
      id: newClient.id,
      name: newClient.name,
      company: newClient.company,
      email: newClient.email,
      initials: newClient.initials,
      tone: newClient.tone as AvatarTone,
    },
    message: undefined,
  };
}

export async function deleteClientAction(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const [deleted] = await db
      .delete(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, session.userId)))
      .returning({ id: clients.id });

    if (!deleted) {
      return { success: false, error: "Client not found." };
    }

    return { success: true };
  } catch (err) {
    console.error("[deleteClientAction]", err);
    return { success: false, error: "Failed to delete client." };
  }
}
