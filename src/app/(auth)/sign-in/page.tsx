"use client";

import { useActionState } from "react";
import { signInAction } from "@/actions/auth";
import Link from "next/link";
import { EnvelopeSimple, Lock, ArrowRight, Sparkle } from "@phosphor-icons/react";
import type { FormState } from "@/types";

const FEATURES = [
  "Invoices that get paid faster",
  "Client relationships at a glance",
  "Real-time revenue analytics",
  "Secure online payments",
];

export default function SignInPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    signInAction,
    undefined
  );

  return (
    <div className="auth-shell">
      {/* ── Brand panel ── */}
      <div className="auth-panel">
        <div className="auth-panel__inner">
          <div className="auth-panel__logo">
            <span className="sidebar__logo" style={{ width: 36, height: 36, fontSize: 18 }}>B</span>
            <span>Billora</span>
          </div>

          <div className="auth-panel__copy">
            <h1>Run your business,<br />beautifully.</h1>
            <p>The invoicing workspace for independent studios and creative professionals.</p>
          </div>

          <ul className="auth-panel__features">
            {FEATURES.map((f) => (
              <li key={f}>
                <Sparkle size={14} weight="fill" />
                {f}
              </li>
            ))}
          </ul>

          <div className="auth-panel__demo">
            <p>Try with demo account</p>
            <code>demo@billora.app / demo1234</code>
          </div>
        </div>

        {/* Animated gradient orbs */}
        <div className="auth-panel__orb auth-panel__orb--1" aria-hidden="true" />
        <div className="auth-panel__orb auth-panel__orb--2" aria-hidden="true" />
      </div>

      {/* ── Form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-panel__inner">
          <div className="auth-form-panel__header">
            <h2>Welcome back</h2>
            <p>Sign in to your Billora workspace</p>
          </div>

          {state?.message && (
            <div className="auth-error" role="alert">
              {state.message}
            </div>
          )}

          <form action={action} className="auth-form" noValidate>
            {/* Email */}
            <div className="auth-field">
              <label htmlFor="signin-email">Email address</label>
              <div className="auth-field__input">
                <EnvelopeSimple size={16} />
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="you@studio.co"
                  autoComplete="email"
                  autoFocus
                  aria-describedby={state?.errors?.email ? "signin-email-error" : undefined}
                />
              </div>
              {state?.errors?.email && (
                <p id="signin-email-error" className="auth-field__error">
                  {state.errors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-field__label-row">
                <label htmlFor="signin-password">Password</label>
                <a href="#" className="auth-field__forgot">Forgot password?</a>
              </div>
              <div className="auth-field__input">
                <Lock size={16} />
                <input
                  id="signin-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-describedby={state?.errors?.password ? "signin-password-error" : undefined}
                />
              </div>
              {state?.errors?.password && (
                <p id="signin-password-error" className="auth-field__error">
                  {state.errors.password[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={pending}
              id="signin-submit"
            >
              {pending ? (
                <span className="auth-submit__spinner" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>
          </form>

          <p className="auth-form-panel__footer">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
