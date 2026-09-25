"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { X, Check, UsersThree } from "@phosphor-icons/react";
import { createClientAction } from "@/actions/clients";
import { Avatar } from "@/components/ui/Avatar";
import type { AvatarTone, ClientRow } from "@/types";

const TONES: { tone: AvatarTone; label: string; bg: string }[] = [
  { tone: "blue", label: "Blue", bg: "var(--av-blue-bg)" },
  { tone: "violet", label: "Violet", bg: "var(--av-violet-bg)" },
  { tone: "rose", label: "Rose", bg: "var(--av-rose-bg)" },
  { tone: "amber", label: "Amber", bg: "var(--av-amber-bg)" },
  { tone: "green", label: "Green", bg: "var(--av-green-bg)" },
  { tone: "peach", label: "Peach", bg: "var(--av-peach-bg)" },
];

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (client: ClientRow) => void;
  onNotify: (msg: string) => void;
}

export function CreateClientModal({
  isOpen,
  onClose,
  onCreated,
  onNotify,
}: CreateClientModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTone, setSelectedTone] = useState<AvatarTone>("blue");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setName("");
    setCompany("");
    setEmail("");
    setSelectedTone("blue");
    setErrorMsg("");
    onClose();
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const initials = (
    name.trim().length > 0
      ? name
          .trim()
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
      : "CL"
  ).toUpperCase();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("company", company);
    formData.set("email", email);
    formData.set("tone", selectedTone);

    startTransition(async () => {
      const res = await createClientAction(undefined, formData);
      if (res?.message) {
        setErrorMsg(res.message);
        return;
      }

      if (res?.client) {
        onCreated({
          id: res.client.id,
          userId: "",
          name: res.client.name,
          company: res.client.company,
          email: res.client.email,
          initials: res.client.initials,
          tone: res.client.tone,
          createdAt: new Date(),
          projectCount: 0,
          lifetimeValue: 0,
        });
        onNotify(`Client ${res.client.name} added successfully`);
        onClose();
      }
    });
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-client-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="modal-card">
        <header className="modal-card__header">
          <div className="modal-card__title-wrap">
            <span className="modal-card__icon">
              <UsersThree size={20} weight="bold" />
            </span>
            <div>
              <h2 id="create-client-title">Add New Client</h2>
              <p>Keep your billing and customer profiles organized</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-card__form">
          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Avatar Preview & Tone Selector */}
          <div className="client-tone-picker">
            <Avatar initials={initials} tone={selectedTone} size="lg" />
            <div className="client-tone-picker__options">
              <span className="client-tone-picker__label">Avatar Accent</span>
              <div className="client-tone-picker__swatches">
                {TONES.map((t) => (
                  <button
                    key={t.tone}
                    type="button"
                    className={`client-tone-swatch${
                      selectedTone === t.tone ? " client-tone-swatch--active" : ""
                    }`}
                    style={{ background: t.bg }}
                    onClick={() => setSelectedTone(t.tone)}
                    title={t.label}
                    aria-label={`Select ${t.label} avatar color`}
                  >
                    {selectedTone === t.tone && (
                      <Check size={13} weight="bold" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="modal-field">
            <span>Contact Name *</span>
            <input
              type="text"
              required
              placeholder="e.g. Elena Rostova"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <label className="modal-field">
            <span>Company / Business *</span>
            <input
              type="text"
              required
              placeholder="e.g. Northstar Design Co."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>

          <label className="modal-field">
            <span>Billing Email Address *</span>
            <input
              type="email"
              required
              placeholder="e.g. elena@northstar.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <div className="modal-card__footer">
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isPending}
            >
              {isPending ? (
                <span className="auth-submit__spinner" />
              ) : (
                "Save Client"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
