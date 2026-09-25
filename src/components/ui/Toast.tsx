"use client";

import { useEffect } from "react";
import { Check, X } from "@phosphor-icons/react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__icon">
        <Check size={14} weight="bold" />
      </span>
      <p>{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss notification">
        <X size={13} />
      </button>
    </div>
  );
}
