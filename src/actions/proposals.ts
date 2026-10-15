"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { proposalDetail } from "@/lib/proposals";
import {
  saveProposalForUser,
  shareProposalForUser,
  recordProposalResponse,
} from "@/lib/proposal-service";

export async function saveProposal(input: unknown) {
  const session = await getSession();
  if (!session) return { error: "Please sign in." };
  const result = await saveProposalForUser(session.userId, input);
  if (!result.error) revalidatePath("/");
  return result;
}

export async function getProposal(id: string) {
  const session = await getSession();
  return session ? proposalDetail(id, session.userId) : null;
}

export async function shareProposal(id: string, version: number) {
  const session = await getSession();
  if (!session) return { error: "Please sign in." };
  const result = await shareProposalForUser(session.userId, id, version);
  if (result.token) {
    revalidatePath("/");
    revalidatePath(`/proposal/${result.token}`);
  }
  return result;
}

export async function respondToProposal(input: unknown) {
  const result = await recordProposalResponse(input);
  if (!result.error) {
    revalidatePath("/");
    revalidatePath("/proposal/[token]", "page");
  }
  return result;
}
