"use client";

import { useActionState } from "react";
import { signUpAction } from "@/actions/auth";
import Link from "next/link";
import { EnvelopeSimple, Lock, User, ArrowRight, Sparkle } from "@phosphor-icons/react";
import type { FormState } from "@/types";

const PERKS = [
  "Free forever for freelancers",
  "Unlimited invoices & clients",
  "Drizzle-powered, lightning fast",
  "Built for your portfolio",
];

export default function SignUpPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    signUpAction,
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
            <h1>Start sending invoices<br />in minutes.</h1>
            <p>No credit card required. Set up your workspace in under 60 seconds.</p>
          </div>

          <ul className="auth-panel__features">
            {PERKS.map((p) => (
              <li key={p}>
                <Sparkle size={14} weight="fill" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-panel__orb auth-panel__orb--1" aria-hidden="true" />
        <div className="auth-panel__orb auth-panel__orb--2" aria-hidden="true" />
      </div>

      {/* ── Form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-panel__inner">
          <div className="auth-form-panel__header">
            <h2>Create your account</h2>
            <p>Join Billora and get paid faster</p>
          </div>

          {state?.message && (
            <div className="auth-error" role="alert">
              {state.message}
            </div>
          )}

          <form action={action} className="auth-form" noValidate>
            {/* Name */}
            <div className="auth-field">
              <label htmlFor="signup-name">Full name</label>
              <div className="auth-field__input">
                <User size={16} />
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  placeholder="Jordan Davis"
                  autoComplete="name"
                  autoFocus
                />
              </div>
              {state?.errors?.name && (
                <p className="auth-field__error">{state.errors.name[0]}</p>
              )}
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="signup-email">Work email</label>
              <div className="auth-field__input">
                <EnvelopeSimple size={16} />
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="you@studio.co"
                  autoComplete="email"
                />
              </div>
              {state?.errors?.email && (
                <p className="auth-field__error">{state.errors.email[0]}</p>
              )}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <div className="auth-field__input">
                <Lock size={16} />
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  placeholder="Min. 8 chars with a number"
                  autoComplete="new-password"
                />
              </div>
              {state?.errors?.password && (
                <ul className="auth-field__error-list">
                  {state.errors.password.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={pending}
              id="signup-submit"
            >
              {pending ? (
                <span className="auth-submit__spinner" />
              ) : (
                <>
                  Create account
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>
          </form>

          <p className="auth-form-panel__footer">
            Already have an account?{" "}
            <Link href="/sign-in">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
