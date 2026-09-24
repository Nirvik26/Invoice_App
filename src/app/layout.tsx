import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Billora — Run your business, beautifully",
  description:
    "A thoughtful invoicing and revenue workspace for independent studios and creative businesses.",
  applicationName: "Billora",
  openGraph: {
    title: "Billora — Run your business, beautifully",
    description: "Invoices, clients, and cash flow in one calm workspace.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Billora" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Billora — Run your business, beautifully",
    description: "Invoices, clients, and cash flow in one calm workspace.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
