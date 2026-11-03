import Link from "next/link";
import {
  ArrowRight,
  ChartLineUp,
  CreditCard,
  FileText,
  Receipt,
  ShieldCheck,
  QrCode,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { DemoButton } from "@/components/ui/DemoButton";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

const FEATURES = [
  {
    icon: FileText,
    title: "Proposals clients can approve",
    body: "Scope, line items and up to 12 payment milestones behind a private review link. Clients comment, request changes, or approve a specific revision.",
  },
  {
    icon: Receipt,
    title: "One approval, exactly one invoice",
    body: "Accepting a proposal creates its invoice with the agreed payment schedule. Repeated or concurrent approvals can never create a second one.",
  },
  {
    icon: CreditCard,
    title: "Payments confirmed by webhook",
    body: "Hosted Stripe Checkout with idempotency keys. An invoice is marked paid only by a signed webhook, never by a redirect.",
  },
  {
    icon: ChartLineUp,
    title: "Revenue at a glance",
    body: "Partial payments, outstanding balances and revenue trends update from real payment records.",
  },
  {
    icon: QrCode,
    title: "Hospitality billing",
    body: "Tables, rooms and staff with QR guest menus, nightly room pricing and immutable receipts, served by a Django API.",
  },
  {
    icon: ShieldCheck,
    title: "Built to be trusted",
    body: "Owner-scoped data, signed sessions, rate limiting, audit events and replay-safe writes.",
  },
];

const STEPS = [
  { n: "1", title: "Draft a proposal", body: "Add scope, pricing and a milestone schedule." },
  { n: "2", title: "Share a private link", body: "Your client reviews, comments and approves." },
  { n: "3", title: "Invoice is created", body: "Approval generates one invoice with the agreed plan." },
  { n: "4", title: "Get paid", body: "Each installment is paid through Stripe and confirmed by webhook." },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "PostgreSQL", "Drizzle ORM", "Stripe", "Django", "Redis", "Docker", "GitHub Actions"];

function Mock() {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock__head">
        <div>
          <span className="lp-mock__label">Invoice</span>
          <strong>INV-1038</strong>
        </div>
        <span className="lp-pill lp-pill--sent">Sent</span>
      </div>
      <div className="lp-mock__client">
        <span className="lp-mock__avatar">MC</span>
        <div>
          <strong>Mira Chen</strong>
          <span>Atelier Miro</span>
        </div>
      </div>
      <ul className="lp-mock__lines">
        <li><span>Brand strategy workshop</span><span>$1,200</span></li>
        <li><span>Visual identity direction</span><span>$1,800</span></li>
        <li><span>Website design · 4 pages</span><span>$1,584</span></li>
      </ul>
      <div className="lp-mock__plan">
        <div><i style={{ width: "50%" }} /></div>
        <span>Deposit of $2,475.36 paid · 50%</span>
      </div>
      <div className="lp-mock__total"><span>Total incl. 8% tax</span><strong>$4,950.72</strong></div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-brand">
          <span className="sidebar__logo" style={{ width: 30, height: 30, fontSize: 15 }}>B</span>
          Billora
        </Link>
        <nav>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#stack">Stack</a>
          {REPO_URL && <a href={REPO_URL} target="_blank" rel="noreferrer">Source</a>}
          <Link href="/sign-in" className="lp-btn lp-btn--ghost">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero__copy">
            <span className="lp-eyebrow">Proposals · Invoices · Payments</span>
            <h1>From signed-off proposal to paid invoice, in one calm workspace.</h1>
            <p>
              Billora helps independent studios get approval, invoice by milestone and collect payment, with
              every step recorded and confirmed.
            </p>
            <div className="lp-hero__cta">
              {DEMO_MODE ? (
                <DemoButton className="lp-demo" />
              ) : (
                <Link href="/sign-up" className="lp-btn lp-btn--primary">
                  Create a free account <ArrowRight size={16} weight="bold" />
                </Link>
              )}
              <Link href={DEMO_MODE ? "/sign-up" : "/sign-in"} className="lp-btn lp-btn--ghost">
                {DEMO_MODE ? "Create an account" : "Sign in"}
              </Link>
            </div>
            <p className="lp-note">Portfolio project. Payments run in Stripe test mode: use card 4242 4242 4242 4242.</p>
          </div>
          <Mock />
        </section>

        <section id="features" className="lp-section">
          <h2>Everything between “yes” and “paid”</h2>
          <div className="lp-grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="lp-card">
                <span className="lp-card__icon"><Icon size={20} weight="duotone" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="lp-section lp-section--tint">
          <h2>How it works</h2>
          <ol className="lp-steps">
            {STEPS.map(step => (
              <li key={step.n}>
                <span className="lp-steps__n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="stack" className="lp-section">
          <h2>Engineering notes</h2>
          <ul className="lp-checks">
            <li><CheckCircle size={18} weight="fill" /> Idempotent mutations with 30-day replay keys, so retries never double-charge or double-create.</li>
            <li><CheckCircle size={18} weight="fill" /> Transactional audit records written with each successful change.</li>
            <li><CheckCircle size={18} weight="fill" /> Shared Redis rate limiting and structured request logging in production.</li>
            <li><CheckCircle size={18} weight="fill" /> CI runs migrations, unit and integration tests, lint and build against PostgreSQL and Redis.</li>
          </ul>
          <ul className="lp-stack">
            {STACK.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} Billora · A portfolio project, not a commercial service.</span>
        <span>
          <Link href="/sign-in">Sign in</Link> · <Link href="/sign-up">Sign up</Link>
        </span>
      </footer>
    </div>
  );
}
