"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRow } from "@/types";
import type { ProposalList, ProposalDetail } from "@/lib/proposals";
import type { ProposalContent } from "@/lib/billing";
import { money, totalCents } from "@/lib/billing";
import { getProposal, saveProposal, shareProposal } from "@/actions/proposals";
import { ProposalReview } from "./ProposalReview";

const initial: ProposalContent = {
  scope: "",
  items: [{ description: "", rate: 0, qty: 1 }],
  taxRate: 8,
  paymentDays: 30,
  paymentPlan: [
    { label: "Project deposit", percent: 30 },
    { label: "Final delivery", percent: 70 },
  ],
};

export function ProposalsWorkspace({
  proposals,
  clients,
  query,
}: {
  proposals: ProposalList;
  clients: ClientRow[];
  query: string;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<ProposalDetail | null>(null);
  const [id, setId] = useState<string>();
  const [version, setVersion] = useState<number>();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [content, setContent] = useState<ProposalContent>(initial);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const selectedId = selected?.proposal.id;
  useEffect(() => {
    if (!selectedId || editing) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const result = await getProposal(selectedId);
        if (active && result) setSelected(result);
      } catch {
        /* Retry on next poll. */
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedId, editing]);
  function edit(detail?: ProposalDetail) {
    const p = detail?.proposal;
    setId(p?.id);
    setVersion(p?.version);
    setTitle(p?.title || "");
    setClientId(p?.clientId || clients[0]?.id || "");
    setContent(p?.content || structuredClone(initial));
    setEditing(true);
    setError("");
    setNotice("");
  }
  function open(id: string) {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await getProposal(id);
        if (result) setSelected(result);
        else setError("Proposal not found.");
      } catch {
        setError("Could not load proposal.");
      }
    });
  }
  function save() {
    setError("");
    start(async () => {
      try {
        const result = await saveProposal({
          id,
          version,
          title,
          clientId,
          content,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        const detail = await getProposal(result.id!);
        setSelected(detail);
        setEditing(false);
        router.refresh();
      } catch {
        setError("Could not save proposal. Please try again.");
      }
    });
  }
  function share() {
    if (!selected) return;
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await shareProposal(
          selected.proposal.id,
          selected.proposal.version,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        setSelected(await getProposal(selected.proposal.id));
        router.refresh();
        try {
          await navigator.clipboard.writeText(
            `${location.origin}/proposal/${result.token}`,
          );
          setNotice("Private review link copied. Share it with your client.");
        } catch {
          setNotice(
            "Proposal published. Open Client preview and copy its URL to share.",
          );
        }
      } catch {
        setError("Could not publish proposal.");
      }
    });
  }
  return (
    <div className="flow-stack">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="flow-notice" role="status">
          {notice}
        </p>
      )}
      {editing ? (
        <form
          className="flow-card flow-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flow-heading">
            <h2>
              {id ? `Revise proposal · v${(version || 0) + 1}` : "New proposal"}
            </h2>
            <button
              type="button"
              className="btn btn--outline"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
          <div className="flow-grid">
            <label className="flow-field">
              Project title
              <input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brand & website redesign"
              />
            </label>
            <label className="flow-field">
              Client
              <select
                required
                disabled={!!id}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.company}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!clients.length && (
            <p className="flow-notice">
              Add a client in the Clients tab before creating a proposal.
            </p>
          )}
          <label className="flow-field">
            Scope, deliverables & milestone conditions
            <textarea
              required
              maxLength={10000}
              rows={5}
              value={content.scope}
              onChange={(e) =>
                setContent({ ...content, scope: e.target.value })
              }
              placeholder="Describe what is included, when it will be delivered, and when each milestone is payable."
            />
          </label>
          <h3>Pricing</h3>
          {content.items.map((item, i) => (
            <div className="flow-line" key={i}>
              <label className="flow-field">
                Description
                <input
                  required
                  value={item.description}
                  maxLength={500}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      items: content.items.map((x, n) =>
                        n === i ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label className="flow-field">
                Rate (USD)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  required
                  value={item.rate}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      items: content.items.map((x, n) =>
                        n === i ? { ...x, rate: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              <label className="flow-field">
                Quantity
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  required
                  value={item.qty}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      items: content.items.map((x, n) =>
                        n === i ? { ...x, qty: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn--outline"
                aria-label={`Remove pricing item ${i + 1}`}
                disabled={content.items.length === 1}
                onClick={() =>
                  setContent({
                    ...content,
                    items: content.items.filter((_, n) => n !== i),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--outline flow-fit"
            disabled={content.items.length >= 100}
            onClick={() =>
              setContent({
                ...content,
                items: [...content.items, { description: "", rate: 0, qty: 1 }],
              })
            }
          >
            + Add line item
          </button>
          <div className="flow-grid">
            <label className="flow-field">
              Tax (%)
              <input
                type="number"
                min={0}
                max={100}
                required
                value={content.taxRate}
                onChange={(e) =>
                  setContent({ ...content, taxRate: Number(e.target.value) })
                }
              />
            </label>
            <label className="flow-field">
              Invoice due after acceptance (days)
              <input
                type="number"
                min={1}
                max={365}
                required
                value={content.paymentDays}
                onChange={(e) =>
                  setContent({
                    ...content,
                    paymentDays: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <h3>Payment milestones</h3>
          <p className="flow-muted">
            The first milestone is the deposit. Percentages must add up to 100%.
          </p>
          {content.paymentPlan.map((m, i) => (
            <div className="flow-line flow-line--milestone" key={i}>
              <label className="flow-field">
                Milestone
                <input
                  required
                  maxLength={100}
                  value={m.label}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      paymentPlan: content.paymentPlan.map((x, n) =>
                        n === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label className="flow-field">
                Percent
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={m.percent}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      paymentPlan: content.paymentPlan.map((x, n) =>
                        n === i ? { ...x, percent: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn--outline"
                aria-label={`Remove milestone ${i + 1}`}
                disabled={content.paymentPlan.length === 1}
                onClick={() =>
                  setContent({
                    ...content,
                    paymentPlan: content.paymentPlan.filter((_, n) => n !== i),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--outline flow-fit"
            disabled={content.paymentPlan.length >= 12}
            onClick={() =>
              setContent({
                ...content,
                paymentPlan: [
                  ...content.paymentPlan,
                  { label: "", percent: 10 },
                ],
              })
            }
          >
            + Add milestone
          </button>
          <div className="flow-heading">
            <span className="flow-total">
              {money(totalCents(content.items, content.taxRate))}
            </span>
            <button
              className="btn btn--primary"
              disabled={pending || !clients.length}
            >
              {pending ? "Saving…" : "Save draft revision"}
            </button>
          </div>
        </form>
      ) : selected ? (
        <>
          <div className="flow-actions">
            <button
              className="btn btn--outline"
              onClick={() => {
                setSelected(null);
                setError("");
                setNotice("");
                router.refresh();
              }}
            >
              ← All proposals
            </button>
            {selected.proposal.status !== "Accepted" && (
              <button
                className="btn btn--outline"
                disabled={pending}
                onClick={() => edit(selected)}
              >
                Edit revision
              </button>
            )}
            <button
              className="btn btn--primary"
              disabled={
                pending || selected.proposal.status === "Changes requested"
              }
              onClick={share}
            >
              {selected.proposal.status === "Draft"
                ? "Publish & copy review link"
                : "Copy review link"}
            </button>
            {selected.proposal.status !== "Draft" && (
              <a
                className="btn btn--outline"
                href={`/proposal/${selected.proposal.publicToken}`}
                target="_blank"
                rel="noreferrer"
              >
                Client preview ↗
              </a>
            )}
          </div>
          <ProposalReview detail={selected} />
        </>
      ) : (
        <>
          <div className="flow-heading">
            <p className="flow-muted">
              Agree on the work. Get approval. Start getting paid.
            </p>
            <button className="btn btn--primary" onClick={() => edit()}>
              + New proposal
            </button>
          </div>
          {!proposals.length && (
            <div className="flow-card flow-empty">
              <span className="eyebrow">FROM FIRST IDEA TO FIRST PAYMENT</span>
              <h2>Your next project starts here</h2>
              <p>
                Create a proposal with a clear scope and payment milestones.
                <br />
                Your client can review, request changes, and approve it online.
              </p>
              <button className="btn btn--primary" onClick={() => edit()}>
                Create your first proposal
              </button>
            </div>
          )}
          {proposals
            .filter((p) =>
              `${p.title} ${p.clientName} ${p.status}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((p) => (
              <button
                disabled={pending}
                className="flow-card flow-proposal-row"
                key={p.id}
                onClick={() => open(p.id)}
              >
                <div>
                  <strong>{p.title}</strong>
                  <small>
                    {p.clientName} · Revision {p.version}
                  </small>
                </div>
                <span
                  className={`flow-status ${p.status === "Accepted" ? "flow-status--success" : ""}`}
                >
                  {p.status}
                </span>
                <b>{money(totalCents(p.content.items, p.content.taxRate))}</b>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          {!!proposals.length &&
            !proposals.some((p) =>
              `${p.title} ${p.clientName} ${p.status}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <p>No proposals match your search.</p>}
        </>
      )}
    </div>
  );
}
