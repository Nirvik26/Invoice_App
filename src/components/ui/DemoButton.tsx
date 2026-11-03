"use client";

import { useActionState } from "react";
import { demoSignInAction } from "@/actions/auth";
import { Play } from "@phosphor-icons/react";
import type { FormState } from "@/types";

export function DemoButton({ className = "auth-demo" }: { className?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(demoSignInAction, undefined);

  return (
    <form action={action} className={className}>
      <button type="submit" className="auth-demo__btn" disabled={pending} id="demo-submit">
        <Play size={14} weight="fill" />
        {pending ? "Opening demo…" : "Try the live demo"}
      </button>
      <p>No sign-up needed. Explore a pre-filled workspace; payments run in Stripe test mode.</p>
      {state?.message && <p className="auth-error" role="alert">{state.message}</p>}
    </form>
  );
}
