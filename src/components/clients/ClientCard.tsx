import { Avatar } from "@/components/ui/Avatar";
import type { AvatarTone } from "@/types";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface ClientCardProps {
  name: string;
  company: string;
  email: string;
  initials: string;
  tone: AvatarTone | string;
  projectCount: number;
  lifetimeValue: number;
}

export function ClientCard({ name, company, email, initials, tone, projectCount, lifetimeValue }: ClientCardProps) {
  return (
    <article className="client-card">
      <div className="client-card__top">
        <Avatar initials={initials} tone={tone as AvatarTone} size="lg" />
        <span className="client-card__projects">{projectCount} project{projectCount !== 1 ? "s" : ""}</span>
      </div>
      <h3 className="client-card__name">{name}</h3>
      <p className="client-card__company">{company}</p>
      <a className="client-card__email" href={`mailto:${email}`} title={`Email ${name}`}>
        {email}
      </a>
      <footer className="client-card__footer">
        <span>Lifetime value</span>
        <b>{fmt.format(lifetimeValue)}</b>
      </footer>
    </article>
  );
}
