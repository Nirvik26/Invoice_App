"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProposalDetail } from "@/lib/proposals";
import { installments, money, totalCents } from "@/lib/billing";
import { respondToProposal } from "@/actions/proposals";

export function ProposalReview({
  detail,
  client = false,
}: {
  detail: ProposalDetail;
  client?: boolean;
}) {
  const { proposal: p, events } = detail;
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const total = totalCents(p.content.items, p.content.taxRate);
  function respond(action: "comment" | "changes" | "accept") {
    setError("");
    start(async () => {
      try {
        const result = await respondToProposal({
          token: p.publicToken,
          version: p.version,
          name,
          message,
          action,
          consent,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setMessage("");
        setConsent(false);
        router.refresh();
      } catch {
        setError("Could not send your response. Please try again.");
      }
    });
  }
  return (
    <div className="flow-stack">
      <div className="flow-heading">
        <div>
          <p className="eyebrow">PROPOSAL · REVISION {p.version}</p>
          <h1>{p.title}</h1>
          <p className="flow-muted">
            {detail.issuerName} → {detail.clientName}
          </p>
        </div>
        <span
          className={`flow-status ${p.status === "Accepted" ? "flow-status--success" : ""}`}
        >
          {p.status}
        </span>
      </div>
      <section className="flow-card flow-stack">
        <h2>Scope of work</h2>
        <p className="flow-scope">{p.content.scope}</p>
        <div className="flow-table-scroll">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Deliverable</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.content.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{money(item.rate * 100)}</td>
                  <td>{item.qty}</td>
                  <td>{money(item.rate * item.qty * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flow-heading">
          <span>Includes {p.content.taxRate}% tax</span>
          <strong className="flow-total">{money(total)}</strong>
        </div>
        <h3>Payment milestones</h3>
        {installments(total, p.content.paymentPlan).map((m, i) => (
          <div className="flow-schedule" key={i}>
            <span>
              {i + 1}. {m.label} ({m.percent}%)
            </span>
            <b>{money(m.amountCents)}</b>
          </div>
        ))}
        <p className="flow-muted">
          Invoice due {p.content.paymentDays} days after acceptance. Milestone
          payments follow the scope agreed above.
        </p>
      </section>
      {p.status === "Accepted" && detail.invoiceToken && (
        <div className="flow-notice flow-heading">
          <span>Revision {p.version} accepted. Your invoice is ready.</span>
          <Link
            className="btn btn--primary"
            href={`/invoice/${detail.invoiceToken}`}
          >
            View invoice & pay
          </Link>
        </div>
      )}
      {client && p.status !== "Accepted" && (
        <section className="flow-card flow-stack">
          <h2>Your response</h2>
          <p className="flow-muted">
            This private link allows its holder to respond on behalf of{" "}
            {detail.clientName}.
          </p>
          <label className="flow-field">
            Your name
            <input
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </label>
          <label className="flow-field">
            Comment or requested changes
            <textarea
              maxLength={3000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Share feedback on the scope, timeline, or milestones…"
            />
          </label>
          {p.status === "Sent" ? (
            <label className="flow-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I am authorized to approve revision {p.version}, including its
              scope, total, and payment milestones.
            </label>
          ) : (
            <p className="flow-notice">
              Changes requested. The issuer will share a new revision for your
              approval.
            </p>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="flow-actions">
            <button
              className="btn btn--outline"
              disabled={pending || !name.trim() || !message.trim()}
              onClick={() => respond("comment")}
            >
              Add comment
            </button>
            <button
              className="btn btn--outline"
              disabled={pending || !name.trim() || !message.trim()}
              onClick={() => respond("changes")}
            >
              Request changes
            </button>
            <button
              className="btn btn--primary"
              disabled={
                pending || !consent || !name.trim() || p.status !== "Sent"
              }
              onClick={() => respond("accept")}
            >
              {pending ? "Saving…" : "Accept & create invoice"}
            </button>
          </div>
        </section>
      )}
      <section className="flow-card flow-stack">
        <h2>Revision & activity history</h2>
        <ol className="flow-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <div className="flow-heading">
                <strong>
                  {event.actor} · {event.kind}
                </strong>
                <small>{new Date(event.createdAt).toLocaleString()}</small>
              </div>
              <p>{event.message}</p>
              <small>Revision {event.version}</small>
              {event.snapshot && (
                <details>
                  <summary>View saved scope and pricing</summary>
                  <p className="flow-scope">{event.snapshot.scope}</p>
                  {event.snapshot.items.map((item, i) => (
                    <p key={i}>
                      {item.description} · {item.qty} × {money(item.rate * 100)}
                    </p>
                  ))}
                  <p>
                    Tax: {event.snapshot.taxRate}% · Total:{" "}
                    {money(
                      totalCents(event.snapshot.items, event.snapshot.taxRate),
                    )}
                  </p>
                  {event.snapshot.paymentPlan.map((m, i) => (
                    <p key={i}>
                      {m.label}: {m.percent}%
                    </p>
                  ))}
                  <p>Due {event.snapshot.paymentDays} days after acceptance.</p>
                </details>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
