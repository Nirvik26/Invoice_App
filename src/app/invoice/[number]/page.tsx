import Link from "next/link";
import { getPublicInvoiceByNumber } from "@/lib/queries";
import { PublicInvoicePortal } from "@/components/invoice/PublicInvoicePortal";
import type { Metadata } from "next";

interface InvoicePageProps {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({
  params,
}: InvoicePageProps): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Invoice ${number} · Billora`,
    description: `View and settle invoice ${number} securely online.`,
  };
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { number } = await params;
  const invoice = await getPublicInvoiceByNumber(number);

  if (!invoice) {
    return (
      <div className="public-portal">
        <main className="public-portal__container" style={{ textAlign: "center", paddingTop: 80 }}>
          <div className="card" style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Invoice Not Found</h1>
            <p style={{ color: "var(--c-muted)", marginBottom: 24 }}>
              The invoice &ldquo;{number}&rdquo; could not be found or may have been removed.
            </p>
            <Link href="/" className="btn btn--primary" style={{ display: "inline-flex" }}>
              Return to Workspace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <PublicInvoicePortal invoice={invoice} />;
}
