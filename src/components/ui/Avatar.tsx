import type { AvatarTone } from "@/types";

interface AvatarProps {
  initials: string;
  tone: AvatarTone | string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ initials, tone, size = "md" }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${tone} avatar--${size}`}
      aria-label={initials}
    >
      {initials}
    </span>
  );
}
